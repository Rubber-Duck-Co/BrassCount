import { Keyboard, ScrollView, StyleSheet } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Screen } from '../src/components/Screen';
import { Typography } from '../src/components/Typography';
import { sizes } from '../src/theme/theme';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 24 },
};

type Listener = (event: { endCoordinates: { height: number } }) => void;

/** Captures the keyboard listeners so a test can raise and lower it. */
const fakeKeyboard = () => {
  const listeners = new Map<string, Listener>();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    listener: Listener,
  ) => {
    listeners.set(event, listener);
    return { remove: () => listeners.delete(event) };
  }) as unknown as typeof Keyboard.addListener);

  return {
    show: (height: number) =>
      listeners.get('keyboardDidShow')?.({ endCoordinates: { height } }),
    hide: () =>
      listeners.get('keyboardDidHide')?.({ endCoordinates: { height: 0 } }),
  };
};

const bottomPadding = (tree: ReactTestRenderer): unknown => {
  const style = tree.root.findByType(ScrollView).props.contentContainerStyle;
  return (style as Array<{ paddingBottom?: number } | false>)
    .flat()
    .reduce<unknown>(
      (padding, entry) =>
        entry && entry.paddingBottom !== undefined
          ? entry.paddingBottom
          : padding,
      undefined,
    );
};

let tree: ReactTestRenderer | undefined;

const render = (element: React.ReactElement): ReactTestRenderer => {
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>{element}</SafeAreaProvider>,
    );
  });
  return tree as ReactTestRenderer;
};

const byTestId = (rendered: ReactTestRenderer, testID: string) =>
  rendered.root.findAllByProps({ testID })[0];

/** The text a reader sees, one entry per rendered Typography. */
const texts = (rendered: ReactTestRenderer): string[] =>
  rendered.root
    .findAllByType(Typography)
    .map(node => [node.props.children].flat().join(''));

afterEach(() => {
  jest.restoreAllMocks();
  if (tree) {
    const mounted = tree;
    act(() => mounted.unmount());
  }
  tree = undefined;
});

describe('Screen', () => {
  it('leaves room for the keyboard and navigation bar under a scrollable screen', () => {
    const keyboard = fakeKeyboard();
    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={metrics}>
          <Screen scrollable>{null}</Screen>
        </SafeAreaProvider>,
      );
    });
    const before = bottomPadding(tree as ReactTestRenderer);

    act(() => keyboard.show(840));
    expect(bottomPadding(tree as ReactTestRenderer)).toBe(864);

    act(() => keyboard.hide());
    expect(bottomPadding(tree as ReactTestRenderer)).toBe(before);
  });

  it('shows the BRASSCOUNT wordmark when there is no back link', () => {
    const rendered = render(<Screen title="Timer">{null}</Screen>);

    expect(texts(rendered)).toContain('BRASSCOUNT');
    expect(rendered.root.findAllByProps({ testID: 'btn-back' })).toHaveLength(
      0,
    );
  });

  it('replaces the wordmark with a back link that goes back', () => {
    const onBack = jest.fn();
    const rendered = render(
      <Screen title="Settings" onBack={onBack} backLabel="Profile">
        {null}
      </Screen>,
    );

    const back = byTestId(rendered, 'btn-back');
    expect(texts(rendered)).not.toContain('BRASSCOUNT');
    expect(texts(rendered)).toContain('PROFILE');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBe('Back to Profile');

    act(() => back.props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('announces a plain back link as going back', () => {
    const rendered = render(
      <Screen title="Settings" onBack={jest.fn()}>
        {null}
      </Screen>,
    );

    expect(texts(rendered)).toContain('BACK');
    expect(byTestId(rendered, 'btn-back').props.accessibilityLabel).toBe(
      'Go back',
    );
  });

  it('shrinks the wordmark, never the action, when the top row is tight', () => {
    const rendered = render(
      <Screen
        title="Profile"
        action={{ label: 'Settings', onPress: jest.fn() }}
      >
        {null}
      </Screen>,
    );

    const wordmark = rendered.root
      .findAllByType(Typography)
      .find(node => node.props.children === 'BRASSCOUNT');
    const action = byTestId(rendered, 'btn-header-action');
    expect(wordmark?.props.adjustsFontSizeToFit).toBe(true);
    expect(wordmark?.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(action.props.style).flexShrink ?? 0).toBe(0);
  });

  it('calls the header action when it is pressed', () => {
    const onPress = jest.fn();
    const rendered = render(
      <Screen title="Drills" action={{ label: '+ New', onPress }}>
        {null}
      </Screen>,
    );

    const action = byTestId(rendered, 'btn-header-action');
    expect(texts(rendered)).toContain('+ NEW');
    expect(action.props.accessibilityRole).toBe('button');
    expect(action.props.accessibilityLabel).toBe('+ New');
    expect(action.props.accessibilityState).toEqual({ disabled: false });

    act(() => action.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('greys a disabled action, ignores presses and announces it as disabled', () => {
    const rendered = render(
      <Screen
        title="Editor"
        action={{ label: 'Save', onPress: jest.fn() }}
        actionDisabled
      >
        {null}
      </Screen>,
    );

    const action = byTestId(rendered, 'btn-header-action');
    expect(action.props.disabled).toBe(true);
    expect(action.props.accessibilityState).toEqual({ disabled: true });
    expect(action.findByType(Typography).props.color).toBe('disabled');
  });

  it('gives the header a minimum height, never a fixed one', () => {
    const rendered = render(<Screen title="Timer">{null}</Screen>);

    const style = StyleSheet.flatten(
      byTestId(rendered, 'screen-header').props.style,
    );
    expect(style.minHeight).toBe(sizes.headerMin);
    expect(style.height).toBeUndefined();
  });

  it('keeps the header out of the scrolling content', () => {
    const rendered = render(
      <Screen title="History" scrollable>
        {null}
      </Screen>,
    );

    const scroll = rendered.root.findByType(ScrollView);
    expect(scroll.findAllByProps({ testID: 'screen-header' })).toHaveLength(0);
    expect(
      rendered.root.findAllByProps({ testID: 'screen-header' }),
    ).not.toHaveLength(0);
  });
});
