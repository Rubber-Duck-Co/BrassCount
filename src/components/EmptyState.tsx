import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useThemedStyles } from '@hooks/useTheme';

import { Button } from './Button';
import { Typography } from './Typography';

/**
 * What the mark box says: `new` (+) for a list that is waiting for its
 * first item, `error` (!) for one that failed to load, `empty` (—) for one
 * with nothing in it that the shooter cannot add here.
 */
export type EmptyStateMark = 'new' | 'error' | 'empty';

const MARK_GLYPHS: Record<EmptyStateMark, string> = {
  new: '+',
  error: '!',
  empty: '—',
};

type EmptyStateProps = {
  mark: EmptyStateMark;
  title: string;
  message: string;
  actionLabel?: string;
  onActionPress?: () => void;
  /** `primary` only when the action is the way forward (Create drill). */
  actionVariant?: 'primary' | 'secondary';
  actionTestID?: string;
  /**
   * Another way forward, under the main action and always secondary (Browse
   * presets under New drill). Shown only with both a label and a handler.
   */
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
  secondaryActionTestID?: string;
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'flex-start',
      gap: theme.spacing.inset,
    },
    mark: {
      // Minimums, so the glyph grows the box at a large system font.
      minWidth: theme.sizes.markBox,
      minHeight: theme.sizes.markBox,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
      alignItems: 'center',
      justifyContent: 'center',
    },
    action: {
      alignSelf: 'stretch',
      marginTop: theme.spacing.xs,
    },
    // Under the main action, the container's gap apart.
    secondaryAction: { alignSelf: 'stretch' },
  });

/**
 * Shown when a list has nothing in it, or could not be read — never leave
 * a blank screen. Content only: place it inside a `Card`, which draws the
 * ruled box around it.
 */
export const EmptyState = ({
  mark,
  title,
  message,
  actionLabel,
  onActionPress,
  actionVariant = 'secondary',
  actionTestID,
  secondaryActionLabel,
  onSecondaryActionPress,
  secondaryActionTestID,
  testID,
}: EmptyStateProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container} testID={testID}>
      {/* Decoration: the title already says what the mark means. */}
      <View
        style={styles.mark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={testID ? `${testID}-mark` : undefined}
      >
        <Typography variant="stencilSmall">{MARK_GLYPHS[mark]}</Typography>
      </View>

      <Typography variant="subtitle" accessibilityRole="header">
        {title}
      </Typography>
      <Typography variant="body" color="textSecondary">
        {message}
      </Typography>

      {actionLabel && onActionPress ? (
        <Button
          label={actionLabel}
          variant={actionVariant}
          onPress={onActionPress}
          style={styles.action}
          testID={actionTestID}
        />
      ) : null}

      {secondaryActionLabel && onSecondaryActionPress ? (
        <Button
          label={secondaryActionLabel}
          variant="secondary"
          onPress={onSecondaryActionPress}
          style={styles.secondaryAction}
          testID={secondaryActionTestID}
        />
      ) : null}
    </View>
  );
};
