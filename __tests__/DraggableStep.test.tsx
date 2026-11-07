import { AccessibilityInfo, Animated, Text } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { DraggableStep } from '../src/components/DraggableStep';
import { PreferencesProvider } from '../src/store/PreferencesContext';

/** The private fields of `Animated.Value` these tests read. */
type InspectableValue = Animated.Value & {
  __isNative: boolean;
  __getValue: () => number;
};

const mounted: ReactTestRenderer[] = [];

/** One row that is not lifted, moved aside by `shift`. */
const row = (shift: number, dragging: boolean) => (
  <GestureHandlerRootView>
    <PreferencesProvider>
      <DraggableStep
        id="a"
        position={1}
        enabled
        lifted={false}
        shift={shift}
        dragging={dragging}
        dragY={new Animated.Value(0)}
        onBegin={jest.fn()}
        onUpdate={jest.fn()}
        onEnd={jest.fn()}
        onMeasure={jest.fn()}
      >
        <Text>Shot 1</Text>
      </DraggableStep>
    </PreferencesProvider>
  </GestureHandlerRootView>
);

const render = async (shift: number, dragging: boolean) => {
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = create(row(shift, dragging));
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  mounted.push(tree);
  return tree;
};

/** The value the row's `translateY` is bound to. */
const asideOf = (tree: ReactTestRenderer): InspectableValue => {
  const [element] = tree.root.findAllByProps({ testID: 'draggable-step-1' });
  const style = [element.props.style].flat(Infinity) as {
    transform?: { translateY: InspectableValue }[];
  }[];
  const transform = style.find(entry => entry?.transform)?.transform;
  if (transform === undefined) {
    throw new Error('no transform');
  }
  return transform[0].translateY;
};

describe('DraggableStep', () => {
  beforeEach(() => {
    // Rows only ever set from JS here, the path that went wrong on a device.
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
  });

  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    jest.restoreAllMocks();
  });

  it('hands its offset to the native driver when it mounts', async () => {
    const tree = await render(0, false);

    // `__isNative` is private, but it is the only sign in Jest that the
    // native driver holds the value: a JS-only value left rows at stale
    // offsets after a drop on a device.
    expect(asideOf(tree).__isNative).toBe(true);
  });

  it('keeps the offset it mounted with', async () => {
    const tree = await render(40, false);

    expect(asideOf(tree).__getValue()).toBe(40);
  });

  it('goes back to its place when a drag ends', async () => {
    // Arrange: moved aside for a row being dragged past it
    const tree = await render(60, true);

    // Act: the drop
    await act(async () => {
      tree.update(row(0, false));
    });

    // Assert
    expect(asideOf(tree).__getValue()).toBe(0);
  });
});
