import { Dimensions, StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { StatsBox, type StatsBoxItem } from '../src/components/StatsBox';

const ITEMS: StatsBoxItem[] = [
  {
    caption: 'BEST',
    value: '2.64',
    spoken: 'Best 2.64 seconds',
    testID: 'best',
  },
  {
    caption: 'AVERAGE',
    value: '2.96',
    spoken: 'Average 2.96 seconds',
    testID: 'avg',
  },
];

const render = (): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<StatsBox items={ITEMS} testID="stats" />);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The innermost element carrying `testID`: the text itself. */
const last = (tree: ReactTestRenderer, testID: string) => {
  const found = tree.root.findAllByProps({ testID }).at(-1);
  if (found === undefined) {
    throw new Error(`nothing is rendered for "${testID}"`);
  }
  return found;
};

const setFontScale = (fontScale: number): void => {
  act(() => {
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale },
      screen: Dimensions.get('screen'),
    });
  });
};

/** How the cells are laid out: side by side, or one over the other. */
const directionOf = (tree: ReactTestRenderer) =>
  StyleSheet.flatten(
    tree.root.findAll(
      node => node.props.testID === 'stats' && node.props.style !== undefined,
    )[0].props.style,
  ).flexDirection ?? 'column';

describe('StatsBox', () => {
  const initialWindow = Dimensions.get('window');

  afterEach(() => {
    setFontScale(initialWindow.fontScale);
  });

  it('shows each value in Plex Mono over its caption', () => {
    const tree = render();

    expect(tree.root.findAllByProps({ testID: 'best' })[0].props.variant).toBe(
      'metric',
    );
    expect(last(tree, 'best').props.children).toBe('2.64');
    expect(last(tree, 'avg').props.children).toBe('2.96');
    const captions = tree.root
      .findAll(node => node.props.variant === 'sectionLabel')
      .map(node => node.props.children);
    expect([...new Set(captions)]).toEqual(['BEST', 'AVERAGE']);
  });

  it('reads each figure as one phrase, in words', () => {
    const tree = render();

    const spoken = tree.root
      .findAll(node => node.props.accessible === true)
      .map(node => node.props.accessibilityLabel);
    expect([...new Set(spoken)]).toEqual([
      'Best 2.64 seconds',
      'Average 2.96 seconds',
    ]);
  });

  it('sets the figures side by side at the default text size', () => {
    setFontScale(1);

    expect(directionOf(render())).toBe('row');
  });

  it('puts the figures one over the other at large text', () => {
    setFontScale(1.5);

    expect(directionOf(render())).toBe('column');
  });
});
