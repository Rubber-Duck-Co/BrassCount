import { Modal, Text } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { RunPickerSheet } from '../src/components/RunPickerSheet';
import type { Session } from '../src/types/session';
import { formatDateTime, spokenDateTime } from '../src/utils/format';
import type { RunSummary } from '../src/utils/history';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const session = (
  id: string,
  createdAt: string,
  totalTime: number,
  completed = true,
): Session => ({
  id,
  drillId: 'drill-1',
  createdAt,
  totalTime,
  completed,
  splits: [
    {
      stepId: 'step-1',
      label: 'Shot 1',
      par: 0.5,
      actual: totalTime,
      delta: totalTime - 0.5,
    },
  ],
});

const summary = (
  run: Session,
  { personalBest = false }: { personalBest?: boolean } = {},
): RunSummary => ({ session: run, deltaToPrevious: null, personalBest });

const FROM = session('from', '2026-10-24T14:32:00Z', 2.87);
const RUNS: RunSummary[] = [
  summary(session('a', '2026-10-24T14:29:00Z', 2.81)),
  summary(session('b', '2026-10-24T18:05:00Z', 2.64), { personalBest: true }),
  summary(session('c', '2026-10-19T16:12:00Z', 2.214, false)),
];

type Props = {
  /** `null` renders the sheet without the run it compares from. */
  from?: Session | null;
  onSelect?: (sessionId: string) => void;
  onClose?: () => void;
};

const render = ({
  from = FROM,
  onSelect = jest.fn(),
  onClose = jest.fn(),
}: Props = {}): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <RunPickerSheet
          visible
          from={from ?? undefined}
          runs={RUNS}
          onSelect={onSelect}
          onClose={onClose}
        />
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const first = (tree: ReactTestRenderer, testID: string): ReactTestInstance => {
  const [node] = tree.root.findAllByProps({ testID });
  if (node === undefined) {
    throw new Error(`nothing is rendered for "${testID}"`);
  }
  return node;
};

const press = (tree: ReactTestRenderer, testID: string) =>
  act(() => first(tree, testID).props.onPress?.());

const textsOf = (node: ReactTestInstance): string[] =>
  node.findAllByType(Text).map(text => String(text.props.children));

describe('RunPickerSheet', () => {
  it('rises on the shared sheet frame, titled Compare with', () => {
    const tree = render();

    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
    expect(textsOf(first(tree, 'sheet-compare'))).toContain('Compare with');
    const [title] = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.accessibilityRole === 'header',
    );
    expect(title.props.accessibilityLabel).toBe('Compare with');
  });

  it('closes from its close button, its backdrop and the system back', () => {
    const onClose = jest.fn();
    const tree = render({ onClose });

    press(tree, 'btn-compare-close');
    press(tree, 'btn-compare-backdrop');
    act(() => tree.root.findByType(Modal).props.onRequestClose());

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(first(tree, 'btn-compare-close').props.accessibilityLabel).toBe(
      'Close run picker',
    );
  });

  it('says which run the picked one is set against', () => {
    const tree = render();

    expect(textsOf(first(tree, 'text-compare-from'))).toEqual([
      `Pick a run to set against the run on ${formatDateTime(FROM.createdAt)}.`,
    ]);
  });

  it('asks for another run of the drill when it does not know the run', () => {
    const tree = render({ from: null });

    expect(textsOf(first(tree, 'text-compare-from'))).toEqual([
      'Pick another run of this drill.',
    ]);
  });

  it('lists every run with its date and total in plain figures', () => {
    const tree = render();

    expect(textsOf(first(tree, 'opt-compare-a'))).toEqual([
      formatDateTime('2026-10-24T14:29:00Z'),
      '2.81',
    ]);
    expect(textsOf(first(tree, 'opt-compare-b'))).toEqual([
      formatDateTime('2026-10-24T18:05:00Z'),
      'PB',
      '2.64',
    ]);
    expect(textsOf(first(tree, 'opt-compare-c'))).toEqual([
      formatDateTime('2026-10-19T16:12:00Z'),
      'STOPPED EARLY',
      '2.21',
    ]);
  });

  it('reads each run out in words', () => {
    const tree = render();

    expect(first(tree, 'opt-compare-b').props.accessibilityLabel).toBe(
      `Run on ${spokenDateTime('2026-10-24T18:05:00Z')}, 2.64 seconds, personal best`,
    );
    expect(first(tree, 'opt-compare-c').props.accessibilityLabel).toBe(
      `Run on ${spokenDateTime('2026-10-19T16:12:00Z')}, 2.21 seconds, stopped early`,
    );
  });

  it('hands back the run picked', () => {
    const onSelect = jest.fn();
    const tree = render({ onSelect });

    press(tree, 'opt-compare-b');

    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
