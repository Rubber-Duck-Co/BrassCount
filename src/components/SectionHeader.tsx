import { StyleSheet, TouchableOpacity, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useThemedStyles } from '@hooks/useTheme';

import { Typography } from './Typography';

type SectionHeaderProps = {
  title: string;
  /**
   * Optional right-hand text action, written as a sentence ("Reorder");
   * it is shown in capitals and announced as written.
   */
  actionLabel?: string;
  onActionPress?: () => void;
  /**
   * What a screen reader says for the action, when its visible text alone
   * does not say what it does (a bare "Done").
   */
  actionAccessibilityLabel?: string;
  actionTestID?: string;
  /**
   * Muted directions opposite the title ("Swipe left to delete"), shown in
   * capitals. Hidden from a screen reader, and left out when there is an
   * action.
   */
  hint?: string;
  testID?: string;
};

/**
 * Extra touch area around the text action, taking it up to the 48dp
 * minimum without pushing the header's line apart. The label line is
 * 14dp tall, plus the action's own padding.
 */
const ACTION_HIT_SLOP = { top: 13, bottom: 13, left: 8, right: 8 };

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    // Capitals come from the style, not the string, so TalkBack reads the
    // title as words instead of spelling out the letters.
    title: { flexShrink: 1, textTransform: 'uppercase' },
    // With a hint the title keeps its width and the hint wraps beside it:
    // at a large font a short title such as a count must not break.
    titleBesideHint: { flexShrink: 0 },
    hint: { flexShrink: 1 },
    action: {
      paddingVertical: theme.spacing.xs,
      paddingLeft: theme.spacing.xs,
    },
    actionLabel: {
      textTransform: 'uppercase',
      textDecorationLine: 'underline',
    },
  });

/**
 * The Range Card section label (11 bold, 2px tracking, Pencil) that groups
 * the ruled box beneath it, flush with the box's edge. Announced as a
 * heading, so TalkBack can jump between sections.
 */
export const SectionHeader = ({
  title,
  actionLabel,
  onActionPress,
  actionAccessibilityLabel,
  actionTestID,
  hint,
  testID,
}: SectionHeaderProps) => {
  const styles = useThemedStyles(createStyles);
  const hasAction = Boolean(actionLabel && onActionPress);
  const showHint = !hasAction && Boolean(hint);

  return (
    <View style={styles.row} testID={testID}>
      <Typography
        variant="sectionLabel"
        color="textSecondary"
        accessibilityRole="header"
        style={[styles.title, showHint && styles.titleBesideHint]}
      >
        {title}
      </Typography>

      {hasAction ? (
        <TouchableOpacity
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          hitSlop={ACTION_HIT_SLOP}
          style={styles.action}
          testID={actionTestID}
        >
          <Typography
            variant="sectionLabel"
            color="textPrimary"
            style={styles.actionLabel}
          >
            {actionLabel}
          </Typography>
        </TouchableOpacity>
      ) : showHint ? (
        // Directions for a gesture, which a screen reader does not use: the
        // rows offer the same thing as an accessibility action.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.hint}
          testID={testID ? `${testID}-hint` : undefined}
        >
          <Typography
            variant="sectionLabel"
            color="textSecondary"
            align="right"
            style={styles.title}
          >
            {hint}
          </Typography>
        </View>
      ) : null}
    </View>
  );
};
