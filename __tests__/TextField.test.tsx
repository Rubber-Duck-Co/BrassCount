import { StyleSheet, TextInput } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { TextField } from '../src/components/TextField';
import { fontFamilies } from '../src/theme/theme';

type FieldProps = Partial<Parameters<typeof TextField>[0]>;

const renderField = (props: FieldProps = {}): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <TextField
        label="Handle"
        value=""
        onChangeText={() => {}}
        testID="input-handle"
        {...props}
      />,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const byTestId = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID });

/** The text shown by the element with this `testID`. */
const textOf = (tree: ReactTestRenderer, testID: string): string | undefined =>
  byTestId(tree, testID).find(node => typeof node.props.children === 'string')
    ?.props.children;

const inputFont = (tree: ReactTestRenderer): string | undefined =>
  StyleSheet.flatten(tree.root.findByType(TextInput).props.style).fontFamily;

describe('TextField', () => {
  it('shows a hint under the field', () => {
    const tree = renderField({ hint: 'Optional. Shown on your profile only.' });

    expect(textOf(tree, 'input-handle-hint')).toBe(
      'Optional. Shown on your profile only.',
    );
  });

  it('shows the error in place of the hint while the value cannot be used', () => {
    const tree = renderField({
      hint: 'Optional. Shown on your profile only.',
      error: 'Use letters, numbers, dots and underscores only.',
    });

    expect(byTestId(tree, 'input-handle-hint')).toHaveLength(0);
    expect(textOf(tree, 'input-handle-error')).toBe(
      'Use letters, numbers, dots and underscores only.',
    );
  });

  it('sets the value in mono when asked, and in the body face otherwise', () => {
    expect(inputFont(renderField({ mono: true }))).toBe(
      fontFamilies.monoMedium,
    );
    expect(inputFont(renderField())).toBe(fontFamilies.sansMedium);
  });

  it('reads the hint to a screen reader on the input itself', () => {
    const tree = renderField({ hint: 'Optional. Shown on your profile only.' });

    expect(tree.root.findByType(TextInput).props.accessibilityHint).toBe(
      'Optional. Shown on your profile only.',
    );
  });

  it('drops the hint from the input while an error shows in its place', () => {
    const tree = renderField({
      hint: 'Optional. Shown on your profile only.',
      error: 'Use letters, numbers, dots and underscores only.',
    });

    expect(
      tree.root.findByType(TextInput).props.accessibilityHint,
    ).toBeUndefined();
  });

  it('names the input by its label for a screen reader', () => {
    const tree = renderField();

    expect(tree.root.findByType(TextInput).props.accessibilityLabel).toBe(
      'Handle',
    );
  });
});
