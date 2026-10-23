import { AccessibilityInfo, Text } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useLevelUnit } from '../src/hooks/useLevelUnit';
import { useProfileOverview } from '../src/hooks/useProfileOverview';
import { useTheme } from '../src/hooks/useTheme';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { loadDrills, saveDrill } from '../src/services/drillStorage';
import {
  ProfileStorageError,
  loadProfile,
  updateProfile,
} from '../src/services/profileStorage';
import {
  SessionStorageError,
  SessionStorageService,
  countSessions,
  loadSessions,
  saveSession,
} from '../src/services/sessionStorage';
import {
  PreferencesProvider,
  type PreferencesProviderProps,
} from '../src/store/PreferencesContext';
import type { Profile } from '../src/types/profile';
import { APP_VERSION } from '../src/utils/appInfo';

type TestTabParamList = {
  Profile: undefined;
  Settings: undefined;
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const Tab = createBottomTabNavigator<TestTabParamList>();

/**
 * Stands in for the Profile screen Settings is opened from, showing the
 * run count the real one reads each time it gains focus.
 */
const ProfileProbe = () => {
  const { state } = useProfileOverview();
  return (
    <Text testID="text-profile-runs">
      {state.status === 'ready' ? String(state.overview.runCount) : ''}
    </Text>
  );
};

/**
 * Says which theme and level unit the rest of the app is drawn with, as
 * the theme and the Calibration screen would read them.
 */
const PreferencesProbe = () => (
  <>
    <Text testID="text-theme-mode">{useTheme().mode}</Text>
    <Text testID="text-level-unit">{useLevelUnit().levelUnit}</Text>
  </>
);

/** Let pending storage reads and the state updates they cause land. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>(resolve => {
      setImmediate(resolve);
    });
  });
};

type Storage = PreferencesProviderProps['storage'];

type Harness = {
  tree: ReactTestRenderer;
  currentRoute: () => string | undefined;
  goTo: (route: keyof TestTabParamList) => Promise<void>;
};

const mounted: ReactTestRenderer[] = [];

/** The real storage functions, so a save reaches AsyncStorage. */
const realStorage: Storage = { load: loadProfile, update: updateProfile };

/** A storage whose every save fails. */
const failingStorage: Storage = {
  load: loadProfile,
  update: () =>
    Promise.reject(new ProfileStorageError('disk full', 'STORAGE_FAILURE')),
};

/** Mount Settings over a stand-in Profile and wait for it to load. */
const renderScreen = async (storage = realStorage): Promise<Harness> => {
  const navigationRef = createNavigationContainerRef<TestTabParamList>();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PreferencesProvider storage={storage}>
          <PreferencesProbe />
          <NavigationContainer ref={navigationRef}>
            <Tab.Navigator
              initialRouteName="Settings"
              screenOptions={{ headerShown: false }}
            >
              <Tab.Screen name="Profile" component={ProfileProbe} />
              <Tab.Screen name="Settings" component={SettingsScreen} />
            </Tab.Navigator>
          </NavigationContainer>
        </PreferencesProvider>
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  mounted.push(tree);
  await settle();

  return {
    tree,
    currentRoute: () => navigationRef.getCurrentRoute()?.name,
    goTo: async route => {
      await act(async () => {
        navigationRef.navigate(route);
      });
      await settle();
    },
  };
};

const byTestId = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID });

const has = (tree: ReactTestRenderer, testID: string): boolean =>
  byTestId(tree, testID).length > 0;

/** The text shown by the element with this `testID`. */
const textOf = (tree: ReactTestRenderer, testID: string): string => {
  const text = byTestId(tree, testID).find(
    node => typeof node.props.children === 'string',
  );
  if (text === undefined) {
    throw new Error(`no text is rendered for "${testID}"`);
  }
  return text.props.children;
};

const subtitleOf = (tree: ReactTestRenderer, testID: string): string =>
  byTestId(tree, testID)[0].props.subtitle;

const press = async (tree: ReactTestRenderer, testID: string) => {
  await act(async () => {
    byTestId(tree, testID)[0].props.onPress();
  });
  await settle();
};

describe('SettingsScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    // Unmount, or the navigator's pending work outlives the test.
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    jest.restoreAllMocks();
  });

  it('groups Appearance and Level units under Display', async () => {
    const { tree } = await renderScreen();

    expect(tree.root.findAllByProps({ title: 'Display' })).not.toHaveLength(0);
    expect(has(tree, 'row-appearance')).toBe(true);
    expect(has(tree, 'row-level-unit')).toBe(true);
  });

  it('goes back to where it was opened from', async () => {
    const { tree, currentRoute } = await renderScreen();

    await press(tree, 'btn-back');

    expect(currentRoute()).toBe('Profile');
  });

  describe('Appearance', () => {
    it('says Appearance follows the device until a theme is chosen', async () => {
      const { tree } = await renderScreen();

      expect(subtitleOf(tree, 'row-appearance')).toBe(
        'Follows your device setting',
      );
    });

    it('shows the stored Appearance preference', async () => {
      await updateProfile({ appearance: 'dark' });

      const { tree } = await renderScreen();

      expect(subtitleOf(tree, 'row-appearance')).toBe('Dark');
    });

    it('opens the picker with the stored choice checked', async () => {
      await updateProfile({ appearance: 'light' });
      const { tree } = await renderScreen();

      expect(byTestId(tree, 'opt-appearance-light')).toHaveLength(0);
      await press(tree, 'row-appearance');

      const checked = (preference: string) =>
        byTestId(tree, `opt-appearance-${preference}`)[0].props
          .accessibilityState.checked;
      expect(checked('system')).toBe(false);
      expect(checked('light')).toBe(true);
      expect(checked('dark')).toBe(false);
    });

    it('switches the theme and stores the choice', async () => {
      const { tree } = await renderScreen();
      expect(textOf(tree, 'text-theme-mode')).toBe('light');

      await press(tree, 'row-appearance');
      await press(tree, 'opt-appearance-dark');

      expect(textOf(tree, 'text-theme-mode')).toBe('dark');
      expect(subtitleOf(tree, 'row-appearance')).toBe('Dark');
      expect(byTestId(tree, 'opt-appearance-dark')).toHaveLength(0);
      expect((await loadProfile()).appearance).toBe('dark');
    });

    it('follows the device again when System is chosen', async () => {
      await updateProfile({ appearance: 'dark' });
      const { tree } = await renderScreen();

      await press(tree, 'row-appearance');
      await press(tree, 'opt-appearance-system');

      // The test environment reports a light device.
      expect(textOf(tree, 'text-theme-mode')).toBe('light');
      expect(subtitleOf(tree, 'row-appearance')).toBe(
        'Follows your device setting',
      );
      expect((await loadProfile()).appearance).toBe('system');
    });

    it('changes nothing when the picker is closed without a choice', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'row-appearance');
      await press(tree, 'btn-appearance-close');

      expect(byTestId(tree, 'opt-appearance-dark')).toHaveLength(0);
      expect(textOf(tree, 'text-theme-mode')).toBe('light');
      expect((await loadProfile()).updatedAt).toBeNull();
    });

    it('puts the old theme back and says so when the save fails', async () => {
      await updateProfile({ appearance: 'light' });
      const { tree } = await renderScreen(failingStorage);

      await press(tree, 'row-appearance');
      await press(tree, 'opt-appearance-dark');

      expect(textOf(tree, 'text-theme-mode')).toBe('light');
      expect(subtitleOf(tree, 'row-appearance')).toBe('Light');
      expect(textOf(tree, 'text-appearance-error')).toBe(
        'Could not save your theme. Try again.',
      );
      // Announced when it appears, not only when it is focused.
      expect(
        byTestId(tree, 'text-appearance-error').some(
          node => node.props.accessibilityLiveRegion === 'polite',
        ),
      ).toBe(true);
      expect(has(tree, 'text-level-unit-error')).toBe(false);
      expect((await loadProfile()).appearance).toBe('light');
    });

    it('clears the error once a later choice saves', async () => {
      let calls = 0;
      const { tree } = await renderScreen({
        load: loadProfile,
        update: changes => {
          calls += 1;
          return calls === 1
            ? Promise.reject(
                new ProfileStorageError('disk full', 'STORAGE_FAILURE'),
              )
            : updateProfile(changes);
        },
      });

      await press(tree, 'row-appearance');
      await press(tree, 'opt-appearance-dark');
      expect(has(tree, 'text-appearance-error')).toBe(true);

      await press(tree, 'row-appearance');
      await press(tree, 'opt-appearance-dark');

      expect(has(tree, 'text-appearance-error')).toBe(false);
      expect(textOf(tree, 'text-theme-mode')).toBe('dark');
    });

    it('shows no error when an older save fails after a newer choice', async () => {
      let failFirst: () => void = () => {};
      let calls = 0;
      const { tree } = await renderScreen({
        load: loadProfile,
        update: changes => {
          calls += 1;
          if (calls === 1) {
            return new Promise<Profile>((_, reject) => {
              failFirst = () =>
                reject(new ProfileStorageError('disk full', 'STORAGE_FAILURE'));
            });
          }
          return updateProfile(changes);
        },
      });

      await press(tree, 'row-appearance');
      await press(tree, 'opt-appearance-dark');
      await press(tree, 'row-appearance');
      await press(tree, 'opt-appearance-light');
      await act(async () => {
        failFirst();
      });
      await settle();

      expect(has(tree, 'text-appearance-error')).toBe(false);
      expect(textOf(tree, 'text-theme-mode')).toBe('light');
      expect((await loadProfile()).appearance).toBe('light');
    });

    it('follows the device when the stored choice cannot be read', async () => {
      const { tree } = await renderScreen({
        load: () =>
          Promise.reject(
            new ProfileStorageError('unreadable', 'STORAGE_FAILURE'),
          ),
        update: updateProfile,
      });

      expect(textOf(tree, 'text-theme-mode')).toBe('light');
      expect(has(tree, 'row-appearance')).toBe(true);
    });
  });

  describe('Level units', () => {
    it('shows levels on the 0 to 100 scale until a unit is chosen', async () => {
      const { tree } = await renderScreen();

      expect(subtitleOf(tree, 'row-level-unit')).toBe('Level, 0 to 100');
      expect(textOf(tree, 'text-level-unit')).toBe('level');
    });

    it('shows the stored unit', async () => {
      await updateProfile({ levelUnit: 'dbfs' });

      const { tree } = await renderScreen();

      expect(subtitleOf(tree, 'row-level-unit')).toBe('dBFS, the raw reading');
    });

    it('names the unit in words for a screen reader', async () => {
      await updateProfile({ levelUnit: 'dbfs' });

      const { tree } = await renderScreen();

      expect(byTestId(tree, 'row-level-unit')[0].props.accessibilityLabel).toBe(
        'Level units, Decibels full scale, the raw reading',
      );
    });

    it('opens the picker with the stored unit checked', async () => {
      await updateProfile({ levelUnit: 'dbfs' });
      const { tree } = await renderScreen();

      expect(byTestId(tree, 'opt-level-unit-dbfs')).toHaveLength(0);
      await press(tree, 'row-level-unit');

      const checked = (unit: string) =>
        byTestId(tree, `opt-level-unit-${unit}`)[0].props.accessibilityState
          .checked;
      expect(checked('level')).toBe(false);
      expect(checked('dbfs')).toBe(true);
    });

    it('switches the unit at once and stores the choice', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'row-level-unit');
      await press(tree, 'opt-level-unit-dbfs');

      expect(textOf(tree, 'text-level-unit')).toBe('dbfs');
      expect(subtitleOf(tree, 'row-level-unit')).toBe('dBFS, the raw reading');
      expect(byTestId(tree, 'opt-level-unit-dbfs')).toHaveLength(0);
      expect((await loadProfile()).levelUnit).toBe('dbfs');
    });

    it('leaves the theme alone when the unit changes', async () => {
      await updateProfile({ appearance: 'dark' });
      const { tree } = await renderScreen();

      await press(tree, 'row-level-unit');
      await press(tree, 'opt-level-unit-dbfs');

      expect(textOf(tree, 'text-theme-mode')).toBe('dark');
      expect((await loadProfile()).appearance).toBe('dark');
    });

    it('changes nothing when the picker is closed without a choice', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'row-level-unit');
      await press(tree, 'btn-level-unit-close');

      expect(byTestId(tree, 'opt-level-unit-dbfs')).toHaveLength(0);
      expect(textOf(tree, 'text-level-unit')).toBe('level');
      expect((await loadProfile()).updatedAt).toBeNull();
    });

    it('puts the old unit back and says so when the save fails', async () => {
      const { tree } = await renderScreen(failingStorage);

      await press(tree, 'row-level-unit');
      await press(tree, 'opt-level-unit-dbfs');

      expect(textOf(tree, 'text-level-unit')).toBe('level');
      expect(subtitleOf(tree, 'row-level-unit')).toBe('Level, 0 to 100');
      expect(textOf(tree, 'text-level-unit-error')).toBe(
        'Could not save your level units. Try again.',
      );
      expect(has(tree, 'text-appearance-error')).toBe(false);
      expect((await loadProfile()).levelUnit).toBe('level');
    });
  });

  describe('Data', () => {
    const SHEET = 'sheet-clear-history';

    const seedDrill = () =>
      saveDrill({ name: 'Bill Drill', steps: [{ type: 'shot', par: 0.5 }] });

    /** Save `count` runs against one drill. */
    const seedRuns = async (count: number): Promise<void> => {
      for (let run = 0; run < count; run += 1) {
        await saveSession({
          drillId: 'drill-1',
          totalTime: 0.4,
          completed: true,
          splits: [
            { stepId: 'step-1', label: 'Shot 1', par: 0.5, actual: 0.4 },
          ],
        });
      }
    };

    /** Every string rendered under the first element with this testID. */
    const textsUnder = (tree: ReactTestRenderer, testID: string): string[] =>
      byTestId(tree, testID)[0]
        .findAll(node => typeof node.props.children === 'string')
        .map(node => node.props.children);

    /** What a screen reader is told about the row's state. */
    const rowState = (tree: ReactTestRenderer) =>
      byTestId(tree, 'row-clear-history').find(
        node => node.props.accessibilityState !== undefined,
      )?.props.accessibilityState;

    const isAsking = (tree: ReactTestRenderer): boolean =>
      has(tree, `${SHEET}-confirm`);

    /**
     * Stub out what a screen reader is told. The jest preset already mocks
     * it, so a spy can carry calls over from earlier tests: start clean.
     */
    const silenceAnnouncements = () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => {});
      announce.mockClear();
      return announce;
    };

    it('offers to clear the history under Data, styled as destructive', async () => {
      await seedRuns(1);

      const { tree } = await renderScreen();

      expect(tree.root.findAllByProps({ title: 'Data' })).not.toHaveLength(0);
      expect(byTestId(tree, 'row-clear-history')[0].props.destructive).toBe(
        true,
      );
      expect(rowState(tree)).toEqual({ disabled: false });
    });

    it('says how many runs are saved', async () => {
      await seedRuns(3);

      const { tree } = await renderScreen();

      expect(subtitleOf(tree, 'row-clear-history')).toBe(
        '3 saved runs. Drills are kept.',
      );
    });

    it('is disabled when there are no runs', async () => {
      const { tree } = await renderScreen();

      expect(subtitleOf(tree, 'row-clear-history')).toBe(
        'No saved runs to delete',
      );
      expect(rowState(tree)).toEqual({ disabled: true });
      expect(
        byTestId(tree, 'row-clear-history').some(
          node => node.props.disabled === true,
        ),
      ).toBe(true);
    });

    it('is disabled while the runs are being counted', async () => {
      await seedRuns(2);
      jest
        .spyOn(SessionStorageService, 'count')
        .mockImplementationOnce(() => new Promise<number>(() => {}));

      const { tree } = await renderScreen();

      expect(subtitleOf(tree, 'row-clear-history')).toBe(
        'Counting saved runs…',
      );
      expect(rowState(tree)).toEqual({ disabled: true });
    });

    it('still offers to clear when the runs cannot be counted', async () => {
      await seedRuns(2);
      jest
        .spyOn(SessionStorageService, 'count')
        .mockRejectedValueOnce(
          new SessionStorageError('unreadable', 'STORAGE_FAILURE'),
        );
      const { tree } = await renderScreen();
      expect(rowState(tree)).toEqual({ disabled: false });

      await press(tree, 'row-clear-history');

      expect(textsUnder(tree, SHEET)).toContain('Delete every saved run?');
    });

    it('clears runs it could not count, and says every run went', async () => {
      const announce = silenceAnnouncements();
      await seedRuns(2);
      jest
        .spyOn(SessionStorageService, 'count')
        .mockRejectedValueOnce(
          new SessionStorageError('unreadable', 'STORAGE_FAILURE'),
        );
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');

      await press(tree, `${SHEET}-confirm`);

      expect(await countSessions()).toBe(0);
      expect(subtitleOf(tree, 'row-clear-history')).toBe(
        'No saved runs to delete',
      );
      expect(announce).toHaveBeenCalledWith('Deleted every saved run');
    });

    it('asks first, naming how many runs will be deleted', async () => {
      await seedRuns(37);
      const { tree } = await renderScreen();
      expect(isAsking(tree)).toBe(false);

      await press(tree, 'row-clear-history');

      const texts = textsUnder(tree, SHEET);
      expect(texts).toContain('Delete 37 runs?');
      expect(texts).toContain(
        'Every saved run is removed from this phone. Your drills and profile are kept. This cannot be undone.',
      );
      expect(texts).toContain('Delete runs');
      expect(byTestId(tree, `${SHEET}-confirm`)[0].props.variant).toBe(
        'danger',
      );
      expect(await countSessions()).toBe(37);
    });

    it('says "run" for a single run', async () => {
      await seedRuns(1);
      const { tree } = await renderScreen();

      await press(tree, 'row-clear-history');

      expect(textsUnder(tree, SHEET)).toContain('Delete 1 run?');
    });

    it('gives the question to a screen reader as the heading of the sheet', async () => {
      await seedRuns(2);
      const { tree } = await renderScreen();

      await press(tree, 'row-clear-history');

      const heading = byTestId(tree, SHEET)[0].findAll(
        node =>
          node.props.accessibilityRole === 'header' &&
          node.props.children === 'Delete 2 runs?',
      );
      expect(heading).not.toHaveLength(0);
    });

    it('deletes nothing when the confirmation is cancelled', async () => {
      await seedRuns(2);
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');

      await press(tree, `${SHEET}-cancel`);

      expect(isAsking(tree)).toBe(false);
      expect(await countSessions()).toBe(2);
      expect(subtitleOf(tree, 'row-clear-history')).toBe(
        '2 saved runs. Drills are kept.',
      );
    });

    it('deletes nothing when the sheet is dismissed from the backdrop', async () => {
      await seedRuns(2);
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');

      await press(tree, `${SHEET}-backdrop`);

      expect(isAsking(tree)).toBe(false);
      expect(await countSessions()).toBe(2);
    });

    it('deletes every run and keeps the drills and profile once confirmed', async () => {
      const announce = silenceAnnouncements();
      const drill = await seedDrill();
      await updateProfile({ name: 'Sam', appearance: 'dark' });
      await seedRuns(3);
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');

      await press(tree, `${SHEET}-confirm`);

      expect(isAsking(tree)).toBe(false);
      expect(await loadSessions()).toEqual([]);
      expect(await countSessions()).toBe(0);
      expect((await loadDrills()).map(({ id }) => id)).toEqual([drill.id]);
      const profile = await loadProfile();
      expect(profile.name).toBe('Sam');
      expect(profile.appearance).toBe('dark');
      expect(subtitleOf(tree, 'row-clear-history')).toBe(
        'No saved runs to delete',
      );
      expect(rowState(tree)).toEqual({ disabled: true });
      expect(announce).toHaveBeenCalledWith('Deleted 3 runs');
    });

    it('shows a run count of 0 on Profile after the history is cleared', async () => {
      silenceAnnouncements();
      await seedRuns(2);
      const { tree, goTo } = await renderScreen();
      await goTo('Profile');
      expect(textOf(tree, 'text-profile-runs')).toBe('2');
      await goTo('Settings');

      await press(tree, 'row-clear-history');
      await press(tree, `${SHEET}-confirm`);
      await goTo('Profile');

      expect(textOf(tree, 'text-profile-runs')).toBe('0');
    });

    it('counts runs saved since the screen was last shown', async () => {
      await seedRuns(1);
      const { tree, goTo } = await renderScreen();
      await goTo('Profile');

      await seedRuns(1);
      await goTo('Settings');

      expect(subtitleOf(tree, 'row-clear-history')).toBe(
        '2 saved runs. Drills are kept.',
      );
    });

    it('keeps the runs and says so when storage fails', async () => {
      const announce = silenceAnnouncements();
      await seedRuns(2);
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');
      jest
        .spyOn(AsyncStorage, 'removeMany')
        .mockRejectedValueOnce(new Error('disk full'));

      await press(tree, `${SHEET}-confirm`);

      expect(isAsking(tree)).toBe(true);
      expect(textOf(tree, `${SHEET}-error`)).toBe(
        'Could not delete your runs. They are still saved. Try again.',
      );
      expect(await countSessions()).toBe(2);
      expect(subtitleOf(tree, 'row-clear-history')).toBe(
        '2 saved runs. Drills are kept.',
      );
      expect(announce).not.toHaveBeenCalledWith(
        expect.stringContaining('Deleted'),
      );
    });

    it('deletes the runs when tried again after a failure', async () => {
      silenceAnnouncements();
      await seedRuns(2);
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');
      jest
        .spyOn(SessionStorageService, 'clear')
        .mockRejectedValueOnce(
          new SessionStorageError('disk full', 'STORAGE_FAILURE'),
        );
      await press(tree, `${SHEET}-confirm`);
      expect(has(tree, `${SHEET}-error`)).toBe(true);

      await press(tree, `${SHEET}-confirm`);

      expect(isAsking(tree)).toBe(false);
      expect(await countSessions()).toBe(0);
    });

    it('drops the error when the sheet is opened again', async () => {
      await seedRuns(2);
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');
      jest
        .spyOn(SessionStorageService, 'clear')
        .mockRejectedValueOnce(
          new SessionStorageError('disk full', 'STORAGE_FAILURE'),
        );
      await press(tree, `${SHEET}-confirm`);
      await press(tree, `${SHEET}-cancel`);

      await press(tree, 'row-clear-history');

      expect(has(tree, `${SHEET}-error`)).toBe(false);
    });

    it('cannot be cancelled or confirmed twice while the runs are deleted', async () => {
      silenceAnnouncements();
      await seedRuns(2);
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');
      let finish: () => void = () => {};
      const clear = jest
        .spyOn(SessionStorageService, 'clear')
        .mockImplementationOnce(
          () =>
            new Promise<void>(resolve => {
              finish = resolve;
            }),
        );

      await press(tree, `${SHEET}-confirm`);
      await press(tree, `${SHEET}-confirm`);
      await press(tree, `${SHEET}-cancel`);

      expect(clear).toHaveBeenCalledTimes(1);
      expect(isAsking(tree)).toBe(true);
      expect(textsUnder(tree, SHEET)).toContain('Deleting…');

      await act(async () => {
        finish();
      });
      await settle();

      expect(isAsking(tree)).toBe(false);
    });
  });

  describe('About', () => {
    it('shows the version from package.json', async () => {
      const { version } = jest.requireActual<{ version: string }>(
        '../package.json',
      );

      const { tree } = await renderScreen();

      expect(tree.root.findAllByProps({ title: 'About' })).not.toHaveLength(0);
      expect(APP_VERSION).toBe(version);
      expect(byTestId(tree, 'row-version')[0].props.value).toBe(version);
      expect(byTestId(tree, 'row-version')[0].props.accessibilityLabel).toBe(
        `Version ${version}`,
      );
    });

    it('says the data stays on the phone and calibration resets', async () => {
      const { tree } = await renderScreen();

      const note = byTestId(tree, 'text-privacy')[0]
        .findAll(node => typeof node.props.children === 'string')
        .map(node => node.props.children)
        .join(' ');
      expect(note).toContain('stored only on this phone');
      expect(note).toContain('no account');
      expect(note).toContain('nothing is sent anywhere');
      expect(note).toContain('Calibration resets when the app');
    });
  });
});
