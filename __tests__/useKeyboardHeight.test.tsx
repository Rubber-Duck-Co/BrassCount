import { Keyboard, Platform } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight';

type Listener = (event: { endCoordinates: { height: number } }) => void;

/** What the hook last returned. */
let seen: number | undefined;

const Probe = () => {
  seen = useKeyboardHeight();
  return null;
};

/** Stands in for the keyboard's show and hide events. */
const fakeKeyboard = () => {
  const listeners = new Map<string, Set<Listener>>();
  const remove = jest.fn();

  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    listener: Listener,
  ) => {
    const forEvent = listeners.get(event) ?? new Set<Listener>();
    forEvent.add(listener);
    listeners.set(event, forEvent);
    return {
      remove: () => {
        remove();
        forEvent.delete(listener);
      },
    };
  }) as unknown as typeof Keyboard.addListener);

  const emit = (event: string, height = 0) =>
    listeners
      .get(event)
      ?.forEach(listener => listener({ endCoordinates: { height } }));

  return {
    remove,
    show: (height: number) => emit('keyboardDidShow', height),
    hide: () => emit('keyboardDidHide'),
    listening: () =>
      [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
};

const mounted: ReactTestRenderer[] = [];

const mountProbe = (): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<Probe />);
  });
  mounted.push(tree as ReactTestRenderer);
  return tree as ReactTestRenderer;
};

const setAndroidVersion = (version: number) => {
  Object.defineProperty(Platform, 'Version', {
    configurable: true,
    get: () => version,
  });
};

beforeEach(() => setAndroidVersion(36));

afterEach(() => {
  mounted.splice(0).forEach(tree => act(() => tree.unmount()));
  jest.restoreAllMocks();
  seen = undefined;
});

describe('useKeyboardHeight', () => {
  it('reads 0 while the keyboard is closed', () => {
    fakeKeyboard();

    mountProbe();

    expect(seen).toBe(0);
  });

  it('follows the keyboard up and back down', () => {
    const keyboard = fakeKeyboard();
    mountProbe();

    act(() => keyboard.show(840));
    expect(seen).toBe(840);

    act(() => keyboard.hide());
    expect(seen).toBe(0);
  });

  it('stays 0 on Android 14 and older, where the window is resized instead', () => {
    setAndroidVersion(34);
    const keyboard = fakeKeyboard();
    mountProbe();

    act(() => keyboard.show(840));

    expect(seen).toBe(0);
    expect(keyboard.listening()).toBe(0);
  });

  it('stops listening when the component unmounts', () => {
    const keyboard = fakeKeyboard();
    const tree = mountProbe();
    expect(keyboard.listening()).toBe(2);

    act(() => tree.unmount());

    expect(keyboard.remove).toHaveBeenCalledTimes(2);
    expect(keyboard.listening()).toBe(0);
  });
});
