import { StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Icon } from '../src/components/Icon';
import { ListRow } from '../src/components/ListRow';
import { Typography } from '../src/components/Typography';
import { lightTheme, sizes } from '../src/theme/theme';

const render = (row: React.ReactElement): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(row);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The native view (or touchable) the row's `testID` lands on. */
const host = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === testID,
  )[0];

/** The colour role the row gives a piece of the text it shows. */
const textColor = (tree: ReactTestRenderer, value: string): unknown =>
  tree.root
    .findAllByType(Typography)
    .find(text => text.props.children === value)?.props.color;

describe('ListRow', () => {
  it('reads a row that is not pressable as one item when it is given a spoken label', () => {
    const tree = render(
      <ListRow
        title="Shot 1"
        subtitle="par 1.75s · 0.35s under"
        value="1.40s"
        accessibilityLabel="Shot 1, par 1.75 seconds, took 1.4 seconds"
        testID="row"
      />,
    );

    expect(host(tree, 'row').props).toMatchObject({
      accessible: true,
      accessibilityLabel: 'Shot 1, par 1.75 seconds, took 1.4 seconds',
    });
  });

  it('leaves a row with no spoken label to be read piece by piece', () => {
    const tree = render(<ListRow title="Draw" value="—" testID="row" />);

    expect(host(tree, 'row').props.accessible).toBe(false);
    expect(host(tree, 'row').props.accessibilityLabel).toBeUndefined();
  });

  it('puts the spoken label of a pressable row on its button', () => {
    const tree = render(
      <ListRow
        title="Bill Drill"
        subtitle="3 runs · Best 4.21s · 2d ago"
        accessibilityLabel="Bill Drill, 3 runs"
        onPress={() => {}}
        testID="row"
      />,
    );

    expect(host(tree, 'row').props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Bill Drill, 3 runs',
    });
  });

  it('shows its value in the colour it is given', () => {
    const tree = render(
      <ListRow title="Shot 2" value="0.30s" valueColor="danger" />,
    );

    expect(textColor(tree, '0.30s')).toBe('danger');
  });

  it('shows its value in the secondary text colour by default', () => {
    const tree = render(<ListRow title="Shot 2" value="0.30s" />);

    expect(textColor(tree, '0.30s')).toBe('textSecondary');
  });

  it('ignores presses and reads as dimmed when it is disabled', () => {
    const onPress = jest.fn();
    const tree = render(
      <ListRow
        title="Clear run history"
        onPress={onPress}
        disabled
        testID="row"
      />,
    );

    act(() => {
      host(tree, 'row').props.onClick();
    });

    expect(onPress).not.toHaveBeenCalled();
    expect(host(tree, 'row').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('can be pressed and is not read as dimmed by default', () => {
    const onPress = jest.fn();
    const tree = render(
      <ListRow title="Appearance" onPress={onPress} testID="row" />,
    );

    act(() => {
      host(tree, 'row').props.onClick();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(host(tree, 'row').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('shows the title of a destructive row in the danger colour', () => {
    const tree = render(<ListRow title="Clear run history" destructive />);

    expect(textColor(tree, 'Clear run history')).toBe('danger');
  });

  it('greys the title of a disabled row, even a destructive one', () => {
    const tree = render(
      <ListRow
        title="Clear run history"
        subtitle="No saved runs to delete"
        onPress={() => {}}
        disabled
        destructive
      />,
    );

    expect(textColor(tree, 'Clear run history')).toBe('textTertiary');
    // The reason it is disabled stays as readable as any subtitle.
    expect(textColor(tree, 'No saved runs to delete')).toBe('textTertiary');
  });

  it('hides the chevron of a disabled row', () => {
    const chevrons = (disabled: boolean) =>
      render(<ListRow title="Clear" onPress={() => {}} disabled={disabled} />)
        .root.findAllByType(Icon)
        .filter(icon => icon.props.name === 'chevron');

    expect(chevrons(false)).toHaveLength(1);
    expect(chevrons(true)).toHaveLength(0);
  });

  it('shows the title in the primary text colour by default', () => {
    const tree = render(<ListRow title="Appearance" />);

    expect(textColor(tree, 'Appearance')).toBe('textPrimary');
  });

  it('draws a 1px Rule divider under a divided row', () => {
    const tree = render(<ListRow title="Appearance" divided testID="row" />);

    expect(StyleSheet.flatten(host(tree, 'row').props.style)).toMatchObject({
      borderBottomWidth: sizes.rule,
      borderBottomColor: lightTheme.colors.border,
    });
  });

  it('draws no divider under the last row of a group', () => {
    const tree = render(<ListRow title="Appearance" testID="row" />);

    expect(
      StyleSheet.flatten(host(tree, 'row').props.style).borderBottomWidth,
    ).toBeUndefined();
  });

  it('is at least the touch-target minimum tall', () => {
    const tree = render(
      <ListRow title="Appearance" onPress={() => {}} testID="row" />,
    );

    expect(StyleSheet.flatten(host(tree, 'row').props.style).minHeight).toBe(
      sizes.touchTarget,
    );
  });

  it('sets its title as a row label', () => {
    const tree = render(<ListRow title="Appearance" />);

    expect(
      tree.root
        .findAllByType(Typography)
        .find(text => text.props.children === 'Appearance')?.props.variant,
    ).toBe('rowLabel');
  });

  it('draws its chevron in Ink', () => {
    const tree = render(<ListRow title="Appearance" onPress={() => {}} />);

    expect(tree.root.findByType(Icon).props).toMatchObject({
      name: 'chevron',
      color: 'textPrimary',
      size: sizes.iconSm,
    });
  });

  it('numbers a step in a square outlined badge, not in orange', () => {
    const tree = render(<ListRow title="Shot 1" index={1} />);
    const number = tree.root
      .findAllByType(Typography)
      .find(text => text.props.children === 1);

    expect(number?.props.color).toBe('textSecondary');
    expect(
      StyleSheet.flatten(host(tree, 'list-row-index').props.style),
    ).toMatchObject({
      borderWidth: sizes.rule,
      borderColor: lightTheme.colors.outline,
      borderRadius: 0,
    });
  });
});
