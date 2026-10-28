import { StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SplitsTable } from '../src/components/SplitsTable';
import type { SplitRow } from '../src/utils/splitRows';

const ROWS: SplitRow[] = [
  {
    stepId: 'draw',
    label: 'Draw',
    par: '1.50',
    time: '—',
    delta: 'with next',
    deltaTone: 'note',
    spoken: 'Draw, not timed',
  },
  {
    stepId: 'shot-1',
    label: 'Shot 1',
    par: '1.80',
    time: '1.59',
    delta: '−0.21',
    deltaTone: 'figure',
    spoken: 'Shot 1, took 1.59 seconds',
  },
  {
    stepId: 'shot-2',
    label: 'Shot 2',
    par: '0.30',
    time: '0.31',
    delta: '+0.01',
    deltaTone: 'over',
    spoken: 'Shot 2, took 0.31 seconds, 0.01 seconds over par',
  },
];

const render = (rows: SplitRow[] = ROWS): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<SplitsTable rows={rows} />);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const first = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID })[0];

describe('SplitsTable', () => {
  it('heads its columns STEP, PAR, TIME and Δ, hidden from a screen reader', () => {
    const tree = render();

    const header = first(tree, 'row-splits-header');
    expect(header.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(
      header
        .findAll(node => typeof node.props.children === 'string')
        .map(node => node.props.children),
    ).toEqual(expect.arrayContaining(['STEP', 'PAR', 'TIME', 'Δ']));
  });

  it('shows each step with its par, time and difference', () => {
    const tree = render();

    expect(first(tree, 'row-split-1-label').props.children).toBe('Shot 1');
    expect(first(tree, 'row-split-1-par').props.children).toBe('1.80');
    expect(first(tree, 'row-split-1-time').props.children).toBe('1.59');
    expect(first(tree, 'row-split-1-delta').props.children).toBe('−0.21');
  });

  it('reads each row as one, in its own words', () => {
    const tree = render();

    expect(first(tree, 'row-split-2').props).toMatchObject({
      accessible: true,
      accessibilityLabel: 'Shot 2, took 0.31 seconds, 0.01 seconds over par',
    });
  });

  it('sets the figures in Plex Mono', () => {
    const tree = render();

    expect(first(tree, 'row-split-1-par').props.variant).toBe('splitFigure');
    expect(first(tree, 'row-split-1-time').props.variant).toBe('splitFigure');
    expect(first(tree, 'row-split-1-delta').props.variant).toBe('splitFigure');
  });

  it('draws a difference over par in Signal, and under par in Ink', () => {
    const tree = render();

    expect(first(tree, 'row-split-2-delta').props.color).toBe('warning');
    expect(first(tree, 'row-split-1-delta').props.color).toBe('textPrimary');
  });

  it('draws a note in the Δ column as a small grey caption', () => {
    const tree = render();

    expect(first(tree, 'row-split-0-delta').props).toMatchObject({
      variant: 'metricCaption',
      color: 'textSecondary',
      children: 'with next',
    });
  });

  it('widens its figure columns with the system font, so they stay in line', () => {
    // Jest's window has a font scale of 2; the figures stop growing at 1.2.
    const tree = render();

    const par = first(tree, 'row-split-1-par');
    expect(par.props.maxFontSizeMultiplier).toBe(1.2);
    const cell = StyleSheet.flatten(par.parent?.props.style);
    expect(cell.width).toBeCloseTo(52 * 1.2);
  });

  it('divides every row from the next but the last', () => {
    const tree = render();

    const divided = (index: number) =>
      StyleSheet.flatten(first(tree, `row-split-${index}`).props.style)
        .borderBottomWidth ?? 0;
    expect(divided(0)).toBe(1);
    expect(divided(2)).toBe(0);
  });
});
