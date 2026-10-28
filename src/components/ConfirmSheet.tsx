import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useThemedStyles } from '@hooks/useTheme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Typography } from './Typography';

type ConfirmSheetProps = {
  visible: boolean;
  /** The question being asked, e.g. `Delete "Bill Drill"?`. */
  title: string;
  /** What confirming does, in a sentence. */
  message: string;
  /** Label of the button that goes ahead. */
  confirmLabel: string;
  /** Shown on the confirm button while `busy`, e.g. "Deleting…". */
  busyLabel: string;
  /**
   * The confirmed action is running: both buttons are disabled and the
   * sheet cannot be dismissed until it settles.
   */
  busy?: boolean;
  /** Why the last attempt fell short. Shown above the buttons. */
  error?: string;
  onConfirm: () => void;
  /** Called when the sheet is dismissed without confirming. */
  onCancel: () => void;
  /** Prefix for the `testID`s of the sheet's controls. */
  testID: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    text: { gap: theme.spacing.xs },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.inset,
      marginTop: theme.spacing.sm,
    },
    action: { flex: 1, minHeight: theme.sizes.sheetActionMin },
  });

/**
 * Bottom sheet that asks before something destructive happens: the title
 * row, what confirming does, then Cancel and the confirm button side by
 * side. Confirming calls `onConfirm`; closing the sheet is left to the
 * caller, through `visible`, so it can stay up while the action runs and
 * when it fails.
 */
export const ConfirmSheet = ({
  visible,
  title,
  message,
  confirmLabel,
  busyLabel,
  busy = false,
  error,
  onConfirm,
  onCancel,
  testID,
}: ConfirmSheetProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      closeLabel="Close"
      title={title}
      dismissDisabled={busy}
      backdropTestID={`${testID}-backdrop`}
      closeTestID={`${testID}-close`}
      testID={testID}
    >
      {/* One block, so the empty live region adds no gap of its own. */}
      <View style={styles.text}>
        <Typography variant="body" color="textSecondary">
          {message}
        </Typography>
        {/* Always mounted, so a reader hears the error when it appears. */}
        <View accessibilityLiveRegion="polite">
          {error ? (
            <Typography
              variant="label"
              color="danger"
              testID={`${testID}-error`}
            >
              {error}
            </Typography>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Cancel"
          variant="secondary"
          disabled={busy}
          onPress={onCancel}
          style={styles.action}
          testID={`${testID}-cancel`}
        />
        <Button
          label={busy ? busyLabel : confirmLabel}
          variant="primary"
          busy={busy}
          onPress={onConfirm}
          style={styles.action}
          testID={`${testID}-confirm`}
        />
      </View>
    </BottomSheet>
  );
};
