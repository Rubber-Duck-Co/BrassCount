import { AccessibilityInfo, Text } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SectionHeader } from '../src/components/SectionHeader';
import { useCalibration } from '../src/hooks/useCalibration';
import { useLevelUnit } from '../src/hooks/useLevelUnit';
import { useTheme } from '../src/hooks/useTheme';
import { SetupScreen } from '../src/screens/SetupScreen';
import { loadDrills, saveDrill } from '../src/services/drillStorage';
import {
  ProfileStorageError,
  ProfileStorageService,
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
  StartSequenceError,
  StartSequenceService,
} from '../src/services/startSequence';
import {
  CalibrationProvider,
  type CalibrationContextValue,
} from '../src/store/CalibrationContext';
import {
  PreferencesProvider,
  type PreferencesProviderProps,
} from '../src/store/PreferencesContext';
import {
  DEFAULT_PROFILE,
  MAX_PROFILE_NAME_LENGTH,
  type Profile,
} from '../src/types/profile';
import { APP_VERSION } from '../src/utils/appInfo';

/**
 * Setup is the Setup tab's root in the app, with Calibration pushed over
 * it. Here Calibration is a sibling tab: the screen only needs a route of
 * that name to navigate to, and a second tab lets Setup lose and regain
 * focus.
 */
type TestTabParamList = {
  SetupHome: undefined;
  Elsewhere: undefined;
  Calibration: undefined;
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const Tab = createBottomTabNavigator<TestTabParamList>();

const Elsewhere = () => null;

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

/** Calibrates a sound as the Calibration screen would. */
let calibrate: CalibrationContextValue['setSample'] = () => {};

const CalibrationProbe = () => {
  calibrate = useCalibration().setSample;
  return null;
};

const seedDrill = () =>
  saveDrill({
    name: 'Bill Drill',
    steps: [
      { type: 'draw', par: 1.5 },
      { type: 'shot', par: 0.25 },
    ],
  });

/** Save `count` runs against one drill. */
const seedRuns = async (count: number): Promise<void> => {
  for (let run = 0; run < count; run += 1) {
    await saveSession({
      drillId: 'drill-1',
      totalTime: 0.4,
      completed: true,
      splits: [{ stepId: 'step-1', label: 'Shot 1', par: 0.5, actual: 0.4 }],
    });
  }
};

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
  /** Switch to another tab, or back to Setup. */
  goTo: (tab: keyof TestTabParamList) => Promise<void>;
  currentRoute: () => string | undefined;
};

const mounted: ReactTestRenderer[] = [];

/**
 * The real storage functions, handed to the provider directly so a spy on
 * `ProfileStorageService` only ever sees the screen's own reads and saves.
 */
const realStorage: Storage = { load: loadProfile, update: updateProfile };

/** A preferences storage whose every save fails. */
const failingStorage: Storage = {
  load: loadProfile,
  update: () =>
    Promise.reject(new ProfileStorageError('disk full', 'STORAGE_FAILURE')),
};

/** Mount the screen in a tab navigator without waiting for it to load. */
const mountScreen = (storage = realStorage): Harness => {
  const navigationRef = createNavigationContainerRef<TestTabParamList>();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PreferencesProvider storage={storage}>
          <CalibrationProvider>
            <PreferencesProbe />
            <CalibrationProbe />
            <NavigationContainer ref={navigationRef}>
              <Tab.Navigator screenOptions={{ headerShown: false }}>
                <Tab.Screen name="SetupHome" component={SetupScreen} />
                <Tab.Screen name="Elsewhere" component={Elsewhere} />
                <Tab.Screen name="Calibration" component={Elsewhere} />
              </Tab.Navigator>
            </NavigationContainer>
          </CalibrationProvider>
        </PreferencesProvider>
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  mounted.push(tree);

  return {
    tree,
    goTo: async tab => {
      await act(async () => {
        navigationRef.navigate(tab);
      });
      await settle();
    },
    currentRoute: () => navigationRef.getCurrentRoute()?.name,
  };
};

/** Mount the screen and wait until it shows what is in storage. */
const renderScreen = async (storage = realStorage): Promise<Harness> => {
  const harness = mountScreen(storage);
  await settle();
  return harness;
};

const byTestId = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID });

const has = (tree: ReactTestRenderer, testID: string): boolean =>
  byTestId(tree, testID).length > 0;

/**
 * The text shown by the element with this `testID`. A `testID` is
 * forwarded through several nested elements; the one holding the string is
 * the text itself.
 */
const textOf = (tree: ReactTestRenderer, testID: string): string => {
  const text = byTestId(tree, testID).find(
    node => typeof node.props.children === 'string',
  );
  if (text === undefined) {
    throw new Error(`no text is rendered for "${testID}"`);
  }
  return text.props.children;
};

/** Every string rendered under the first element with this testID. */
const textsUnder = (tree: ReactTestRenderer, testID: string): string[] =>
  byTestId(tree, testID)[0]
    .findAll(node => typeof node.props.children === 'string')
    .map(node => node.props.children);

/** What a settings row shows at its right. */
const valueOf = (tree: ReactTestRenderer, testID: string): string | undefined =>
  byTestId(tree, testID)[0].props.value;

const labelOf = (tree: ReactTestRenderer, testID: string): string =>
  byTestId(tree, testID)[0].props.accessibilityLabel;

const sectionTitles = (tree: ReactTestRenderer): string[] =>
  tree.root.findAllByType(SectionHeader).map(node => node.props.title);

const press = async (tree: ReactTestRenderer, testID: string) => {
  await act(async () => {
    byTestId(tree, testID)[0].props.onPress();
  });
  await settle();
};

const type = (tree: ReactTestRenderer, testID: string, text: string) => {
  act(() => {
    byTestId(tree, testID)[0].props.onChangeText(text);
  });
};

const saveButton = (tree: ReactTestRenderer) =>
  byTestId(tree, 'btn-save-profile')[0];

const failProfileRead = () =>
  jest
    .spyOn(ProfileStorageService, 'load')
    .mockRejectedValue(
      new ProfileStorageError('unreadable', 'STORAGE_FAILURE'),
    );

describe('SetupScreen', () => {
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

  describe('the screen', () => {
    it('is titled Setup, with what it holds under the title', async () => {
      const { tree } = await renderScreen();

      const header = textsUnder(tree, 'screen-header');
      expect(header).toContain('Setup');
      expect(header).toContain('Shooter, calibration and settings');
    });

    it('is a tab root: no back link and no header action', async () => {
      const { tree } = await renderScreen();

      expect(has(tree, 'btn-back')).toBe(false);
      expect(has(tree, 'btn-header-action')).toBe(false);
      expect(has(tree, 'btn-open-settings')).toBe(false);
    });

    it('groups the settings into Microphone, Timer, Display and Data, in that order', async () => {
      const { tree } = await renderScreen();

      expect(sectionTitles(tree)).toEqual([
        'Microphone · this session',
        'Timer',
        'Display',
        'Data',
      ]);
    });

    it('offers no sign out, as there is no account to leave', async () => {
      const { tree } = await renderScreen();

      expect(tree.root.findAllByProps({ title: 'Sign out' })).toHaveLength(0);
    });
  });

  describe('the profile box', () => {
    it('says it is loading until storage answers', async () => {
      let releaseRead: () => void = () => {};
      jest.spyOn(ProfileStorageService, 'load').mockImplementationOnce(
        () =>
          new Promise<Profile>(resolve => {
            releaseRead = () => resolve(DEFAULT_PROFILE);
          }),
      );
      const { tree } = await renderScreen();

      expect(has(tree, 'text-profile-loading')).toBe(true);
      expect(has(tree, 'text-profile-name')).toBe(false);
      expect(has(tree, 'row-appearance')).toBe(true);

      await act(async () => {
        releaseRead();
      });
      await settle();

      expect(has(tree, 'text-profile-loading')).toBe(false);
      expect(has(tree, 'text-profile-name')).toBe(true);
    });

    it('shows an unnamed profile with zero counts on a fresh install', async () => {
      const { tree } = await renderScreen();

      expect(textOf(tree, 'text-profile-name')).toBe('No name set');
      expect(textOf(tree, 'text-profile-meta')).toBe('0 runs · 0 drills');
    });

    it('shows the stored name, the handle and counts on one line, and the initials', async () => {
      await updateProfile({ name: 'Marty McFly', handle: 'martymcfly' });
      await seedDrill();
      await seedRuns(2);

      const { tree } = await renderScreen();

      expect(textOf(tree, 'text-profile-name')).toBe('Marty McFly');
      expect(textOf(tree, 'text-profile-meta')).toBe(
        '@martymcfly · 2 runs · 1 drill',
      );
      expect(tree.root.findAllByProps({ children: 'MM' })).not.toHaveLength(0);
    });

    it('reads the shooter out as one phrase, apart from Edit', async () => {
      await updateProfile({ name: 'Marty McFly', handle: 'martymcfly' });
      await seedDrill();
      await seedRuns(1);

      const { tree } = await renderScreen();

      const identity = byTestId(tree, 'text-profile-identity').find(
        node => node.props.accessible === true,
      );
      expect(identity?.props.accessibilityLabel).toBe(
        'Marty McFly, @martymcfly, 1 run, 1 drill',
      );
      expect(identity?.findAllByProps({ testID: 'btn-edit-profile' })).toEqual(
        [],
      );
    });

    it('offers Edit as a button named for what it edits', async () => {
      const { tree } = await renderScreen();

      const edit = byTestId(tree, 'btn-edit-profile').find(
        node => node.props.accessibilityRole === 'button',
      );
      expect(edit?.props.accessibilityLabel).toBe('Edit profile');
    });

    it('drops a read that answers after the tab was left, then reads again', async () => {
      let releaseRead: () => void = () => {};
      jest.spyOn(ProfileStorageService, 'load').mockImplementationOnce(
        () =>
          new Promise<Profile>(resolve => {
            releaseRead = () => resolve({ ...DEFAULT_PROFILE, name: 'Stale' });
          }),
      );
      const { tree, goTo } = await renderScreen();
      await goTo('Elsewhere');

      await act(async () => {
        releaseRead();
      });
      await settle();
      expect(has(tree, 'text-profile-loading')).toBe(true);

      await updateProfile({ name: 'Marty McFly' });
      await goTo('SetupHome');
      expect(textOf(tree, 'text-profile-name')).toBe('Marty McFly');
    });

    it('picks up runs and drills saved while another tab was open', async () => {
      const { tree, goTo } = await renderScreen();
      expect(textOf(tree, 'text-profile-meta')).toBe('0 runs · 0 drills');

      await goTo('Elsewhere');
      await seedDrill();
      await seedRuns(1);
      await goTo('SetupHome');

      expect(textOf(tree, 'text-profile-meta')).toBe('1 run · 1 drill');
    });
  });

  describe('editing the profile', () => {
    it('opens the form in the box, with the stored name and handle', async () => {
      await updateProfile({ name: 'Marty McFly', handle: '@martymcfly' });
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');

      expect(has(tree, 'form-profile')).toBe(true);
      expect(has(tree, 'text-profile-name')).toBe(false);
      expect(byTestId(tree, 'input-profile-name')[0].props.value).toBe(
        'Marty McFly',
      );
      expect(byTestId(tree, 'input-profile-handle')[0].props.value).toBe(
        '@martymcfly',
      );
      // The settings stay below the form.
      expect(has(tree, 'row-appearance')).toBe(true);
    });

    it('says the handle is optional and only shown here', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');

      expect(textOf(tree, 'input-profile-handle-hint')).toBe(
        'Optional. Shown on your profile only.',
      );
    });

    it('saves what was typed and shows it as stored', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-name', '  Doc   Brown ');
      type(tree, 'input-profile-handle', 'doc.brown');
      await press(tree, 'btn-save-profile');

      expect(has(tree, 'form-profile')).toBe(false);
      expect(textOf(tree, 'text-profile-name')).toBe('Doc Brown');
      expect(textOf(tree, 'text-profile-meta')).toBe(
        '@doc.brown · 0 runs · 0 drills',
      );
      expect(await loadProfile()).toMatchObject({
        name: 'Doc Brown',
        handle: '@doc.brown',
      });
    });

    it('lets a padded name be typed in full and saves it collapsed', async () => {
      const { tree } = await renderScreen();
      const padded = `  ${'a'.repeat(20)}      ${'b'.repeat(19)}  `;

      await press(tree, 'btn-edit-profile');
      // More than the stored limit, typed with spaces that will collapse.
      expect(padded.length).toBeGreaterThan(MAX_PROFILE_NAME_LENGTH);
      expect(
        byTestId(tree, 'input-profile-name')[0].props.maxLength,
      ).toBeGreaterThanOrEqual(padded.length);
      type(tree, 'input-profile-name', padded);
      await press(tree, 'btn-save-profile');

      expect(textOf(tree, 'text-profile-name')).toBe(
        `${'a'.repeat(20)} ${'b'.repeat(19)}`,
      );
    });

    it('clears the name and handle when the fields are emptied', async () => {
      await updateProfile({ name: 'Marty McFly', handle: '@martymcfly' });
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-name', '');
      type(tree, 'input-profile-handle', '');
      await press(tree, 'btn-save-profile');

      expect(textOf(tree, 'text-profile-name')).toBe('No name set');
      expect(textOf(tree, 'text-profile-meta')).toBe('0 runs · 0 drills');
      expect(await loadProfile()).toMatchObject({ name: null, handle: null });
    });

    it('keeps the Appearance preference when the name is saved', async () => {
      await updateProfile({ appearance: 'dark' });
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-name', 'Doc Brown');
      await press(tree, 'btn-save-profile');

      expect((await loadProfile()).appearance).toBe('dark');
      expect(textOf(tree, 'text-theme-mode')).toBe('dark');
    });

    it('discards what was typed on cancel', async () => {
      await updateProfile({ name: 'Marty McFly' });
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-name', 'Biff Tannen');
      await press(tree, 'btn-cancel-profile');

      expect(has(tree, 'form-profile')).toBe(false);
      expect(textOf(tree, 'text-profile-name')).toBe('Marty McFly');
      expect((await loadProfile()).name).toBe('Marty McFly');

      // Reopening starts from the stored profile, not the abandoned draft.
      await press(tree, 'btn-edit-profile');
      expect(byTestId(tree, 'input-profile-name')[0].props.value).toBe(
        'Marty McFly',
      );
    });

    it('explains a handle that cannot be used, in place of the hint, and blocks the save', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      expect(saveButton(tree).props.disabled).toBe(false);

      type(tree, 'input-profile-handle', '@doc brown');

      expect(textOf(tree, 'input-profile-handle-error')).toMatch(/letters/);
      expect(has(tree, 'input-profile-handle-hint')).toBe(false);
      expect(saveButton(tree).props.disabled).toBe(true);

      await press(tree, 'btn-save-profile');

      expect(has(tree, 'form-profile')).toBe(true);
      expect(await loadProfile()).toEqual(DEFAULT_PROFILE);
    });

    it('allows the save again once the handle is fixed', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-handle', '@doc brown');
      type(tree, 'input-profile-handle', '@doc_brown');

      expect(has(tree, 'input-profile-handle-error')).toBe(false);
      expect(saveButton(tree).props.disabled).toBe(false);
    });

    it('keeps the form open with a message when the save fails', async () => {
      const update = jest
        .spyOn(ProfileStorageService, 'update')
        .mockRejectedValueOnce(
          new ProfileStorageError('disk full', 'STORAGE_FAILURE'),
        );
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-name', 'Doc Brown');
      await press(tree, 'btn-save-profile');

      expect(textOf(tree, 'text-profile-save-error')).toBe(
        'Could not save your profile. Try again.',
      );
      expect(byTestId(tree, 'input-profile-name')[0].props.value).toBe(
        'Doc Brown',
      );
      expect(saveButton(tree).props.disabled).toBe(false);

      // The mock only fails once, so a second press goes through.
      await press(tree, 'btn-save-profile');

      expect(update).toHaveBeenCalledTimes(2);
      expect(has(tree, 'form-profile')).toBe(false);
      expect(textOf(tree, 'text-profile-name')).toBe('Doc Brown');
    });

    it('does not show the service’s own wording for a rejected value', async () => {
      jest
        .spyOn(ProfileStorageService, 'update')
        .mockRejectedValueOnce(
          new ProfileStorageError('internal detail', 'INVALID_INPUT'),
        );
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      await press(tree, 'btn-save-profile');

      expect(textOf(tree, 'text-profile-save-error')).toBe(
        'That name or handle cannot be saved. Check them and try again.',
      );
    });

    it('locks the form while a save is in flight', async () => {
      let finishSave: (profile: Profile) => void = () => {};
      jest.spyOn(ProfileStorageService, 'update').mockImplementationOnce(
        () =>
          new Promise<Profile>(resolve => {
            finishSave = resolve;
          }),
      );
      const { tree } = await renderScreen();

      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-name', 'Doc Brown');
      await press(tree, 'btn-save-profile');

      expect(saveButton(tree).props.label).toBe('Saving…');
      expect(saveButton(tree).props.disabled).toBe(true);
      expect(byTestId(tree, 'btn-cancel-profile')[0].props.disabled).toBe(true);
      expect(byTestId(tree, 'input-profile-name')[0].props.editable).toBe(
        false,
      );

      await act(async () => {
        finishSave({ ...DEFAULT_PROFILE, name: 'Doc Brown' });
      });

      expect(has(tree, 'form-profile')).toBe(false);
      expect(textOf(tree, 'text-profile-name')).toBe('Doc Brown');
    });

    it('keeps a just-saved name when an older read lands after it', async () => {
      await updateProfile({ name: 'Marty McFly' });
      const { tree, goTo } = await renderScreen();
      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-name', 'Doc Brown');

      // The refresh on returning to the tab reads the profile before the
      // save below, but only answers after it.
      const realLoad = ProfileStorageService.load;
      let releaseRead: () => void = () => {};
      jest.spyOn(ProfileStorageService, 'load').mockImplementationOnce(() => {
        const staleRead = realLoad();
        return new Promise<Profile>(resolve => {
          releaseRead = () => resolve(staleRead);
        });
      });
      await goTo('Elsewhere');
      await goTo('SetupHome');

      await press(tree, 'btn-save-profile');
      expect(textOf(tree, 'text-profile-name')).toBe('Doc Brown');

      await act(async () => {
        releaseRead();
      });
      await settle();

      expect(textOf(tree, 'text-profile-name')).toBe('Doc Brown');
    });
  });

  describe('when the profile cannot be read', () => {
    it('says so in the box, keeps every setting, and recovers on retry', async () => {
      jest
        .spyOn(ProfileStorageService, 'load')
        .mockRejectedValueOnce(
          new ProfileStorageError('unreadable', 'STORAGE_FAILURE'),
        );
      await updateProfile({ name: 'Marty McFly' });

      const { tree } = await renderScreen();

      expect(has(tree, 'state-profile-error')).toBe(true);
      expect(textsUnder(tree, 'state-profile-error')).toContain(
        'Could not load your profile',
      );
      expect(has(tree, 'text-profile-name')).toBe(false);
      expect(has(tree, 'text-profile-meta')).toBe(false);
      [
        'row-calibration',
        'row-sensitivity',
        'row-start-delay',
        'row-beep-volume',
        'row-appearance',
        'row-level-unit',
        'row-clear-history',
      ].forEach(row => expect(has(tree, row)).toBe(true));

      const retry = tree.root.findAllByProps({ label: 'Try again' })[0];
      await act(async () => {
        retry.props.onPress();
      });
      await settle();

      expect(has(tree, 'state-profile-error')).toBe(false);
      expect(textOf(tree, 'text-profile-name')).toBe('Marty McFly');
    });

    it('keeps the profile and a half-typed edit when a refresh fails', async () => {
      await updateProfile({ name: 'Marty McFly' });
      await seedDrill();
      const { tree, goTo } = await renderScreen();
      await press(tree, 'btn-edit-profile');
      type(tree, 'input-profile-name', 'Doc Brown');

      jest
        .spyOn(ProfileStorageService, 'load')
        .mockRejectedValueOnce(
          new ProfileStorageError('unreadable', 'STORAGE_FAILURE'),
        );
      await goTo('Elsewhere');
      await goTo('SetupHome');

      expect(has(tree, 'state-profile-error')).toBe(false);
      expect(byTestId(tree, 'input-profile-name')[0].props.value).toBe(
        'Doc Brown',
      );

      // The next visit reads again, and this time storage answers.
      await press(tree, 'btn-cancel-profile');
      await seedDrill();
      await goTo('Elsewhere');
      await goTo('SetupHome');

      expect(textOf(tree, 'text-profile-meta')).toBe('0 runs · 2 drills');
    });
  });

  describe('Calibration', () => {
    it('says no sound is calibrated yet, flagged, on a fresh launch', async () => {
      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-calibration')).toBe('0 of 3 sounds');
      expect(byTestId(tree, 'row-calibration')[0].props.valueColor).toBe(
        'warning',
      );
      expect(labelOf(tree, 'row-calibration')).toBe(
        'Calibration, 0 of 3 sounds calibrated',
      );
    });

    it('counts each sound as it is calibrated, and drops the flag once all are', async () => {
      const { tree } = await renderScreen();

      act(() => {
        calibrate('shot', -10);
        calibrate('reload', -20);
      });
      expect(valueOf(tree, 'row-calibration')).toBe('2 of 3 sounds');
      expect(byTestId(tree, 'row-calibration')[0].props.valueColor).toBe(
        'warning',
      );

      act(() => {
        calibrate('rack', -15);
      });
      expect(valueOf(tree, 'row-calibration')).toBe('3 of 3 sounds');
      expect(byTestId(tree, 'row-calibration')[0].props.valueColor).toBe(
        'textSecondary',
      );
    });

    it('is a button with a chevron that opens Calibration', async () => {
      const { tree, currentRoute } = await renderScreen();

      const row = byTestId(tree, 'row-calibration');
      expect(row[0].props.chevron).toBe(true);
      expect(row.some(node => node.props.accessibilityRole === 'button')).toBe(
        true,
      );

      await press(tree, 'row-calibration');

      expect(currentRoute()).toBe('Calibration');
    });

    it('opens Calibration while the profile is still loading or unreadable', async () => {
      failProfileRead();
      const { tree, currentRoute } = await renderScreen();
      expect(has(tree, 'state-profile-error')).toBe(true);

      await press(tree, 'row-calibration');

      expect(currentRoute()).toBe('Calibration');
    });
  });

  describe('Sensitivity', () => {
    it('sits under Microphone, after Calibration', async () => {
      const { tree } = await renderScreen();

      const rows = tree.root
        .findAll(node =>
          ['row-calibration', 'row-sensitivity'].includes(node.props.testID),
        )
        .map(node => node.props.testID);
      expect(rows.indexOf('row-calibration')).toBeLessThan(
        rows.indexOf('row-sensitivity'),
      );
    });

    it('is Normal until one is chosen', async () => {
      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-sensitivity')).toBe('Normal');
    });

    it('shows the stored sensitivity, and names it for a screen reader', async () => {
      await updateProfile({ sensitivity: 'high' });

      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-sensitivity')).toBe('High');
      expect(labelOf(tree, 'row-sensitivity')).toBe('Sensitivity, High');
    });

    it('opens the picker with the stored choice checked and each explained', async () => {
      await updateProfile({ sensitivity: 'low' });
      const { tree } = await renderScreen();

      expect(byTestId(tree, 'opt-sensitivity-low')).toHaveLength(0);
      await press(tree, 'row-sensitivity');

      const option = (level: string) =>
        byTestId(tree, `opt-sensitivity-${level}`)[0];
      expect(option('low').props.accessibilityState.checked).toBe(true);
      expect(option('normal').props.accessibilityState.checked).toBe(false);
      expect(option('high').props.accessibilityState.checked).toBe(false);
      expect(option('low').props.accessibilityLabel).toBe(
        'Low, Fewer false shots',
      );
      expect(option('high').props.accessibilityLabel).toBe(
        'High, Fewer missed shots',
      );
    });

    it('switches the sensitivity at once and stores the choice', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'row-sensitivity');
      await press(tree, 'opt-sensitivity-high');

      expect(valueOf(tree, 'row-sensitivity')).toBe('High');
      expect(byTestId(tree, 'opt-sensitivity-high')).toHaveLength(0);
      expect((await loadProfile()).sensitivity).toBe('high');
    });

    it('changes nothing when the picker is closed without a choice', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'row-sensitivity');
      await press(tree, 'btn-sensitivity-close');

      expect(byTestId(tree, 'opt-sensitivity-high')).toHaveLength(0);
      expect(valueOf(tree, 'row-sensitivity')).toBe('Normal');
      expect((await loadProfile()).updatedAt).toBeNull();
    });

    it('puts the old sensitivity back and says so when the save fails', async () => {
      const { tree } = await renderScreen(failingStorage);

      await press(tree, 'row-sensitivity');
      await press(tree, 'opt-sensitivity-low');

      expect(valueOf(tree, 'row-sensitivity')).toBe('Normal');
      expect(textOf(tree, 'text-sensitivity-error')).toBe(
        'Could not save the sensitivity. Try again.',
      );
      expect((await loadProfile()).sensitivity).toBe('normal');
    });
  });

  describe('Timer', () => {
    /** Whether a control is read as disabled. */
    const isDisabled = (tree: ReactTestRenderer, testID: string): boolean =>
      byTestId(tree, testID).some(
        node => node.props.accessibilityState?.disabled === true,
      );

    /** Press a stepper button `times` times. */
    const pressTimes = async (
      tree: ReactTestRenderer,
      testID: string,
      times: number,
    ) => {
      for (let i = 0; i < times; i += 1) {
        await press(tree, testID);
      }
    };

    const isChecked = (tree: ReactTestRenderer, volume: string): boolean =>
      byTestId(tree, `opt-beep-volume-${volume}`)[0].props.accessibilityState
        .checked;

    /** Stand in for the audio output, recording each test beep's volume. */
    const spyOnTestBeep = () =>
      jest.spyOn(StartSequenceService, 'testBeep').mockResolvedValue();

    describe('Start delay', () => {
      it('is a random 1 to 5 s until one is chosen', async () => {
        const { tree } = await renderScreen();

        expect(valueOf(tree, 'row-start-delay')).toBe('Random, 1 to 5 s');
        expect(labelOf(tree, 'row-start-delay')).toBe(
          'Start delay, Random, 1 to 5 seconds',
        );
      });

      it('shows the stored range, and a fixed delay as fixed', async () => {
        await updateProfile({ startDelay: { minMs: 2500, maxMs: 2500 } });

        const { tree } = await renderScreen();

        expect(valueOf(tree, 'row-start-delay')).toBe('Fixed, 2.5 s');
      });

      it('opens the picker on the stored range', async () => {
        await updateProfile({ startDelay: { minMs: 1500, maxMs: 4000 } });
        const { tree } = await renderScreen();

        await press(tree, 'row-start-delay');

        expect(textOf(tree, 'stepper-start-delay-min-value')).toBe('1.5 s');
        expect(textOf(tree, 'stepper-start-delay-max-value')).toBe('4 s');
        expect(textOf(tree, 'text-start-delay-summary')).toBe(
          'Random, 1.5 to 4 s',
        );
      });

      it('moves each end in half-second steps and stores the range on Save', async () => {
        const { tree } = await renderScreen();
        await press(tree, 'row-start-delay');

        await press(tree, 'stepper-start-delay-min-longer');
        await pressTimes(tree, 'stepper-start-delay-max-longer', 3);
        expect(textOf(tree, 'text-start-delay-summary')).toBe(
          'Random, 1.5 to 6.5 s',
        );
        await press(tree, 'btn-start-delay-save');

        expect(has(tree, 'btn-start-delay-save')).toBe(false);
        expect(valueOf(tree, 'row-start-delay')).toBe('Random, 1.5 to 6.5 s');
        expect((await loadProfile()).startDelay).toEqual({
          minMs: 1500,
          maxMs: 6500,
        });
      });

      it('says each end in words for a screen reader', async () => {
        const { tree } = await renderScreen();

        await press(tree, 'row-start-delay');

        expect(labelOf(tree, 'stepper-start-delay-min-value')).toBe(
          'Shortest delay, 1 second',
        );
        expect(labelOf(tree, 'stepper-start-delay-max-shorter')).toBe(
          'Shorten the longest delay',
        );
      });

      it('will not let the shortest pass the longest, and saves equal ends as a fixed delay', async () => {
        await updateProfile({ startDelay: { minMs: 2000, maxMs: 3000 } });
        const { tree } = await renderScreen();
        await press(tree, 'row-start-delay');

        await pressTimes(tree, 'stepper-start-delay-min-longer', 5);

        expect(textOf(tree, 'stepper-start-delay-min-value')).toBe('3 s');
        expect(isDisabled(tree, 'stepper-start-delay-min-longer')).toBe(true);
        expect(isDisabled(tree, 'stepper-start-delay-max-shorter')).toBe(true);
        expect(textOf(tree, 'text-start-delay-summary')).toBe('Fixed, 3 s');

        await press(tree, 'btn-start-delay-save');

        expect((await loadProfile()).startDelay).toEqual({
          minMs: 3000,
          maxMs: 3000,
        });
      });

      it('will not let the longest go below the shortest', async () => {
        await updateProfile({ startDelay: { minMs: 2000, maxMs: 3000 } });
        const { tree } = await renderScreen();
        await press(tree, 'row-start-delay');

        await pressTimes(tree, 'stepper-start-delay-max-shorter', 5);

        expect(textOf(tree, 'stepper-start-delay-max-value')).toBe('2 s');
        expect(isDisabled(tree, 'stepper-start-delay-max-shorter')).toBe(true);
      });

      it('stops at one second and at ten seconds', async () => {
        const { tree } = await renderScreen();
        await press(tree, 'row-start-delay');

        await pressTimes(tree, 'stepper-start-delay-min-shorter', 3);
        await pressTimes(tree, 'stepper-start-delay-max-longer', 15);

        expect(textOf(tree, 'stepper-start-delay-min-value')).toBe('1 s');
        expect(textOf(tree, 'stepper-start-delay-max-value')).toBe('10 s');
        expect(isDisabled(tree, 'stepper-start-delay-min-shorter')).toBe(true);
        expect(isDisabled(tree, 'stepper-start-delay-max-longer')).toBe(true);
        expect(isDisabled(tree, 'stepper-start-delay-min-longer')).toBe(false);
        expect(isDisabled(tree, 'stepper-start-delay-max-shorter')).toBe(false);
      });

      it('keeps nothing when the picker is cancelled, and opens fresh next time', async () => {
        const { tree } = await renderScreen();
        await press(tree, 'row-start-delay');
        await pressTimes(tree, 'stepper-start-delay-max-longer', 2);

        await press(tree, 'btn-start-delay-cancel');

        expect(has(tree, 'btn-start-delay-save')).toBe(false);
        expect(valueOf(tree, 'row-start-delay')).toBe('Random, 1 to 5 s');
        expect((await loadProfile()).updatedAt).toBeNull();

        await press(tree, 'row-start-delay');
        expect(textOf(tree, 'stepper-start-delay-max-value')).toBe('5 s');
      });

      it('opens on the saved range after an edit was dismissed', async () => {
        await updateProfile({ startDelay: { minMs: 2000, maxMs: 3000 } });
        const { tree } = await renderScreen();
        await press(tree, 'row-start-delay');
        await pressTimes(tree, 'stepper-start-delay-min-longer', 2);
        await press(tree, 'btn-start-delay-close');

        await press(tree, 'row-start-delay');

        expect(textOf(tree, 'stepper-start-delay-min-value')).toBe('2 s');
        expect(textOf(tree, 'text-start-delay-summary')).toBe(
          'Random, 2 to 3 s',
        );
      });

      it('keeps nothing when the picker is dismissed from the backdrop', async () => {
        const { tree } = await renderScreen();
        await press(tree, 'row-start-delay');
        await press(tree, 'stepper-start-delay-max-longer');

        await press(tree, 'btn-start-delay-close');

        expect(has(tree, 'btn-start-delay-save')).toBe(false);
        expect((await loadProfile()).updatedAt).toBeNull();
      });

      it('puts the old range back and says so when the save fails', async () => {
        const { tree } = await renderScreen(failingStorage);
        await press(tree, 'row-start-delay');
        await press(tree, 'stepper-start-delay-max-longer');

        await press(tree, 'btn-start-delay-save');

        expect(valueOf(tree, 'row-start-delay')).toBe('Random, 1 to 5 s');
        expect(textOf(tree, 'text-start-delay-error')).toBe(
          'Could not save the start delay. Try again.',
        );
        expect(
          byTestId(tree, 'text-start-delay-error').some(
            node => node.props.accessibilityLiveRegion === 'polite',
          ),
        ).toBe(true);
        expect((await loadProfile()).startDelay).toEqual({
          minMs: 1000,
          maxMs: 5000,
        });
      });

      it('leaves the other preferences alone', async () => {
        await updateProfile({ appearance: 'dark', beepVolume: 'medium' });
        const { tree } = await renderScreen();
        await press(tree, 'row-start-delay');
        await press(tree, 'stepper-start-delay-min-longer');

        await press(tree, 'btn-start-delay-save');

        const profile = await loadProfile();
        expect(profile.appearance).toBe('dark');
        expect(profile.beepVolume).toBe('medium');
        expect(textOf(tree, 'text-theme-mode')).toBe('dark');
      });
    });

    describe('Beep volume', () => {
      it('is Full until one is chosen', async () => {
        const { tree } = await renderScreen();

        expect(valueOf(tree, 'row-beep-volume')).toBe('Full');
      });

      it('opens the picker with the stored volume checked', async () => {
        await updateProfile({ beepVolume: 'quiet' });
        const { tree } = await renderScreen();

        await press(tree, 'row-beep-volume');

        expect(isChecked(tree, 'quiet')).toBe(true);
        expect(isChecked(tree, 'full')).toBe(false);
        expect(isChecked(tree, 'medium')).toBe(false);
      });

      it('stores a chosen volume at once and keeps the picker open', async () => {
        const { tree } = await renderScreen();
        await press(tree, 'row-beep-volume');

        await press(tree, 'opt-beep-volume-medium');

        expect(isChecked(tree, 'medium')).toBe(true);
        expect(has(tree, 'btn-test-beep')).toBe(true);
        expect(valueOf(tree, 'row-beep-volume')).toBe('Medium');
        expect((await loadProfile()).beepVolume).toBe('medium');
      });

      it('closes with Done', async () => {
        const { tree } = await renderScreen();
        await press(tree, 'row-beep-volume');

        await press(tree, 'btn-beep-volume-done');

        expect(has(tree, 'btn-test-beep')).toBe(false);
      });

      it('plays the test beep at full volume by default', async () => {
        const testBeep = spyOnTestBeep();
        const { tree } = await renderScreen();
        await press(tree, 'row-beep-volume');

        await press(tree, 'btn-test-beep');

        expect(testBeep).toHaveBeenCalledTimes(1);
        expect(testBeep.mock.calls[0][0]).toEqual({
          ...StartSequenceService.beep,
          volume: 1,
        });
      });

      it('plays the test beep at the volume just chosen', async () => {
        const testBeep = spyOnTestBeep();
        const { tree } = await renderScreen();
        await press(tree, 'row-beep-volume');

        await press(tree, 'opt-beep-volume-quiet');
        await press(tree, 'btn-test-beep');
        await press(tree, 'opt-beep-volume-medium');
        await press(tree, 'btn-test-beep');

        expect(testBeep.mock.calls.map(([beep]) => beep?.volume)).toEqual([
          0.25, 0.5,
        ]);
      });

      it('names the volume a test beep will play at for a screen reader', async () => {
        await updateProfile({ beepVolume: 'medium' });
        const { tree } = await renderScreen();

        await press(tree, 'row-beep-volume');

        expect(labelOf(tree, 'btn-test-beep')).toBe('Test beep, Medium');
      });

      it('says so when the test beep cannot be played', async () => {
        jest
          .spyOn(StartSequenceService, 'testBeep')
          .mockRejectedValue(new StartSequenceError('no output'));
        const { tree } = await renderScreen();
        await press(tree, 'row-beep-volume');

        await press(tree, 'btn-test-beep');

        expect(textOf(tree, 'text-beep-volume-error')).toBe(
          'Could not play the beep. Check the phone is not muted.',
        );
      });

      it('clears the test beep error once a beep plays', async () => {
        const testBeep = jest
          .spyOn(StartSequenceService, 'testBeep')
          .mockRejectedValueOnce(new StartSequenceError('no output'))
          .mockResolvedValue();
        const { tree } = await renderScreen();
        await press(tree, 'row-beep-volume');
        await press(tree, 'btn-test-beep');
        expect(has(tree, 'text-beep-volume-error')).toBe(true);

        await press(tree, 'btn-test-beep');

        expect(testBeep).toHaveBeenCalledTimes(2);
        expect(has(tree, 'text-beep-volume-error')).toBe(false);
      });

      it('puts the old volume back and says so when the save fails', async () => {
        const { tree } = await renderScreen(failingStorage);
        await press(tree, 'row-beep-volume');

        await press(tree, 'opt-beep-volume-medium');

        expect(isChecked(tree, 'full')).toBe(true);
        expect(isChecked(tree, 'medium')).toBe(false);
        expect(textOf(tree, 'text-beep-volume-error')).toBe(
          'Could not save the beep volume. Try again.',
        );
        await press(tree, 'btn-beep-volume-done');
        expect(valueOf(tree, 'row-beep-volume')).toBe('Full');
        expect((await loadProfile()).beepVolume).toBe('full');

        // Shown once, in the sheet: opening it again starts clean.
        await press(tree, 'row-beep-volume');
        expect(has(tree, 'text-beep-volume-error')).toBe(false);
      });

      it('shows no error for a test beep that fails after the sheet was closed', async () => {
        let fail: () => void = () => {};
        jest.spyOn(StartSequenceService, 'testBeep').mockImplementationOnce(
          () =>
            new Promise<void>((_, reject) => {
              fail = () => reject(new StartSequenceError('no output'));
            }),
        );
        const { tree } = await renderScreen();
        await press(tree, 'row-beep-volume');
        await press(tree, 'btn-test-beep');
        await press(tree, 'btn-beep-volume-done');

        await act(async () => {
          fail();
        });
        await settle();
        await press(tree, 'row-beep-volume');

        expect(has(tree, 'text-beep-volume-error')).toBe(false);
      });

      it('shows no error for a test beep overtaken by a newer choice', async () => {
        let fail: () => void = () => {};
        jest.spyOn(StartSequenceService, 'testBeep').mockImplementationOnce(
          () =>
            new Promise<void>((_, reject) => {
              fail = () => reject(new StartSequenceError('no output'));
            }),
        );
        const { tree } = await renderScreen();
        await press(tree, 'row-beep-volume');
        await press(tree, 'btn-test-beep');
        await press(tree, 'opt-beep-volume-medium');

        await act(async () => {
          fail();
        });
        await settle();

        expect(has(tree, 'text-beep-volume-error')).toBe(false);
        expect(isChecked(tree, 'medium')).toBe(true);
      });
    });
  });

  describe('Appearance', () => {
    it('says Appearance follows the device until a theme is chosen', async () => {
      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-appearance')).toBe('System');
      expect(labelOf(tree, 'row-appearance')).toBe(
        'Appearance, follows your device setting',
      );
    });

    it('shows the stored Appearance preference', async () => {
      await updateProfile({ appearance: 'dark' });

      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-appearance')).toBe('Dark');
      expect(labelOf(tree, 'row-appearance')).toBe('Appearance, Dark');
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
      expect(valueOf(tree, 'row-appearance')).toBe('Dark');
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
      expect(valueOf(tree, 'row-appearance')).toBe('System');
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
      expect(valueOf(tree, 'row-appearance')).toBe('Light');
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

      expect(valueOf(tree, 'row-level-unit')).toBe('Level');
      expect(textOf(tree, 'text-level-unit')).toBe('level');
    });

    it('shows the stored unit', async () => {
      await updateProfile({ levelUnit: 'dbfs' });

      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-level-unit')).toBe('dBFS');
    });

    it('names the unit in words for a screen reader', async () => {
      await updateProfile({ levelUnit: 'dbfs' });

      const { tree } = await renderScreen();

      expect(labelOf(tree, 'row-level-unit')).toBe(
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
      expect(valueOf(tree, 'row-level-unit')).toBe('dBFS');
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
      expect(valueOf(tree, 'row-level-unit')).toBe('Level');
      expect(textOf(tree, 'text-level-unit-error')).toBe(
        'Could not save your level units. Try again.',
      );
      expect(has(tree, 'text-appearance-error')).toBe(false);
      expect((await loadProfile()).levelUnit).toBe('level');
    });
  });

  describe('Data', () => {
    const SHEET = 'sheet-clear-history';

    /** What a screen reader is told about the row's state. */
    const rowState = (tree: ReactTestRenderer) =>
      byTestId(tree, 'row-clear-history').find(
        node => node.props.accessibilityState !== undefined,
      )?.props.accessibilityState;

    const isAsking = (tree: ReactTestRenderer): boolean =>
      has(tree, `${SHEET}-confirm`);

    /**
     * Run counts that never answer, or always fail. The profile box counts
     * runs too, so the count is stubbed for every read rather than one.
     */
    const stallRunCount = () =>
      jest
        .spyOn(SessionStorageService, 'count')
        .mockImplementation(() => new Promise<number>(() => {}));
    const failRunCount = () =>
      jest
        .spyOn(SessionStorageService, 'count')
        .mockRejectedValue(
          new SessionStorageError('unreadable', 'STORAGE_FAILURE'),
        );

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

    it('offers to clear the history, styled as destructive', async () => {
      await seedRuns(1);

      const { tree } = await renderScreen();

      expect(byTestId(tree, 'row-clear-history')[0].props.destructive).toBe(
        true,
      );
      expect(byTestId(tree, 'row-clear-history')[0].props.chevron).toBe(true);
      expect(rowState(tree)).toEqual({ disabled: false });
    });

    it('says how many runs are saved', async () => {
      await seedRuns(3);

      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-clear-history')).toBe('3 runs');
      expect(labelOf(tree, 'row-clear-history')).toBe(
        'Clear run history, 3 saved runs',
      );
    });

    it('is disabled when there are no runs', async () => {
      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-clear-history')).toBe('No runs');
      expect(labelOf(tree, 'row-clear-history')).toBe(
        'Clear run history, no saved runs',
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
      stallRunCount();

      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-clear-history')).toBe('…');
      expect(labelOf(tree, 'row-clear-history')).toBe(
        'Clear run history, counting saved runs',
      );
      expect(rowState(tree)).toEqual({ disabled: true });
    });

    it('still offers to clear when the runs cannot be counted', async () => {
      await seedRuns(2);
      failRunCount();
      const { tree } = await renderScreen();
      expect(valueOf(tree, 'row-clear-history')).toBeUndefined();
      expect(rowState(tree)).toEqual({ disabled: false });

      await press(tree, 'row-clear-history');

      expect(textsUnder(tree, SHEET)).toContain('Delete every saved run?');
    });

    it('clears runs it could not count, and says every run went', async () => {
      const announce = silenceAnnouncements();
      await seedRuns(2);
      failRunCount();
      const { tree } = await renderScreen();
      await press(tree, 'row-clear-history');

      await press(tree, `${SHEET}-confirm`);

      jest.restoreAllMocks();
      expect(await countSessions()).toBe(0);
      expect(valueOf(tree, 'row-clear-history')).toBe('No runs');
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
        'primary',
      );
      expect(await countSessions()).toBe(37);
    });

    it('says "run" for a single run', async () => {
      await seedRuns(1);
      const { tree } = await renderScreen();

      expect(valueOf(tree, 'row-clear-history')).toBe('1 run');
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
      expect(valueOf(tree, 'row-clear-history')).toBe('2 runs');
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
      expect(valueOf(tree, 'row-clear-history')).toBe('No runs');
      expect(rowState(tree)).toEqual({ disabled: true });
      expect(announce).toHaveBeenCalledWith('Deleted 3 runs');
    });

    it('counts the profile box down to 0 runs once the history is cleared', async () => {
      silenceAnnouncements();
      await seedDrill();
      await seedRuns(2);
      const { tree } = await renderScreen();
      expect(textOf(tree, 'text-profile-meta')).toBe('2 runs · 1 drill');

      await press(tree, 'row-clear-history');
      await press(tree, `${SHEET}-confirm`);

      expect(textOf(tree, 'text-profile-meta')).toBe('0 runs · 1 drill');
    });

    it('counts runs saved since the screen was last shown', async () => {
      await seedRuns(1);
      const { tree, goTo } = await renderScreen();
      await goTo('Elsewhere');

      await seedRuns(1);
      await goTo('SetupHome');

      expect(valueOf(tree, 'row-clear-history')).toBe('2 runs');
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
      expect(valueOf(tree, 'row-clear-history')).toBe('2 runs');
      expect(textOf(tree, 'text-profile-meta')).toBe('2 runs · 0 drills');
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

    it('gives the version from package.json and says the data stays on the phone', async () => {
      const { version } = jest.requireActual<{ version: string }>(
        '../package.json',
      );

      const { tree } = await renderScreen();

      expect(APP_VERSION).toBe(version);
      expect(textOf(tree, 'text-about')).toBe(
        `Version ${version}. Everything is stored only on this phone. There is no account, and nothing is sent anywhere.`,
      );
    });
  });
});
