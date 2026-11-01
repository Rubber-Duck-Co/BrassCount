import { StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Chip } from '../src/components/Chip';
import { lightTheme } from '../src/theme/theme';

const render = (
  tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'inverse',
): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<Chip label="PB" tone={tone} testID="chip" />);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The box drawn on screen: the testID also sits on the Chip element itself. */
const boxOf = (tree: ReactTestRenderer) =>
  StyleSheet.flatten(
    tree.root.findAll(
      node => node.props.testID === 'chip' && node.props.style !== undefined,
    )[0].props.style,
  );

describe('Chip', () => {
  it('sets its label in capitals', () => {
    const tree = render();

    expect(
      tree.root.findAll(node => node.props.children === 'PB'),
    ).not.toHaveLength(0);
  });

  it('fills an inverse chip with Ink and sets its label on it', () => {
    const tree = render('inverse');

    expect(boxOf(tree)).toMatchObject({
      backgroundColor: lightTheme.colors.inverse,
      borderColor: lightTheme.colors.inverse,
    });
    const [label] = tree.root.findAll(
      node => node.props.variant === 'overline',
    );
    expect(label.props.color).toBe('textOnInverse');
  });

  it('leaves a neutral chip on the Card fill', () => {
    const tree = render();

    expect(boxOf(tree).backgroundColor).toBe(lightTheme.colors.surfaceElevated);
  });
});
