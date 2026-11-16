import { StyleSheet, Text } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Card } from '../src/components/Card';
import { lightTheme, sizes } from '../src/theme/theme';

const render = (card: React.ReactElement): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(card);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The native view the card's `testID` lands on. */
const host = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === 'card',
  )[0];

const style = (tree: ReactTestRenderer) =>
  StyleSheet.flatten(host(tree).props.style);

describe('Card', () => {
  it('is a square box with a 2px outline on the Card fill', () => {
    const tree = render(
      <Card testID="card">
        <Text>Inside</Text>
      </Card>,
    );

    expect(style(tree)).toMatchObject({
      backgroundColor: lightTheme.colors.surface,
      borderColor: lightTheme.colors.outline,
      borderWidth: sizes.border,
      borderRadius: 0,
    });
  });

  it('casts no shadow', () => {
    const tree = render(
      <Card testID="card">
        <Text>Inside</Text>
      </Card>,
    );

    expect(style(tree).elevation ?? 0).toBe(0);
    expect(style(tree).shadowOpacity ?? 0).toBe(0);
  });

  it('pads its content unless it is flush', () => {
    const padding = (flush: boolean) =>
      style(
        render(
          <Card testID="card" flush={flush}>
            <Text>Inside</Text>
          </Card>,
        ),
      ).padding;

    expect(padding(false)).toBeGreaterThan(0);
    expect(padding(true)).toBeUndefined();
  });

  it('is a button that calls onPress when it is given one', () => {
    const onPress = jest.fn();
    const tree = render(
      <Card testID="card" onPress={onPress}>
        <Text>New drill</Text>
      </Card>,
    );

    act(() => {
      host(tree).props.onClick();
    });

    expect(host(tree).props.accessibilityRole).toBe('button');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not a button without onPress', () => {
    const tree = render(
      <Card testID="card">
        <Text>Inside</Text>
      </Card>,
    );

    expect(host(tree).props.accessibilityRole).toBeUndefined();
  });
});
