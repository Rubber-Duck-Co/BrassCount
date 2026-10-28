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
  testID,
}: SectionHeaderProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row} testID={testID}>
      <Typography
        variant="sectionLabel"
        color="textSecondary"
        accessibilityRole="header"
        style={styles.title}
      >
        {title}
      </Typography>

      {actionLabel && onActionPress ? (
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
      ) : null}
    </View>
  );
};
