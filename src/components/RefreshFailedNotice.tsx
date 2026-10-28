import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useAnnounce } from '@hooks/useAnnounce';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Icon } from './Icon';
import { Typography } from './Typography';

/** What the notice says, and what a screen reader is told when it appears. */
export const REFRESH_FAILED_MESSAGE =
  'Could not refresh. Showing what was loaded earlier.';

type RefreshFailedNoticeProps = {
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.inset,
      padding: theme.spacing.inset,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
      backgroundColor: theme.colors.background,
    },
    // Drops the mark onto the first line of text.
    mark: { marginTop: theme.spacing.xxs },
    message: { flex: 1 },
  });

/**
 * Shown above a list that stayed on screen when reading it again failed, so
 * the shooter knows it may be out of date; the list below stays usable.
 * Rendered only while that is so. A status box on the screen ground, not
 * an error colour: nothing was lost.
 */
export const RefreshFailedNotice = ({ testID }: RefreshFailedNoticeProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();
  useAnnounce(REFRESH_FAILED_MESSAGE);

  return (
    <View
      style={styles.box}
      // Android gives the status role no live region, so the
      // announcement comes from `useAnnounce` alone and is made once.
      role="status"
      accessible
      accessibilityLabel={REFRESH_FAILED_MESSAGE}
      testID={testID}
    >
      <View style={styles.mark}>
        <Icon name="refresh" size={sizes.iconLg} color="textPrimary" />
      </View>
      <Typography variant="body" color="textPrimary" style={styles.message}>
        {REFRESH_FAILED_MESSAGE}
      </Typography>
    </View>
  );
};
