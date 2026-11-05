import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Animated, StyleSheet, View } from 'react-native';

import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import type { Theme } from '@/theme/theme';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { useThemedStyles } from '@hooks/useTheme';
import { STEP_DRAG_SETTLE_MS } from '@utils/stepDrag';

import { Typography } from './Typography';

/** How long a finger rests on a row before the row lifts to follow it. */
const HOLD_MS = 300;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Wider than the list on both sides, with its border and margins evened
    // out by padding, so the row's content stays put as it lifts.
    lifted: {
      zIndex: 1,
      marginHorizontal: -theme.spacing.sm,
      marginVertical: -theme.sizes.border,
      paddingHorizontal: theme.spacing.sm - theme.sizes.border,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
      ...theme.elevation.raised,
    },
    slot: {
      position: 'absolute',
      left: 0,
      right: 0,
      padding: theme.spacing.xs,
    },
    slotBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderStyle: 'dashed',
      borderColor: theme.colors.outline,
    },
    slotLabel: { textTransform: 'uppercase' },
  });

type DraggableStepProps = {
  id: string;
  /** Where the step sits, counted from 0. */
  position: number;
  /** Whether a hold lifts this row: only a step that has somewhere to go. */
  enabled: boolean;
  /** Whether this is the row being dragged. */
  lifted: boolean;
  /** How far the row moves aside for the one being dragged. */
  shift: number;
  /** Whether a drag is under way, so `shift` slides rather than jumps. */
  dragging: boolean;
  /** How far the dragged row has travelled. */
  dragY: Animated.Value;
  onBegin: (id: string) => void;
  onUpdate: (id: string, translationY: number, fingerY: number) => void;
  onEnd: (id: string, canceled: boolean) => void;
  onMeasure: (id: string, height: number) => void;
  children: ReactNode;
};

/**
 * One row of the drill editor's list, which a hold lifts to follow the
 * finger up or down. A move before the hold is up is left to the scroll
 * view, and a tap to the controls inside the row. A drag is out of reach of
 * a screen reader, so the row inside offers the same moves as accessibility
 * actions.
 */
export const DraggableStep = ({
  id,
  position,
  enabled,
  lifted,
  shift,
  dragging,
  dragY,
  onBegin,
  onUpdate,
  onEnd,
  onMeasure,
  children,
}: DraggableStepProps) => {
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReduceMotion();
  const [aside] = useState(() => new Animated.Value(0));

  // With the commit that ends a drag, so the rows do not sit a row off
  // their new places for a frame.
  useLayoutEffect(() => {
    if (!dragging || reduceMotion) {
      aside.setValue(shift);
    }
  }, [aside, shift, dragging, reduceMotion]);

  useEffect(() => {
    if (!dragging || reduceMotion) {
      return undefined;
    }
    const animation = Animated.timing(aside, {
      toValue: shift,
      duration: STEP_DRAG_SETTLE_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [aside, shift, dragging, reduceMotion]);

  // Read through a ref so the gesture is not rebuilt as these change.
  const latest = useRef({ id, onBegin, onUpdate, onEnd });
  useEffect(() => {
    latest.current = { id, onBegin, onUpdate, onEnd };
  });

  const gestureConfig = useMemo(
    () => ({
      enabled,
      activateAfterLongPress: HOLD_MS,
      maxPointers: 1,
      onActivate: () => latest.current.onBegin(latest.current.id),
      onUpdate: (event: { translationY: number; absoluteY: number }) =>
        latest.current.onUpdate(
          latest.current.id,
          event.translationY,
          event.absoluteY,
        ),
      onDeactivate: (event: { canceled: boolean }) =>
        latest.current.onEnd(latest.current.id, event.canceled),
      testID: `drag-step-${position}`,
    }),
    [enabled, position],
  );
  const drag = usePanGesture(gestureConfig);

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        onLayout={event => onMeasure(id, event.nativeEvent.layout.height)}
        style={[
          lifted && styles.lifted,
          { transform: [{ translateY: lifted ? dragY : aside }] },
        ]}
        testID={`draggable-step-${position}`}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

type StepDropSlotProps = {
  /** How far down the list it sits. */
  top: number;
  height: number;
  /** The step number the dragged row would take, counted from 1. */
  number: number;
};

/**
 * The dashed gap where a dragged row would land. Hidden from a screen
 * reader, which moves steps by accessibility action instead.
 */
export const StepDropSlot = ({ top, height, number }: StepDropSlotProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.slot, { top, height }]}
      testID="slot-step-drop"
    >
      <View style={styles.slotBox}>
        <Typography
          variant="sectionLabel"
          color="textSecondary"
          numberOfLines={1}
          style={styles.slotLabel}
        >
          {`Drops in as step ${number}`}
        </Typography>
      </View>
    </View>
  );
};
