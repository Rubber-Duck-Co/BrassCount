import { AccessibilityInfo, type ScrollView } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useStepDrag, type UseStepDragResult } from '../src/hooks/useStepDrag';
import type { DrillStep } from '../src/types/drill';

const ROW_HEIGHT = 60;
const VIEWPORT_TOP = 100;
const VIEWPORT_HEIGHT = 800;
const CONTENT_HEIGHT = 2000;

const STEPS: readonly DrillStep[] = [
  { id: 'a', type: 'shot' },
  { id: 'b', type: 'shot' },
  { id: 'c', type: 'shot' },
  { id: 'd', type: 'shot' },
];

type Harness = {
  current: () => UseStepDragResult;
  onMove: jest.Mock<void, [string, number]>;
  scrollTo: jest.Mock;
  tree: ReactTestRenderer;
};

const mounted: ReactTestRenderer[] = [];

/** Mount the hook on four 60dp rows in a list that can scroll. */
const mount = async (): Promise<Harness> => {
  let latest: UseStepDragResult | undefined;
  const onMove = jest.fn<void, [string, number]>();
  const scrollTo = jest.fn();
  const scrollRef = {
    current: {
      scrollTo,
      getNativeScrollRef: () => ({
        measureInWindow: (callback: (x: number, y: number) => void) =>
          callback(0, VIEWPORT_TOP),
      }),
    } as unknown as ScrollView,
  };

  const Probe = () => {
    latest = useStepDrag({ steps: STEPS, onMove, scrollRef });
    return null;
  };

  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = create(<Probe />);
  });
  if (tree === undefined || latest === undefined) {
    throw new Error('render failed');
  }
  mounted.push(tree);

  const current = () => latest as UseStepDragResult;
  act(() => {
    STEPS.forEach(step => current().measureRow(step.id, ROW_HEIGHT));
    current().scrollProps.onLayout({
      nativeEvent: { layout: { height: VIEWPORT_HEIGHT } },
    } as never);
    current().scrollProps.onContentSizeChange(0, CONTENT_HEIGHT);
  });

  return { current, onMove, scrollTo, tree };
};

describe('useStepDrag', () => {
  let frames: ((time: number) => void)[];

  /** Run the frame the hook is waiting on, which asks for the next. */
  const runFrame = () => {
    const frame = frames.shift();
    act(() => frame?.(0));
  };

  beforeEach(() => {
    frames = [];
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {
      frames = [];
    });
    // Lands at once, so a drop needs no animation to finish.
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    jest.restoreAllMocks();
  });

  it('moves the step on a drop, straight away under reduced motion', async () => {
    const { current, onMove } = await mount();

    act(() => {
      current().beginDrag('a');
      current().updateDrag('a', ROW_HEIGHT, 400);
    });
    act(() => current().endDrag('a', false));

    expect(onMove).toHaveBeenCalledWith('a', 1);
    expect(current().drag).toBeNull();
  });

  it('turns the list’s own scrolling off for the length of a drag', async () => {
    const { current } = await mount();
    expect(current().scrollProps.scrollEnabled).toBe(true);

    act(() => current().beginDrag('a'));
    expect(current().scrollProps.scrollEnabled).toBe(false);

    act(() => current().endDrag('a', true));
    expect(current().scrollProps.scrollEnabled).toBe(true);
  });

  it('ignores a second row while one is being dragged', async () => {
    const { current, onMove } = await mount();

    act(() => {
      current().beginDrag('a');
      current().beginDrag('b');
      current().updateDrag('b', ROW_HEIGHT * 3, 400);
    });
    expect(current().drag?.id).toBe('a');
    expect(current().drag?.to).toBe(0);

    act(() => current().endDrag('b', false));
    expect(current().drag?.id).toBe('a');
    expect(onMove).not.toHaveBeenCalled();

    act(() => current().endDrag('a', true));
    act(() => current().beginDrag('b'));
    expect(current().drag?.id).toBe('b');
  });

  it('keeps a taken-away drag out of the list', async () => {
    const { current, onMove } = await mount();

    act(() => {
      current().beginDrag('a');
      current().updateDrag('a', ROW_HEIGHT * 2, 400);
    });
    act(() => current().endDrag('a', true));

    expect(onMove).not.toHaveBeenCalled();
    expect(current().drag).toBeNull();
  });

  it('does not scroll until the finger’s place is known, or away from the edges', async () => {
    const { current, scrollTo } = await mount();

    act(() => current().beginDrag('a'));
    runFrame();
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => current().updateDrag('a', 0, VIEWPORT_TOP + 400));
    runFrame();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls down under a row held at the bottom edge, carrying it along', async () => {
    const { current, onMove, scrollTo } = await mount();

    act(() => {
      current().beginDrag('a');
      current().updateDrag('a', 0, VIEWPORT_TOP + VIEWPORT_HEIGHT);
    });
    // Enough frames at the most per frame to pass two 60dp rows.
    for (let i = 0; i < 10; i += 1) {
      runFrame();
    }

    expect(scrollTo).toHaveBeenLastCalledWith({ y: 140, animated: false });
    expect(current().drag?.to).toBe(2);

    act(() => current().endDrag('a', false));
    expect(onMove).toHaveBeenCalledWith('a', 2);
  });

  it('stops scrolling at the top of the list', async () => {
    const { current, scrollTo } = await mount();

    act(() => {
      current().beginDrag('d');
      current().updateDrag('d', 0, VIEWPORT_TOP);
    });
    runFrame();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops scrolling at the end of the list', async () => {
    const { current, scrollTo } = await mount();

    act(() => {
      current().scrollProps.onScroll({
        nativeEvent: { contentOffset: { y: 1195 } },
      } as never);
      current().beginDrag('a');
      current().updateDrag('a', 0, VIEWPORT_TOP + VIEWPORT_HEIGHT);
    });
    runFrame();
    runFrame();

    // The content is 1200 further than the viewport shows.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 1200, animated: false });
  });

  it('stops asking for frames once the drag ends or the screen goes', async () => {
    const { current, tree } = await mount();

    act(() => current().beginDrag('a'));
    expect(frames).toHaveLength(1);
    act(() => current().endDrag('a', true));
    expect(frames).toHaveLength(0);

    act(() => current().beginDrag('a'));
    expect(frames).toHaveLength(1);
    act(() => tree.unmount());
    mounted.splice(0);
    expect(frames).toHaveLength(0);
  });
});

describe('useStepDrag with motion', () => {
  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    jest.restoreAllMocks();
  });

  it('drops nothing when the screen goes before the row has landed', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    const { current, onMove, tree } = await mount();

    act(() => {
      current().beginDrag('a');
      current().updateDrag('a', ROW_HEIGHT, 400);
    });
    act(() => current().endDrag('a', false));
    act(() => tree.unmount());
    mounted.splice(0);

    expect(onMove).not.toHaveBeenCalled();
  });
});
