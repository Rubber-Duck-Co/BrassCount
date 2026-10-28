import { StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Button } from '../src/components/Button';
import { Typography } from '../src/components/Typography';
import { PreferencesContext } from '../src/store/PreferencesContext';
import {
  darkTheme,
  lightTheme,
  sizes,
  typography,
  type Theme,
} from '../src/theme/theme';
import { DEFAULT_PROFILE } from '../src/types/profile';

const render = (button: React.ReactElement): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(button);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** Renders `element` with the Appearance pinned to dark. */
const inDark = (element: React.ReactElement) => (
  <PreferencesContext.Provider
    value={{
      preferences: { ...DEFAULT_PROFILE, appearance: 'dark' },
      setPreference: jest.fn(),
    }}
  >
    {element}
  </PreferencesContext.Provider>
);

/** The native view the button's `testID` lands on. */
const host = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === 'btn',
  )[0];

const boxStyle = (tree: ReactTestRenderer) =>
  StyleSheet.flatten(host(tree).props.style);

/** The flattened style of the button's label. */
const labelStyle = (tree: ReactTestRenderer) =>
  StyleSheet.flatten(tree.root.findAllByType(Typography)[0].props.style);

const labelColor = (tree: ReactTestRenderer): unknown =>
  tree.root.findAllByType(Typography)[0].props.color;

type Variant = 'primary' | 'secondary' | 'stop' | 'text';

/** What the Range Card system board draws for each variant. */
const expected = (theme: Theme, variant: Variant) =>
  ({
    primary: {
      fill: theme.colors.primary,
      border: theme.colors.primaryBorder,
      label: 'textOnPrimary',
    },
    secondary: {
      fill: 'transparent',
      border: theme.colors.outline,
      label: 'textPrimary',
    },
    stop: {
      fill: theme.colors.inverse,
      border: theme.colors.inverse,
      label: 'textOnInverse',
    },
    text: { fill: 'transparent', border: 'transparent', label: 'textPrimary' },
  })[variant];

const VARIANTS: Variant[] = ['primary', 'secondary', 'stop', 'text'];

describe('Button', () => {
  it('is at least the touch-target minimum tall', () => {
    const tree = render(
      <Button label="Save" onPress={jest.fn()} testID="btn" />,
    );

    expect(boxStyle(tree).minHeight).toBe(sizes.touchTarget);
    expect(boxStyle(tree).height).toBeUndefined();
  });

  it.each(VARIANTS)('draws the %s variant from the light tokens', variant => {
    const tree = render(
      <Button label="Go" variant={variant} onPress={jest.fn()} testID="btn" />,
    );
    const want = expected(lightTheme, variant);

    expect(boxStyle(tree)).toMatchObject({
      backgroundColor: want.fill,
      borderColor: want.border,
      borderWidth: sizes.border,
      borderRadius: lightTheme.radius.none,
    });
    expect(labelColor(tree)).toBe(want.label);
  });

  it.each(VARIANTS)('draws the %s variant from the dark tokens', variant => {
    const tree = render(
      inDark(
        <Button
          label="Go"
          variant={variant}
          onPress={jest.fn()}
          testID="btn"
        />,
      ),
    );
    const want = expected(darkTheme, variant);

    expect(boxStyle(tree)).toMatchObject({
      backgroundColor: want.fill,
      borderColor: want.border,
    });
    expect(labelColor(tree)).toBe(want.label);
  });

  it('underlines the text variant and only the text variant', () => {
    const underline = (variant: Variant) =>
      labelStyle(
        render(
          <Button
            label="Edit"
            variant={variant}
            onPress={jest.fn()}
            testID="btn"
          />,
        ),
      ).textDecorationLine;

    expect(underline('text')).toBe('underline');
    expect(underline('primary')).toBeUndefined();
  });

  it('shows its label in capitals but announces it as written', () => {
    const tree = render(
      <Button label="Try again" onPress={jest.fn()} testID="btn" />,
    );

    expect(labelStyle(tree).textTransform).toBe('uppercase');
    expect(tree.root.findAllByType(Typography)[0].props.children).toBe(
      'Try again',
    );
    expect(host(tree).props.accessibilityLabel).toBe('Try again');
  });

  it('announces its own accessibility label in place of the label', () => {
    const tree = render(
      <Button
        label="Load"
        accessibilityLabel="Load Bill Drill on the timer"
        onPress={jest.fn()}
        testID="btn"
      />,
    );

    expect(host(tree).props.accessibilityLabel).toBe(
      'Load Bill Drill on the timer',
    );
  });

  it('sets the label in the action style by default', () => {
    const tree = render(
      <Button label="Save" onPress={jest.fn()} testID="btn" />,
    );

    expect(tree.root.findAllByType(Typography)[0].props.variant).toBe(
      'actionLabel',
    );
  });

  it('makes the main action at least 72 tall with a stencil label', () => {
    const tree = render(
      <Button label="Start" size="main" onPress={jest.fn()} testID="btn" />,
    );

    expect(boxStyle(tree).minHeight).toBe(sizes.mainActionMin);
    expect(boxStyle(tree).height).toBeUndefined();
    expect(tree.root.findAllByType(Typography)[0].props.variant).toBe(
      'mainAction',
    );
    expect(typography.mainAction.fontFamily).toBe(
      lightTheme.fontFamilies.stencil,
    );
  });

  it('lets its label grow with the system font', () => {
    const tree = render(
      <Button label="Start" size="main" onPress={jest.fn()} testID="btn" />,
    );
    const label = tree.root.findAllByType(Typography)[0].props;

    expect(label.allowFontScaling).not.toBe(false);
    expect(label.maxFontSizeMultiplier).toBeUndefined();
  });

  it('greys a disabled button and announces it as disabled', () => {
    const tree = render(
      <Button
        label="Test"
        disabled
        accessibilityHint="Recalibrate this sound first"
        onPress={jest.fn()}
        testID="btn"
      />,
    );

    expect(boxStyle(tree)).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: lightTheme.colors.disabled,
    });
    expect(labelColor(tree)).toBe('disabled');
    expect(host(tree).props.accessibilityHint).toBe(
      'Recalibrate this sound first',
    );
    expect(host(tree).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('does not underline a disabled text button', () => {
    const tree = render(
      <Button
        label="Save"
        variant="text"
        disabled
        onPress={jest.fn()}
        testID="btn"
      />,
    );

    expect(labelStyle(tree).textDecorationLine).toBeUndefined();
    expect(labelColor(tree)).toBe('disabled');
  });

  it('is announced as busy and cannot be pressed again while busy', () => {
    const tree = render(
      <Button label="Saving…" busy onPress={jest.fn()} testID="btn" />,
    );

    expect(host(tree).props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('is neither disabled nor busy by default', () => {
    const tree = render(
      <Button label="Save" onPress={jest.fn()} testID="btn" />,
    );

    expect(host(tree).props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });
  });
});
