import { Text } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useLevelUnit } from '../src/hooks/useLevelUnit';
import { useTheme } from '../src/hooks/useTheme';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import {
  ProfileStorageError,
  loadProfile,
  updateProfile,
} from '../src/services/profileStorage';
import {
  StartSequenceError,
  StartSequenceService,
} from '../src/services/startSequence';
import {
  PreferencesProvider,
  type PreferencesProviderProps,
} from '../src/store/PreferencesContext';
import type { Profile } from '../src/types/profile';

type TestTabParamList = {
  Profile: undefined;
  Settings: undefined;
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const Tab = createBottomTabNavigator<TestTabParamList>();

/** Stands in for the Profile screen Settings is opened from. */
const Blank = () => null;

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
              <Tab.Screen name="Profile" component={Blank} />
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

    it('groups Start delay and Beep volume under Timer, after Display', async () => {
      const { tree } = await renderScreen();

      const headers = tree.root
        .findAll(
          node =>
            typeof node.props.title === 'string' &&
            ['Display', 'Timer'].includes(node.props.title) &&
            node.props.testID === undefined &&
            node.props.onPress === undefined,
        )
        .map(node => node.props.title);
      expect(headers.indexOf('Display')).toBeLessThan(headers.indexOf('Timer'));
      expect(has(tree, 'row-start-delay')).toBe(true);
      expect(has(tree, 'row-beep-volume')).toBe(true);
    });

    describe('Start delay', () => {
      it('is a random 1 to 5 s until one is chosen', async () => {
        const { tree } = await renderScreen();

        expect(subtitleOf(tree, 'row-start-delay')).toBe('Random, 1 to 5 s');
        expect(
          byTestId(tree, 'row-start-delay')[0].props.accessibilityLabel,
        ).toBe('Start delay, Random, 1 to 5 seconds');
      });

      it('shows the stored range, and a fixed delay as fixed', async () => {
        await updateProfile({ startDelay: { minMs: 2500, maxMs: 2500 } });

        const { tree } = await renderScreen();

        expect(subtitleOf(tree, 'row-start-delay')).toBe('Fixed, 2.5 s');
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
        expect(subtitleOf(tree, 'row-start-delay')).toBe(
          'Random, 1.5 to 6.5 s',
        );
        expect((await loadProfile()).startDelay).toEqual({
          minMs: 1500,
          maxMs: 6500,
        });
      });

      it('says each end in words for a screen reader', async () => {
        const { tree } = await renderScreen();

        await press(tree, 'row-start-delay');

        expect(
          byTestId(tree, 'stepper-start-delay-min-value')[0].props
            .accessibilityLabel,
        ).toBe('Shortest delay, 1 second');
        expect(
          byTestId(tree, 'stepper-start-delay-max-shorter')[0].props
            .accessibilityLabel,
        ).toBe('Shorten the longest delay');
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
        expect(subtitleOf(tree, 'row-start-delay')).toBe('Random, 1 to 5 s');
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

        expect(subtitleOf(tree, 'row-start-delay')).toBe('Random, 1 to 5 s');
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

        expect(subtitleOf(tree, 'row-beep-volume')).toBe('Full');
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
        expect(subtitleOf(tree, 'row-beep-volume')).toBe('Medium');
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

        expect(
          byTestId(tree, 'btn-test-beep')[0].props.accessibilityLabel,
        ).toBe('Test beep, Medium');
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
        expect(subtitleOf(tree, 'row-beep-volume')).toBe('Full');
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
});
