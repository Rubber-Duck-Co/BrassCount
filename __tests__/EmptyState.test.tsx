import { StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { Typography } from '../src/components/Typography';
import { lightTheme, sizes } from '../src/theme/theme';

const render = (state: React.ReactElement): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(state);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The native view a `testID` lands on. */
const host = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === testID,
  )[0];

const text = (tree: ReactTestRenderer, value: string) =>
  tree.root
    .findAllByType(Typography)
    .find(node => node.props.children === value);

describe('EmptyState', () => {
  it.each([
    ['new', '+'],
    ['error', '!'],
    ['empty', '—'],
  ] as const)('draws the %s mark as %s in an outlined box', (mark, glyph) => {
    const tree = render(
      <EmptyState mark={mark} title="No drills yet" message="Create one." />,
    );

    expect(text(tree, glyph)?.props.variant).toBe('stencilSmall');
    expect(
      StyleSheet.flatten(host(tree, 'empty-state-mark').props.style),
    ).toMatchObject({
      borderWidth: sizes.border,
      borderColor: lightTheme.colors.outline,
      borderRadius: 0,
    });
  });

  it('hides the mark from a screen reader', () => {
    const tree = render(
      <EmptyState mark="new" title="No drills yet" message="Create one." />,
    );

    expect(host(tree, 'empty-state-mark').props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });

  it('shows the title as a heading and the message muted', () => {
    const tree = render(
      <EmptyState
        mark="empty"
        title="Nothing here yet"
        message="Run a drill from the timer and it will appear here."
      />,
    );

    expect(text(tree, 'Nothing here yet')?.props.accessibilityRole).toBe(
      'header',
    );
    expect(
      text(tree, 'Run a drill from the timer and it will appear here.')?.props
        .color,
    ).toBe('textSecondary');
  });

  it('offers a secondary action by default', () => {
    const onActionPress = jest.fn();
    const tree = render(
      <EmptyState
        mark="error"
        title="Could not load your drills"
        message="Something went wrong."
        actionLabel="Try again"
        onActionPress={onActionPress}
      />,
    );
    const button = tree.root.findByType(Button);

    expect(button.props).toMatchObject({
      label: 'Try again',
      variant: 'secondary',
    });
    act(() => {
      button.props.onPress();
    });
    expect(onActionPress).toHaveBeenCalledTimes(1);
  });

  it('offers a primary action when asked', () => {
    const tree = render(
      <EmptyState
        mark="new"
        title="No drills yet"
        message="Create one."
        actionLabel="Create drill"
        actionVariant="primary"
        onActionPress={jest.fn()}
      />,
    );

    expect(tree.root.findByType(Button).props.variant).toBe('primary');
  });

  it('shows no action without both a label and a handler', () => {
    const labelOnly = render(
      <EmptyState
        mark="new"
        title="No drills yet"
        message="Create one."
        actionLabel="Create drill"
      />,
    );

    expect(labelOnly.root.findAllByType(Button)).toHaveLength(0);
  });
});
