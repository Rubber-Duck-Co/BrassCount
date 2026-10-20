import { Keyboard, ScrollView } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Screen } from '../src/components/Screen';

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
});
