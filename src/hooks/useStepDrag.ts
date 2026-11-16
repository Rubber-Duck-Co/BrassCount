import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';

import {
  AccessibilityInfo,
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import type { DrillStep } from '@/types/drill';
import { stepLabel } from '@utils/drill';
import {
  clampTranslation,
  dropPosition,
  dropTranslation,
  edgeScrollStep,
  slotOffset,
  STEP_DRAG_SETTLE_MS,
} from '@utils/stepDrag';

import { useReduceMotion } from './useReduceMotion';

/** How far from the viewport's edge a held row starts it scrolling. */
const EDGE_ZONE = 72;
/** The most the viewport scrolls in one frame, with the row at its edge. */
const EDGE_MAX_STEP = 14;

export type StepDragState = {
  id: string;
  /** Where the step sits, counted from 0. Fixed for the whole drag. */
  from: number;
  /** Where it would land if let go now. */
  to: number;
  /** How far down the list the landing place is. */
  slotTop: number;
  /** The dragged row's height, which the rows it passes move aside by. */
  height: number;
};

type Gesture = {
  id: string;
  heights: readonly number[];
  translationY: number;
  fingerY: number;
  /** How far the list has scrolled under the row since the drag began. */
  scrolled: number;
};

export type UseStepDragResult = {
  /** The drag under way, until its row has landed. */
  drag: StepDragState | null;
  /** How far the dragged row has travelled. */
  dragY: Animated.Value;
  beginDrag: (id: string) => void;
  updateDrag: (id: string, translationY: number, fingerY: number) => void;
  endDrag: (id: string, canceled: boolean) => void;
  measureRow: (id: string, height: number) => void;
  /** For the ScrollView the list sits in. */
  scrollProps: {
    scrollEnabled: boolean;
    scrollEventThrottle: number;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    onContentSizeChange: (width: number, height: number) => void;
  };
};

type Options = {
  steps: readonly DrillStep[];
  onMove: (id: string, toPosition: number) => void;
  scrollRef: RefObject<ScrollView | null>;
};

/**
 * Holds one drag of a step up or down the drill editor's list, from the
 * gesture's first event to the drop. The rows are moved with transforms and
 * the list only changes once the row has landed, so a drag the system takes
 * away, or one let go where it began, leaves the draft as it was.
 *
 * The gesture reads through refs and only the landing place is React state,
 * so the rows redraw when that changes, not on every finger movement.
 */
export const useStepDrag = ({
  steps,
  onMove,
  scrollRef,
}: Options): UseStepDragResult => {
  const reduceMotion = useReduceMotion();
  const [drag, setDrag] = useState<StepDragState | null>(null);
  const [dragY] = useState(() => new Animated.Value(0));

  const rowHeights = useRef(new Map<string, number>());
  const gesture = useRef<Gesture | null>(null);
  // Set from the start of a drag until its row has landed.
  const busy = useRef(false);
  const frame = useRef<number | null>(null);
  const settling = useRef<Animated.CompositeAnimation | null>(null);
  const scrollY = useRef(0);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const viewportTop = useRef<number | null>(null);

  const latest = useRef({ steps, onMove, reduceMotion });
  useEffect(() => {
    latest.current = { steps, onMove, reduceMotion };
  });

  // Hands the value to the native driver from the start, as the rows beside
  // it are: a value only ever set from JS does not move a view that also
  // holds native animations.
  useEffect(() => {
    const animation = Animated.timing(dragY, {
      toValue: 0,
      duration: 0,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [dragY]);

  const stopFrames = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopFrames();
      settling.current?.stop();
    },
    [stopFrames],
  );

  const landAt = useCallback((heights: readonly number[], to: number) => {
    setDrag(previous =>
      previous === null || previous.to === to
        ? previous
        : {
            ...previous,
            to,
            slotTop: slotOffset({ heights, from: previous.from, to }),
          },
    );
  }, []);

  /** Puts the row under the finger, and the landing place with it. */
  const place = useCallback(() => {
    const current = gesture.current;
    if (current === null) {
      return;
    }
    const translationY = current.translationY + current.scrolled;
    const from = latest.current.steps.findIndex(step => step.id === current.id);
    dragY.setValue(
      clampTranslation({ heights: current.heights, from, translationY }),
    );
    const to = dropPosition({
      steps: latest.current.steps,
      id: current.id,
      heights: current.heights,
      translationY,
    });
    if (to >= 0) {
      landAt(current.heights, to);
    }
  }, [dragY, landAt]);

  const scrollFrame = useCallback(() => {
    const current = gesture.current;
    if (current === null) {
      frame.current = null;
      return;
    }
    const top = viewportTop.current;
    if (top !== null) {
      const by = edgeScrollStep({
        fingerY: current.fingerY,
        viewport: { top, bottom: top + viewportHeight.current },
        zone: EDGE_ZONE,
        maxStep: EDGE_MAX_STEP,
      });
      const furthest = Math.max(
        0,
        contentHeight.current - viewportHeight.current,
      );
      const y = Math.min(furthest, Math.max(0, scrollY.current + by));
      if (y !== scrollY.current) {
        scrollRef.current?.scrollTo({ y, animated: false });
        current.scrolled += y - scrollY.current;
        scrollY.current = y;
        place();
      }
    }
    frame.current = requestAnimationFrame(scrollFrame);
  }, [place, scrollRef]);

  const beginDrag = useCallback(
    (id: string) => {
      const from = latest.current.steps.findIndex(step => step.id === id);
      // Another row's drag waits for the one before it to land.
      if (busy.current || from < 0) {
        return;
      }
      busy.current = true;
      const heights = latest.current.steps.map(
        step => rowHeights.current.get(step.id) ?? 0,
      );
      gesture.current = {
        id,
        heights,
        translationY: 0,
        // Clear of both edges until the first movement says where it is.
        fingerY: Number.NaN,
        scrolled: 0,
      };
      dragY.setValue(0);
      setDrag({
        id,
        from,
        to: from,
        slotTop: slotOffset({ heights, from, to: from }),
        height: heights[from] ?? 0,
      });
      viewportTop.current = null;
      scrollRef.current?.getNativeScrollRef?.()?.measureInWindow((_x, y) => {
        viewportTop.current = y;
      });
      frame.current = requestAnimationFrame(scrollFrame);
    },
    [dragY, scrollFrame, scrollRef],
  );

  const updateDrag = useCallback(
    (id: string, translationY: number, fingerY: number) => {
      const current = gesture.current;
      if (current === null || current.id !== id) {
        return;
      }
      current.translationY = translationY;
      current.fingerY = fingerY;
      place();
    },
    [place],
  );

  const endDrag = useCallback(
    (id: string, canceled: boolean) => {
      const current = gesture.current;
      if (current === null || current.id !== id) {
        return;
      }
      gesture.current = null;
      stopFrames();

      const { steps: list, reduceMotion: still } = latest.current;
      const from = list.findIndex(step => step.id === id);
      const landing = dropPosition({
        steps: list,
        id,
        heights: current.heights,
        translationY: current.translationY + current.scrolled,
      });
      // A drag the system took away goes back where it began.
      const to = canceled || landing < 0 ? from : landing;

      const finish = () => {
        settling.current = null;
        busy.current = false;
        if (to !== from) {
          latest.current.onMove(id, to);
          // The row's number changed under the reader: say where it went.
          AccessibilityInfo.announceForAccessibility(
            `Moved step ${from + 1}, ${stepLabel(list, from)}, to step ${
              to + 1
            }`,
          );
        }
        setDrag(null);
      };

      landAt(current.heights, to);
      if (still) {
        finish();
        return;
      }
      const animation = Animated.timing(dragY, {
        toValue: dropTranslation({ heights: current.heights, from, to }),
        duration: STEP_DRAG_SETTLE_MS,
        useNativeDriver: true,
      });
      settling.current = animation;
      // Only cut short when the screen goes, and the draft with it.
      animation.start(({ finished }) => {
        if (finished) {
          finish();
        }
      });
    },
    [dragY, landAt, stopFrames],
  );

  const measureRow = useCallback((id: string, height: number) => {
    rowHeights.current.set(id, height);
  }, []);

  const dragging = drag !== null;
  // With the commit that puts the row in its new place, not before it: the
  // value reaches the screen at once, and the row would jump back for a frame.
  useLayoutEffect(() => {
    if (!dragging) {
      dragY.setValue(0);
    }
  }, [dragging, dragY]);

  const scrollProps = useMemo(
    () => ({
      // The drag moves the list itself, and a finger on a row must not.
      scrollEnabled: !dragging,
      scrollEventThrottle: 16,
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        // While a drag scrolls, these arrive late and `scrollY` is ahead.
        if (gesture.current === null) {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }
      },
      onLayout: (event: LayoutChangeEvent) => {
        viewportHeight.current = event.nativeEvent.layout.height;
      },
      onContentSizeChange: (_width: number, height: number) => {
        contentHeight.current = height;
      },
    }),
    [dragging],
  );

  return {
    drag,
    dragY,
    beginDrag,
    updateDrag,
    endDrag,
    measureRow,
    scrollProps,
  };
};
