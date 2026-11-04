import { Dimensions } from 'react-native';

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

import { RunComparisonScreen } from '../src/screens/RunComparisonScreen';
import {
  deleteDrillById,
  saveDrill,
  updateDrill,
} from '../src/services/drillStorage';
import {
  SessionStorageError,
  SessionStorageService,
  saveSession,
} from '../src/services/sessionStorage';
import { lightTheme } from '../src/theme/theme';
import type { Drill } from '../src/types/drill';
import type { Session, SessionSplitInput } from '../src/types/session';
import { formatDateTime, spokenDateTime } from '../src/utils/format';

/**
 * In the app the comparison is pushed over the detail screen inside the
 * Log tab. Here it is a tab of its own, next to a blank one to leave
 * it for, so it stays mounted while it is out of sight.
 */
type TestTabParamList = {
  RunComparison: {
    drillId: string;
    runIds: [string, string];
    drillName?: string;
  };
  Elsewhere: undefined;
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const Tab = createBottomTabNavigator<TestTabParamList>();

const Blank = () => null;

const seedDrill = (name: string): Promise<Drill> =>
  saveDrill({
    name,
    steps: [
      { type: 'draw', par: 1.5 },
      { type: 'shot', par: 0.25 },
      { type: 'shot', par: 0.25 },
    ],
  });

/** A run of the three steps, with the time each one took. */
const splits = (draw: number, shot1: number, shot2?: number) => {
  const all: SessionSplitInput[] = [
    { stepId: 'step-1', label: 'Draw', par: 1.5, actual: draw },
    { stepId: 'step-2', label: 'Shot 1', par: 0.25, actual: shot1 },
  ];
  return shot2 === undefined
    ? all
    : [...all, { stepId: 'step-3', label: 'Shot 2', par: 0.25, actual: shot2 }];
};

/** Save a run of `drillId` made at `at`; its total is the sum of its steps. */
const seedSession = (
  drillId: string,
  at: string,
  runSplits: SessionSplitInput[],
  completed = true,
): Promise<Session> =>
  saveSession(
    {
      drillId,
      totalTime: Number(
        runSplits.reduce((sum, { actual }) => sum + actual, 0).toFixed(3),
      ),
      completed,
      splits: runSplits,
    },
    { getTimestamp: () => at },
  );

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>(resolve => {
      setImmediate(resolve);
    });
  });
};

type Harness = {
  tree: ReactTestRenderer;
  goTo: (tab: keyof TestTabParamList) => Promise<void>;
  /** The tab on screen. */
  currentRoute: () => string | undefined;
};

const mounted: ReactTestRenderer[] = [];

const mountScreen = (
  drillId: string,
  runIds: [string, string],
  drillName?: string,
): Harness => {
  const navigationRef = createNavigationContainerRef<TestTabParamList>();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <NavigationContainer ref={navigationRef}>
          {/* Back returns to the tab left last, as back from the
              comparison returns to the runs it was opened from. */}
          <Tab.Navigator
            backBehavior="history"
            screenOptions={{ headerShown: false }}
          >
            <Tab.Screen
              name="RunComparison"
              component={RunComparisonScreen}
              initialParams={{ drillId, runIds, drillName }}
            />
            <Tab.Screen name="Elsewhere" component={Blank} />
          </Tab.Navigator>
        </NavigationContainer>
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
      act(() => {
        if (tab === 'Elsewhere') {
          navigationRef.navigate('Elsewhere');
        } else {
          navigationRef.navigate('RunComparison', {
            drillId,
            runIds,
            drillName,
          });
        }
      });
      await settle();
    },
    currentRoute: () => navigationRef.getCurrentRoute()?.name,
  };
};

const renderScreen = async (
  drillId: string,
  runIds: [string, string],
  drillName?: string,
): Promise<Harness> => {
  const harness = mountScreen(drillId, runIds, drillName);
  await settle();
  return harness;
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

/** The text of the innermost element with this `testID`. */
const textOf = (tree: ReactTestRenderer, testID: string): string => {
  const node = byTestId(tree, testID).at(-1);
  if (node === undefined) {
    throw new Error(`nothing is rendered for "${testID}"`);
  }
  return textsUnder(node).join('');
};

/** The colour of the innermost element with this `testID`. */
const colorOf = (tree: ReactTestRenderer, testID: string): unknown => {
  const node = byTestId(tree, testID).at(-1);
  const style = [node?.props.style].flat(Infinity) as
    { color?: string }[] | undefined;
  return style?.reduce<string | undefined>(
    (color, entry) => entry?.color ?? color,
    undefined,
  );
};

/** What each row of the step table shows, top to bottom. */
const stepRows = (tree: ReactTestRenderer): string[][] => {
  const [table] = byTestId(tree, 'table-comparison');
  const rows = table.findAll(
    node =>
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('row-comparison-') &&
      typeof node.type === 'string',
  );
  return rows.map(row => textsUnder(row));
};

/** What a screen reader says for each step, top to bottom. */
const spokenSteps = (tree: ReactTestRenderer): string[] => {
  const [table] = byTestId(tree, 'table-comparison');
  const labels = table
    .findAll(node => node.props.accessible === true)
    .map(node => node.props.accessibilityLabel as string);
  return [...new Set(labels)];
};

/** What a screen reader says for the grouped element with this `testID`. */
const spokenOf = (tree: ReactTestRenderer, testID: string): string => {
  const node = byTestId(tree, testID).find(
    match => match.props.accessible === true,
  );
  if (node === undefined) {
    throw new Error(`nothing is grouped for "${testID}"`);
  }
  return node.props.accessibilityLabel as string;
};

const screenTexts = (tree: ReactTestRenderer): string[] =>
  textsOf(tree, 'screen-run-comparison');

const setFontScale = (fontScale: number): void => {
  act(() => {
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale },
      screen: Dimensions.get('screen'),
    });
  });
};

const storageFailure = (): SessionStorageError =>
  new SessionStorageError('Failed to load sessions', 'STORAGE_FAILURE');

describe('RunComparisonScreen', () => {
  const initialWindow = Dimensions.get('window');

  beforeEach(async () => {
    await AsyncStorage.clear();
    // Jest's window has a font scale of 2; the default text size is 1.
    setFontScale(1);
  });

  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    jest.restoreAllMocks();
    setFontScale(initialWindow.fontScale);
  });

  describe('loading the runs', () => {
    it('says it is loading until storage answers', async () => {
      const drill = await seedDrill('Bill Drill');
      const a = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const b = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );
      const { tree } = mountScreen(drill.id, [a.id, b.id]);

      expect(has(tree, 'text-comparison-loading')).toBe(true);
      expect(has(tree, 'card-comparison-totals')).toBe(false);

      await settle();

      expect(has(tree, 'text-comparison-loading')).toBe(false);
      expect(has(tree, 'card-comparison-totals')).toBe(true);
      expect(screenTexts(tree)).toContain('Bill Drill');
    });
  });

  describe('the two runs', () => {
    it('puts the earlier run first, whichever run Compare was pressed on', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [newer.id, older.id]);

      expect(textsOf(tree, 'run-earlier')).toEqual([
        'EARLIER',
        formatDateTime(older.createdAt),
        '2.05',
      ]);
      expect(textsOf(tree, 'run-later')).toEqual([
        'LATER',
        // The quicker of the drill's two runs, beside its caption.
        'PB',
        formatDateTime(newer.createdAt),
        '1.97',
      ]);
    });

    it('says how much faster the later run was in total', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

      expect(textsOf(tree, 'comparison-difference')).toEqual([
        '0.08s faster than the earlier run',
      ]);
      expect(spokenOf(tree, 'comparison-difference')).toBe(
        'Total time: later run 0.08 seconds faster',
      );
    });

    it('says how much slower the later run was in total', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

      expect(textsOf(tree, 'comparison-difference')).toEqual([
        '0.08s slower than the earlier run',
      ]);
      expect(spokenOf(tree, 'comparison-difference')).toBe(
        'Total time: later run 0.08 seconds slower',
      );
    });

    it('says when the two runs took the same time', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.45, 0.35, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

      expect(textsOf(tree, 'comparison-difference')).toEqual([
        'The same time as the earlier run',
      ]);
      expect(spokenOf(tree, 'comparison-difference')).toBe(
        'Total time: the same in both runs',
      );
    });

    it('does not compare the totals when a run was stopped early', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const stopped = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32),
        false,
      );

      const { tree } = await renderScreen(drill.id, [older.id, stopped.id]);

      expect(textsOf(tree, 'comparison-difference').join(' ')).toMatch(
        /not compared/,
      );
      expect(textsOf(tree, 'run-later')).toContain('STOPPED EARLY');
      expect(has(tree, 'run-earlier-incomplete')).toBe(false);
    });

    it('marks the drill’s personal best, and only that run', async () => {
      const drill = await seedDrill('Bill Drill');
      const best = await seedSession(
        drill.id,
        '2026-10-01T12:00:00Z',
        splits(1.2, 0.3, 0.25),
      );
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const unbadged = await renderScreen(drill.id, [older.id, newer.id]);
      expect(has(unbadged.tree, 'run-earlier-pb')).toBe(false);
      expect(has(unbadged.tree, 'run-later-pb')).toBe(false);

      const badged = await renderScreen(drill.id, [best.id, newer.id]);
      expect(has(badged.tree, 'run-earlier-pb')).toBe(true);
      expect(has(badged.tree, 'run-later-pb')).toBe(false);
      expect(spokenOf(badged.tree, 'run-earlier')).toBe(
        `earlier run, ${spokenDateTime(best.createdAt)}, 1.75 seconds, personal best`,
      );
    });
  });

  describe('the steps', () => {
    it('shows each step’s time in both runs and the difference, in plain figures', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [newer.id, older.id]);

      expect(stepRows(tree)).toEqual([
        ['Draw', '1.50', '1.40', '−0.10'],
        ['Shot 1', '0.30', '0.32', '+0.02'],
        ['Shot 2', '0.25', '0.25', '0.00'],
      ]);
    });

    it('marks a slower step in Signal, and a faster or equal one in Ink', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

      expect(colorOf(tree, 'text-comparison-step-2-delta')).toBe(
        lightTheme.colors.warning,
      );
      expect(colorOf(tree, 'text-comparison-step-1-delta')).toBe(
        lightTheme.colors.textPrimary,
      );
      expect(colorOf(tree, 'text-comparison-step-3-delta')).toBe(
        lightTheme.colors.textPrimary,
      );
      expect(screenTexts(tree)).toContain(
        'Orange: slower than the earlier run.',
      );
    });

    it('reads each step out in words', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

      expect(spokenSteps(tree)).toEqual([
        'Draw, earlier run 1.5 seconds, later run 1.4 seconds, later run 0.1 seconds faster',
        'Shot 1, earlier run 0.3 seconds, later run 0.32 seconds, later run 0.02 seconds slower',
        'Shot 2, earlier run 0.25 seconds, later run 0.25 seconds, the same in both runs',
      ]);
    });

    it('lists the steps a run stopped early never reached, without a difference', async () => {
      const drill = await seedDrill('Bill Drill');
      const stopped = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3),
        false,
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [stopped.id, newer.id]);

      expect(stepRows(tree)).toEqual([
        ['Draw', '1.50', '1.40', '−0.10'],
        ['Shot 1', '0.30', '0.32', '+0.02'],
        ['Shot 2', '—', '0.25', '—'],
      ]);
      expect(spokenSteps(tree)[2]).toBe(
        'Shot 2, not heard in the earlier run, later run 0.25 seconds',
      );
    });

    it.each([1, 2])(
      'keeps the figures in columns under one row of captions at font scale %d',
      async fontScale => {
        const drill = await seedDrill('Bill Drill');
        const older = await seedSession(
          drill.id,
          '2026-10-05T12:00:00Z',
          splits(1.5, 0.3, 0.25),
        );
        const newer = await seedSession(
          drill.id,
          '2026-10-10T12:00:00Z',
          splits(1.4, 0.32, 0.25),
        );
        setFontScale(fontScale);

        const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

        const table = textsOf(tree, 'table-comparison');
        expect(table.slice(0, 4)).toEqual(['STEP', 'EARLIER', 'LATER', 'Δ']);
        expect(table.filter(text => text === 'EARLIER')).toHaveLength(1);
        expect(stepRows(tree)[0]).toEqual(['Draw', '1.50', '1.40', '−0.10']);
      },
    );
  });

  describe('the name of the drill', () => {
    it('links back to the drill’s runs by its name', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

      expect(textsOf(tree, 'btn-back')).toContain('BILL DRILL');
      expect(spokenOf(tree, 'btn-back')).toBe('Back to Bill Drill');
    });

    it('shows the name it was opened with until the drill has been read', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = mountScreen(drill.id, [older.id, newer.id], 'Old Name');

      expect(has(tree, 'text-comparison-loading')).toBe(true);
      expect(textsOf(tree, 'btn-back')).toContain('OLD NAME');

      await settle();

      expect(textsOf(tree, 'btn-back')).toContain('BILL DRILL');
    });

    it('shows the name the drill has now when the screen comes back', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );
      const { tree, goTo } = await renderScreen(drill.id, [older.id, newer.id]);

      await goTo('Elsewhere');
      await updateDrill(drill.id, { name: 'El Presidente' });
      await goTo('RunComparison');

      expect(screenTexts(tree)).toContain('El Presidente');
    });

    it('keeps comparing the runs of a deleted drill, under a stand-in name', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );
      await deleteDrillById(drill.id);

      const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

      expect(screenTexts(tree)).toContain('Deleted drill');
      expect(stepRows(tree)).toHaveLength(3);
    });
  });

  describe('runs it cannot compare', () => {
    it('does not compare a run of another drill', async () => {
      const drill = await seedDrill('Bill Drill');
      const other = await seedDrill('Other Drill');
      const mine = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const theirs = await seedSession(
        other.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [mine.id, theirs.id]);

      expect(has(tree, 'state-comparison-missing')).toBe(true);
      expect(has(tree, 'card-comparison-totals')).toBe(false);
    });

    it('does not compare a run with itself', async () => {
      const drill = await seedDrill('Bill Drill');
      const run = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [run.id, run.id]);

      expect(has(tree, 'state-comparison-missing')).toBe(true);
    });

    it('says when a run is not stored', async () => {
      const drill = await seedDrill('Bill Drill');
      const run = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );

      const { tree } = await renderScreen(drill.id, [run.id, 'gone']);

      expect(has(tree, 'state-comparison-missing')).toBe(true);
      expect(textsOf(tree, 'state-comparison-missing')).toEqual(
        expect.arrayContaining([
          'These runs are not here',
          'One of the runs could not be found for this drill.',
        ]),
      );
    });

    it('says so when a run is deleted while the comparison is open', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );
      const { tree, goTo } = await renderScreen(drill.id, [older.id, newer.id]);

      await goTo('Elsewhere');
      await SessionStorageService.deleteById(newer.id);
      await goTo('RunComparison');

      expect(has(tree, 'state-comparison-missing')).toBe(true);
      expect(has(tree, 'card-comparison-totals')).toBe(false);
    });

    it('goes back to the runs from Back to runs', async () => {
      const drill = await seedDrill('Bill Drill');
      const run = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const { tree, goTo, currentRoute } = await renderScreen(drill.id, [
        run.id,
        'gone',
      ]);
      // Opened from another screen, as it is from the drill's runs.
      await goTo('Elsewhere');
      await goTo('RunComparison');

      await act(async () => {
        tree.root.findAllByProps({ label: 'Back to runs' })[0].props.onPress();
      });

      expect(currentRoute()).toBe('Elsewhere');
    });
  });

  describe('when the runs cannot be read', () => {
    it('offers to try again, without the raw error, and reads again', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );
      jest
        .spyOn(SessionStorageService, 'loadByDrillId')
        .mockRejectedValueOnce(storageFailure());

      const { tree } = await renderScreen(drill.id, [older.id, newer.id]);

      expect(has(tree, 'state-comparison-error')).toBe(true);
      expect(textsOf(tree, 'state-comparison-error')).not.toContain(
        'Failed to load sessions',
      );

      await act(async () => {
        tree.root.findAllByProps({ label: 'Try again' })[0].props.onPress();
      });
      await settle();

      expect(has(tree, 'state-comparison-error')).toBe(false);
      expect(stepRows(tree)).toHaveLength(3);
    });

    it('ignores a read that answers after the screen was left', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );
      let answerLate: (sessions: Session[]) => void = () => {};
      jest.spyOn(SessionStorageService, 'loadByDrillId').mockImplementationOnce(
        () =>
          new Promise<Session[]>(resolve => {
            answerLate = resolve;
          }),
      );
      const { tree, goTo } = mountScreen(drill.id, [older.id, newer.id]);

      // Leaving and coming back reads again, and that read answers first.
      await goTo('Elsewhere');
      await goTo('RunComparison');
      expect(stepRows(tree)).toHaveLength(3);

      // The first read answers last, with neither run in it.
      await act(async () => {
        answerLate([]);
      });
      await settle();

      expect(has(tree, 'state-comparison-missing')).toBe(false);
      expect(stepRows(tree)).toHaveLength(3);
    });

    it('keeps the comparison it had when reading again fails', async () => {
      const drill = await seedDrill('Bill Drill');
      const older = await seedSession(
        drill.id,
        '2026-10-05T12:00:00Z',
        splits(1.5, 0.3, 0.25),
      );
      const newer = await seedSession(
        drill.id,
        '2026-10-10T12:00:00Z',
        splits(1.4, 0.32, 0.25),
      );
      const { tree, goTo } = await renderScreen(drill.id, [older.id, newer.id]);

      await goTo('Elsewhere');
      jest
        .spyOn(SessionStorageService, 'loadByDrillId')
        .mockRejectedValueOnce(storageFailure());
      await goTo('RunComparison');

      expect(has(tree, 'state-comparison-error')).toBe(false);
      expect(stepRows(tree)).toHaveLength(3);
    });
  });
});
