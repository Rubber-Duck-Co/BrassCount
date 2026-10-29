import type { ReactElement } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MainTabs } from '../src/navigation/MainTabs';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { CalibrationProvider } from '../src/store/CalibrationContext';
import { PreferencesProvider } from '../src/store/PreferencesContext';
import type { MainTabParamList } from '../src/types/navigation';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Let storage reads land, and the frame the native stack waits for before
 * it acts on a tab press (`requestAnimationFrame` is a timer under Jest).
 */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0);
    });
    await new Promise<void>(resolve => {
      setImmediate(resolve);
    });
  });
};

const mounted: ReactTestRenderer[] = [];

/** The providers `App` mounts above the navigators. */
const mount = async (navigators: ReactElement): Promise<ReactTestRenderer> => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={metrics}>
          <PreferencesProvider>
            <CalibrationProvider>{navigators}</CalibrationProvider>
          </PreferencesProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>,
      // Host elements get a stand-in, so screens have a ref to focus.
      { createNodeMock: () => ({}) },
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  mounted.push(tree);
  await settle();
  return tree;
};

/** The tabs in their own container, so a test can read where it is. */
const renderTabs = async () => {
  const navigationRef = createNavigationContainerRef<MainTabParamList>();
  const tree = await mount(
    <NavigationContainer ref={navigationRef}>
      <MainTabs />
    </NavigationContainer>,
  );

  return {
    tree,
    navigationRef,
    currentRoute: () => navigationRef.getCurrentRoute()?.name,
    /** The routes stacked in one tab, bottom first. */
    stackIn: (tab: keyof MainTabParamList): string[] | undefined =>
      navigationRef
        .getRootState()
        ?.routes.find(route => route.name === tab)
        ?.state?.routes.map(route => route.name),
  };
};

const byTestId = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID });

const press = async (tree: ReactTestRenderer, testID: string) => {
  await act(async () => {
    byTestId(tree, testID)[0].props.onPress();
  });
  await settle();
};

/** The tab bar's buttons, left to right, by what a screen reader calls them. */
const tabLabels = (tree: ReactTestRenderer): string[] =>
  tree.root
    .findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('tab-') &&
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function',
    )
    .map(node => node.props.accessibilityLabel as string)
    .filter((label, index, labels) => labels.indexOf(label) === index);

/** Whether the tab bar shows this tab as the one in use. */
const isSelected = (tree: ReactTestRenderer, tab: string): boolean =>
  byTestId(tree, `tab-${tab}`)[0].props.accessibilityState?.selected === true;

const nameField = (tree: ReactTestRenderer) =>
  byTestId(tree, 'input-drill-name').find(
    node => typeof node.props.onChangeText === 'function',
  );

const typeName = (tree: ReactTestRenderer, text: string) => {
  act(() => {
    nameField(tree)?.props.onChangeText(text);
  });
};

describe('navigation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    // Unmount, or the navigator's pending work outlives the test.
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
  });

  describe('the app', () => {
    it('shows Timer, Drills, Log and Setup tabs, in that order', async () => {
      const tree = await mount(<RootNavigator />);

      expect(tabLabels(tree)).toEqual(['Timer', 'Drills', 'Log', 'Setup']);
    });

    it('opens the Setup screen from the Setup tab', async () => {
      const { tree, currentRoute } = await renderTabs();

      await press(tree, 'tab-Setup');

      expect(currentRoute()).toBe('SetupHome');
      expect(byTestId(tree, 'screen-setup')).not.toHaveLength(0);
    });

    it('lands on the Timer', async () => {
      const tree = await mount(<RootNavigator />);

      expect(isSelected(tree, 'Timer')).toBe(true);
      expect(byTestId(tree, 'screen-timer')).not.toHaveLength(0);
    });
  });

  describe('keeping the tab bar', () => {
    it('keeps it on the drill editor, with Drills selected', async () => {
      const { tree, currentRoute } = await renderTabs();

      await press(tree, 'tab-Drills');
      await press(tree, 'btn-create-drill');

      expect(currentRoute()).toBe('SequenceEditor');
      expect(isSelected(tree, 'Drills')).toBe(true);
    });

    it('keeps it on Calibration, with Setup selected', async () => {
      const { tree, currentRoute } = await renderTabs();

      await press(tree, 'tab-Setup');
      await press(tree, 'row-calibration');

      expect(currentRoute()).toBe('Calibration');
      expect(isSelected(tree, 'Setup')).toBe(true);
    });

    it('keeps it on a run comparison, with Log selected', async () => {
      const { tree, navigationRef, currentRoute } = await renderTabs();

      act(() => {
        navigationRef.navigate('Log', {
          screen: 'RunComparison',
          params: { drillId: 'drill-1', runIds: ['run-1', 'run-2'] },
        });
      });
      await settle();

      expect(currentRoute()).toBe('RunComparison');
      expect(isSelected(tree, 'Log')).toBe(true);
    });
  });

  describe('an unsaved drill', () => {
    it('survives switching to another tab and back', async () => {
      const { tree, currentRoute } = await renderTabs();
      await press(tree, 'tab-Drills');
      await press(tree, 'btn-create-drill');
      typeName(tree, 'ZZ Draft');

      await press(tree, 'tab-Timer');
      await press(tree, 'tab-Drills');

      expect(currentRoute()).toBe('SequenceEditor');
      expect(nameField(tree)?.props.value).toBe('ZZ Draft');
    });

    it('survives pressing the Drills tab while the editor is open', async () => {
      const { tree, currentRoute, stackIn } = await renderTabs();
      await press(tree, 'tab-Drills');
      await press(tree, 'btn-create-drill');
      typeName(tree, 'ZZ Draft');

      await press(tree, 'tab-Drills');

      expect(currentRoute()).toBe('SequenceEditor');
      expect(stackIn('Drills')).toEqual(['DrillList', 'SequenceEditor']);
      expect(nameField(tree)?.props.value).toBe('ZZ Draft');
    });
  });

  describe('the Timer’s jumps', () => {
    it('opens the editor in Drills over the list when there is no drill', async () => {
      const { tree, currentRoute, stackIn } = await renderTabs();

      await act(async () => {
        byTestId(tree, 'state-timer-drills-empty')[0]
          .findAllByProps({ accessibilityRole: 'button' })[0]
          .props.onPress();
      });
      await settle();

      expect(currentRoute()).toBe('SequenceEditor');
      expect(isSelected(tree, 'Drills')).toBe(true);
      expect(stackIn('Drills')).toEqual(['DrillList', 'SequenceEditor']);
    });

    it('keeps a new drill’s draft when it opens the editor again', async () => {
      // Create is offered on the Timer only while no drill is saved, so
      // the only editor it can find open is a new drill's.
      const { tree, currentRoute, stackIn } = await renderTabs();
      await press(tree, 'tab-Drills');
      await press(tree, 'btn-create-drill');
      typeName(tree, 'ZZ Draft');
      await press(tree, 'tab-Timer');

      await act(async () => {
        byTestId(tree, 'state-timer-drills-empty')[0]
          .findAllByProps({ accessibilityRole: 'button' })[0]
          .props.onPress();
      });
      await settle();

      expect(currentRoute()).toBe('SequenceEditor');
      expect(stackIn('Drills')).toEqual(['DrillList', 'SequenceEditor']);
      expect(nameField(tree)?.props.value).toBe('ZZ Draft');
    });
  });

  it('returns to the Log list when the Log tab is pressed deeper in', async () => {
    const { tree, navigationRef, currentRoute } = await renderTabs();
    act(() => {
      navigationRef.navigate('Log', {
        screen: 'HistoryDetail',
        params: { drillId: 'drill-1', drillName: 'Bill Drill' },
        initial: false,
      });
    });
    await settle();
    expect(currentRoute()).toBe('HistoryDetail');

    await press(tree, 'tab-Log');

    expect(currentRoute()).toBe('HistoryList');
  });

  it('returns to the Setup screen when Calibration goes back', async () => {
    const { tree, currentRoute } = await renderTabs();
    await press(tree, 'tab-Setup');
    await press(tree, 'row-calibration');

    await press(tree, 'btn-back');

    expect(currentRoute()).toBe('SetupHome');
  });
});
