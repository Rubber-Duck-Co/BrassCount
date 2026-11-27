import { AccessibilityInfo } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { PRESET_DRILLS } from '../src/constants/presetDrills';
import { PresetLibraryScreen } from '../src/screens/PresetLibraryScreen';
import {
  DrillStorageError,
  DrillStorageService,
  loadDrills,
} from '../src/services/drillStorage';
import { countShots, describeDrill, totalPar } from '../src/utils/drill';

/**
 * The Presets screen is pushed over the Drills list in the app. Here the
 * list is a tab behind it, so Back has somewhere to return to.
 */
type TestTabParamList = {
  DrillList: undefined;
  PresetLibrary: undefined;
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const Tab = createBottomTabNavigator<TestTabParamList>();

const Blank = () => null;

/** Let pending storage calls and the state updates they cause land. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>(resolve => {
      setImmediate(resolve);
    });
  });
};

const mounted: ReactTestRenderer[] = [];

const renderScreen = async () => {
  const navigationRef = createNavigationContainerRef<TestTabParamList>();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <NavigationContainer ref={navigationRef}>
          <Tab.Navigator
            initialRouteName="PresetLibrary"
            backBehavior="history"
            screenOptions={{ headerShown: false }}
          >
            <Tab.Screen name="DrillList" component={Blank} />
            <Tab.Screen name="PresetLibrary" component={PresetLibraryScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  mounted.push(tree);
  await settle();
  // Arrive from the list, as the app does, so Back has a route to go to.
  act(() => {
    navigationRef.navigate('DrillList');
  });
  act(() => {
    navigationRef.navigate('PresetLibrary');
  });
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

const textsUnder = (node: ReactTestInstance): string[] =>
  node.children.flatMap(child =>
    typeof child === 'string' ? [child] : textsUnder(child),
  );

const textsOf = (tree: ReactTestRenderer, testID: string): string[] => {
  const [node] = byTestId(tree, testID);
  if (node === undefined) {
    throw new Error(`nothing is rendered for "${testID}"`);
  }
  return textsUnder(node);
};

/** The touchable a `Button` with this test ID renders. */
const touchable = (tree: ReactTestRenderer, testID: string) => {
  const node = byTestId(tree, testID).find(
    candidate => candidate.props.accessibilityRole === 'button',
  );
  if (node === undefined) {
    throw new Error(`no button for "${testID}"`);
  }
  return node;
};

const press = async (tree: ReactTestRenderer, testID: string) => {
  await act(async () => {
    byTestId(tree, testID)[0].props.onPress();
  });
  await settle();
};

const BILL = PRESET_DRILLS[0];
const FTS = PRESET_DRILLS[2];

describe('PresetLibraryScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    jest.restoreAllMocks();
  });

  describe('the header', () => {
    it('is titled Presets, with a back link to Drills', async () => {
      const { tree } = await renderScreen();

      const header = textsOf(tree, 'screen-header');
      expect(header).toEqual(
        expect.arrayContaining([
          'DRILLS',
          'Presets',
          'Standard drills to start your library',
        ]),
      );
      expect(touchable(tree, 'btn-back').props.accessibilityLabel).toBe(
        'Back to Drills',
      );
    });

    it('goes back to the Drills list', async () => {
      const { tree, currentRoute } = await renderScreen();

      await press(tree, 'btn-back');

      expect(currentRoute()).toBe('DrillList');
    });
  });

  describe('listing the presets', () => {
    it('says how many there are and that adding saves a copy', async () => {
      const { tree } = await renderScreen();

      expect(textsOf(tree, 'header-presets')).toEqual([
        `Presets · ${PRESET_DRILLS.length}`,
        'Add saves a copy',
      ]);
    });

    it('shows every preset with its name, description and totals', async () => {
      const { tree } = await renderScreen();

      PRESET_DRILLS.forEach(preset => {
        const { steps } = preset.drill;
        expect(textsOf(tree, `row-preset-${preset.id}`)).toEqual(
          expect.arrayContaining([
            preset.drill.name,
            preset.description,
            describeDrill({
              shotCount: countShots(steps),
              totalPar: totalPar(steps),
            }),
          ]),
        );
      });
    });

    it('sets each name in stencil capitals', async () => {
      const { tree } = await renderScreen();

      const [name] = byTestId(tree, `row-preset-${BILL.id}`)[0].findAll(
        node =>
          node.props.variant === 'stencilSmall' &&
          node.props.children === BILL.drill.name,
      );
      expect(name).toBeDefined();
    });

    it('explains that an added preset is the shooter’s own drill', async () => {
      const { tree } = await renderScreen();

      expect(textsOf(tree, 'text-presets-footnote')).toEqual([
        'An added preset is your own drill: change its pars or delete it on Drills. This list stays the same.',
      ]);
    });

    it('stores nothing until a preset is added', async () => {
      await renderScreen();

      expect(await loadDrills()).toEqual([]);
    });
  });

  describe('adding a preset', () => {
    it('offers Add, named for its preset', async () => {
      const { tree } = await renderScreen();

      expect(
        byTestId(tree, `btn-add-preset-${BILL.id}`)[0].props,
      ).toMatchObject({
        label: 'Add',
        variant: 'secondary',
        accessibilityLabel: 'Add Bill Drill to your drills',
      });
      expect(
        touchable(tree, `btn-add-preset-${BILL.id}`).props.accessibilityState,
      ).toMatchObject({ disabled: false });
    });

    it('saves the preset as a drill and shows it as added, staying here', async () => {
      const { tree, currentRoute } = await renderScreen();

      await press(tree, `btn-add-preset-${BILL.id}`);

      const drills = await loadDrills();
      expect(drills.map(drill => drill.name)).toEqual(['Bill Drill']);
      expect(drills[0].steps.map(({ type, par }) => ({ type, par }))).toEqual(
        BILL.drill.steps,
      );
      expect(has(tree, `btn-add-preset-${BILL.id}`)).toBe(false);
      expect(
        byTestId(tree, `btn-added-preset-${BILL.id}`)[0].props,
      ).toMatchObject({
        label: 'Added',
        disabled: true,
        accessibilityLabel: 'Bill Drill added to your drills',
      });
      expect(
        touchable(tree, `btn-added-preset-${BILL.id}`).props.accessibilityState,
      ).toMatchObject({ disabled: true });
      expect(currentRoute()).toBe('PresetLibrary');
    });

    it('leaves the other presets on Add', async () => {
      const { tree } = await renderScreen();

      await press(tree, `btn-add-preset-${BILL.id}`);

      expect(has(tree, `btn-add-preset-${FTS.id}`)).toBe(true);
    });

    it('tells a screen reader the preset was added', async () => {
      const announce = jest.spyOn(
        AccessibilityInfo,
        'announceForAccessibility',
      );
      const { tree } = await renderScreen();

      await press(tree, `btn-add-preset-${BILL.id}`);

      expect(announce).toHaveBeenCalledWith('Added Bill Drill to your drills');
    });

    it('saves one drill for a double tap', async () => {
      const { tree } = await renderScreen();

      await act(async () => {
        const add = byTestId(tree, `btn-add-preset-${BILL.id}`)[0];
        add.props.onPress();
        add.props.onPress();
      });
      await settle();

      expect(await loadDrills()).toHaveLength(1);
    });

    it('shows Add as busy while the save is under way', async () => {
      let release: () => void = () => {};
      const realSave = DrillStorageService.save;
      jest
        .spyOn(DrillStorageService, 'save')
        .mockImplementation(async input => {
          await new Promise<void>(resolve => {
            release = resolve;
          });
          return realSave(input);
        });
      const { tree } = await renderScreen();

      await act(async () => {
        byTestId(tree, `btn-add-preset-${BILL.id}`)[0].props.onPress();
      });

      expect(byTestId(tree, `btn-add-preset-${BILL.id}`)[0].props.busy).toBe(
        true,
      );

      await act(async () => {
        release();
      });
      await settle();
      expect(has(tree, `btn-added-preset-${BILL.id}`)).toBe(true);
    });

    describe('when the drill cannot be saved', () => {
      beforeEach(() => {
        jest
          .spyOn(DrillStorageService, 'save')
          .mockRejectedValueOnce(
            new DrillStorageError('Failed to save drill', 'STORAGE_FAILURE'),
          );
      });

      it('stays on Add and says so, without the service’s wording', async () => {
        const { tree } = await renderScreen();

        await press(tree, `btn-add-preset-${BILL.id}`);

        expect(has(tree, `btn-add-preset-${BILL.id}`)).toBe(true);
        expect(has(tree, `btn-added-preset-${BILL.id}`)).toBe(false);
        expect(textsOf(tree, `text-preset-error-${BILL.id}`)).toEqual([
          'Could not add Bill Drill. Try again.',
        ]);
        expect(textsOf(tree, 'list-presets')).not.toContain(
          'Failed to save drill',
        );
        expect(await loadDrills()).toEqual([]);
      });

      it('speaks the message as it appears', async () => {
        const { tree } = await renderScreen();

        await press(tree, `btn-add-preset-${BILL.id}`);

        const region = byTestId(tree, `region-preset-error-${BILL.id}`)[0];
        expect(region.props.accessibilityLiveRegion).toBe('polite');
        expect(textsUnder(region)).toEqual([
          'Could not add Bill Drill. Try again.',
        ]);
      });

      it('adds it on another tap, clearing the message', async () => {
        const { tree } = await renderScreen();
        await press(tree, `btn-add-preset-${BILL.id}`);

        await press(tree, `btn-add-preset-${BILL.id}`);

        expect(has(tree, `text-preset-error-${BILL.id}`)).toBe(false);
        expect(has(tree, `btn-added-preset-${BILL.id}`)).toBe(true);
        expect(await loadDrills()).toHaveLength(1);
      });
    });
  });
});
