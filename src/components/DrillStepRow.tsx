import { memo, useCallback, type ElementRef } from 'react';

import {
  AccessibilityInfo,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Theme } from '@/theme/theme';
import type { DrillStep } from '@/types/drill';
import { useTheme, useThemedStyles } from '@hooks/useTheme';
import { stepTypeDescription } from '@utils/drill';
import { formatSeconds, spokenSeconds } from '@utils/format';

import { Icon } from './Icon';
import { Typography } from './Typography';

/** The accessibility actions that move a step one place. */
const MOVE_UP = 'moveUp';
const MOVE_DOWN = 'moveDown';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Wraps, so large text drops the controls after the step's name to a
    // line of their own instead of squeezing the name.
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      // Sends the controls to the right edge when they wrap.
      justifyContent: 'flex-end',
      columnGap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      paddingLeft: theme.spacing.xxs,
      paddingRight: theme.spacing.xs,
      borderBottomWidth: theme.sizes.rule,
      borderBottomColor: theme.colors.border,
    },
    grip: {
      width: theme.sizes.gripWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeTrigger: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      justifyContent: 'center',
      minHeight: theme.sizes.touchTarget,
      gap: theme.spacing.xxs,
    },
    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    name: { flexShrink: 1 },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    // A minimum on both sides, so a par set in large text grows the box.
    parBox: {
      minWidth: theme.sizes.parBoxMin,
      minHeight: theme.sizes.touchTarget,
      paddingHorizontal: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    iconButton: {
      width: theme.sizes.touchTarget,
      height: theme.sizes.touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Rotating the glyph points the chevron down. The rotation sits inside
    // the button, not on it: Android stops delivering presses to a touchable
    // that is both rotated and given a `hitSlop`.
    downGlyph: { transform: [{ rotate: '90deg' }] },
  });

type DrillStepRowProps = {
  step: DrillStep;
  /** Where the step sits in the drill, counted from 0. */
  position: number;
  /**
   * Whether the step can move one place up, or down: not past either end
   * of the list, and never so a draw leaves first place (`canMoveStep`).
   */
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** What the step is called in the sequence, e.g. "Shot 2". */
  label: string;
  /** Whether the row is the one being dragged. */
  lifted?: boolean;
  /** Narrowest the step's name may get before the row wraps. */
  labelMinWidth: number;
  /** Open the step type sheet for the step with this id. */
  onEditType: (id: string) => void;
  /** Open the par picker for the step with this id. */
  onEditPar: (id: string) => void;
  onRemove: (id: string) => void;
  /** Move the step with this id to `toPosition`, counted from 0. */
  onMove: (id: string, toPosition: number) => void;
  /**
   * Hands the screen the step's remove button (and `null` when it goes),
   * so it can put the reader's focus there once a neighbour is removed.
   */
  registerRemove?: (
    id: string,
    node: ElementRef<typeof TouchableOpacity> | null,
  ) => void;
};

/**
 * One step of the drill editor, a ruled row in the steps box: its name
 * ("Shot 2") over what its type means, which opens the step type sheet;
 * then its par box and a remove button. A step that can move shows a grip:
 * `DraggableStep` around the row does the dragging, and the same moves are
 * accessibility actions here, for a screen reader.
 * Memoised so typing the drill's name, or changing one step, does not draw
 * every other row again.
 */
export const DrillStepRow = memo(
  ({
    step,
    position,
    canMoveUp,
    canMoveDown,
    label,
    lifted = false,
    labelMinWidth,
    onEditType,
    onEditPar,
    onRemove,
    onMove,
    registerRemove,
  }: DrillStepRowProps) => {
    const styles = useThemedStyles(createStyles);
    const { sizes } = useTheme();
    const number = position + 1;
    const stepId = step.id;
    const removeRef = useCallback(
      (node: ElementRef<typeof TouchableOpacity> | null) =>
        registerRemove?.(stepId, node),
      [registerRemove, stepId],
    );

    const moveActions = [
      ...(canMoveUp ? [{ name: MOVE_UP, label: 'Move up' }] : []),
      ...(canMoveDown ? [{ name: MOVE_DOWN, label: 'Move down' }] : []),
    ];

    const move = (direction: 'up' | 'down') => {
      const to = direction === 'up' ? position - 1 : position + 1;
      onMove(step.id, to);
      // The row is redrawn in its new place and its number changes under
      // the reader's focus: say where it went.
      AccessibilityInfo.announceForAccessibility(
        `Moved step ${number}, ${label}, ${direction} to step ${to + 1}`,
      );
    };

    return (
      <View style={styles.row} testID={`row-step-${position}`}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.grip}
          testID={`grip-step-${position}`}
        >
          {canMoveUp || canMoveDown ? (
            <Icon
              name="grip"
              size={sizes.iconMd}
              color={lifted ? 'primary' : 'textSecondary'}
            />
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => onEditType(step.id)}
          accessibilityRole="button"
          accessibilityLabel={`Step ${number}, ${label}. Change type`}
          accessibilityActions={moveActions}
          onAccessibilityAction={event => {
            const action = event.nativeEvent.actionName;
            if (action === MOVE_UP || action === MOVE_DOWN) {
              move(action === MOVE_UP ? 'up' : 'down');
            }
          }}
          style={[styles.typeTrigger, { minWidth: labelMinWidth }]}
          testID={`select-step-${position}`}
        >
          <View style={styles.nameLine}>
            <Typography
              variant="bodyStrong"
              style={styles.name}
              testID={`text-step-label-${position}`}
            >
              {label}
            </Typography>
            <View style={styles.downGlyph}>
              <Icon name="chevron" size={sizes.iconSm} color="textPrimary" />
            </View>
          </View>
          <Typography variant="label" color="textSecondary">
            {stepTypeDescription(step.type)}
          </Typography>
        </TouchableOpacity>

        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => onEditPar(step.id)}
            accessibilityRole="button"
            accessibilityLabel={
              step.par === undefined
                ? `Set par for step ${number}`
                : `Change par for step ${number}, currently ${spokenSeconds(
                    step.par,
                  )}`
            }
            style={styles.parBox}
            testID={`btn-par-step-${position}`}
          >
            <Typography
              variant="metricSmall"
              color={step.par === undefined ? 'textSecondary' : 'textPrimary'}
            >
              {step.par === undefined ? '+ par' : formatSeconds(step.par)}
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            ref={removeRef}
            onPress={() => {
              onRemove(step.id);
              // The row, and the reader's focus with it, is gone: say so.
              AccessibilityInfo.announceForAccessibility(
                `Removed step ${number}, ${label}`,
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove step ${number}, ${label}`}
            style={styles.iconButton}
            testID={`btn-remove-step-${position}`}
          >
            <Icon name="close" size={sizes.iconMd} color="textSecondary" />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

DrillStepRow.displayName = 'DrillStepRow';
