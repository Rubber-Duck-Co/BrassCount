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
});
