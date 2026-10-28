import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Typography } from './Typography';

type FailureNoticeAction = {
  label: string;
  onPress: () => void;
  testID?: string;
};

type FailureNoticeProps = {
  /** What went wrong, as the screen's header also says it. */
  message: string;
  /** The way out, when there is one the shooter can take from here. */
  action?: FailureNoticeAction;
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Card fill: Signal is only used here for the outline and the mark.
    box: {
      gap: theme.spacing.inset,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.warning,
      borderRadius: theme.radius.none,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.inset,
    },
    // Drops the mark onto the first line of text.
    mark: { marginTop: theme.spacing.xxs },
    message: { flex: 1 },
  });

/**
 * Why the microphone stopped, or why a run cannot start, in a box ruled in
 * Signal, with the way out under it when there is one. It does not
 * announce itself: the screen that shows it says the message once.
 */
export const FailureNotice = ({
  message,
  action,
  testID,
}: FailureNoticeProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();

  return (
    <View style={styles.box} testID={testID}>
      <View
        style={styles.line}
        accessible
        accessibilityLabel={message}
        testID={testID ? `${testID}-message` : undefined}
      >
        <View style={styles.mark}>
          <Icon name="warning" size={sizes.iconLg} color="warning" />
        </View>
        <Typography variant="subtitle" style={styles.message}>
          {message}
        </Typography>
      </View>

      {action === undefined ? null : (
        <Button
          label={action.label}
          variant="secondary"
          onPress={action.onPress}
          testID={action.testID}
        />
      )}
    </View>
  );
};
