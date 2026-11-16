import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import type { RunSaveFailure, RunSaveStatus } from '@hooks/useRunSave';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Typography } from './Typography';

type SaveRunPromptProps = {
  /** Whether every step the run listened for was heard. */
  completed: boolean;
  status: RunSaveStatus;
  failure: RunSaveFailure | null;
  onSave: () => void;
  /** Drops the run without saving it, back to a ready timer. */
  onReset: () => void;
  /** Opens the saved run's drill in Log. */
  onView: () => void;
};

/**
 * Above this font scale Reset and Save no longer fit side by side on a
 * phone, so they are stacked, in the order a screen reader meets them.
 */
const STACK_ACTIONS_ABOVE_FONT_SCALE = 1.3;

const INCOMPLETE_NOTE =
  'Saves as incomplete, left out of your best and average.';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    prompt: { gap: theme.spacing.sm },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.inset,
    },
    actionsStacked: {
      flexDirection: 'column',
      gap: theme.spacing.inset,
    },
    // As tall as the main action beside it; a minimum, like it.
    reset: { minHeight: theme.sizes.mainActionMin },
    // Save takes twice Reset's width: it is the main action.
    resetBeside: { flex: 1 },
    saveBeside: { flex: 2 },
    // The Ink bar that says the run is saved. A minimum height, so a large
    // font grows it.
    saved: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.inset,
      minHeight: theme.sizes.sheetActionMin,
      paddingLeft: theme.spacing.md,
      backgroundColor: theme.colors.inverse,
    },
    savedText: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    // Fills the bar rather than shrinking to its measured width. With
    // `flexShrink: 1`, repeat saves on the Medium_Phone emulator (API 37.1)
    // showed "Saved to" with the last word missing. The cause is believed,
    // not confirmed, to be the label laid out at exactly its measured width
    // and the last word wrapping onto a line the bar hides. Six repeat saves
    // looked right after the change; check on a device, as Jest cannot see
    // text wrap.
    savedLabel: { flex: 1 },
    view: {
      minWidth: theme.sizes.touchTarget,
      minHeight: theme.sizes.touchTarget,
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewLabel: { textDecorationLine: 'underline' },
  });

const failureMessage = (failure: RunSaveFailure): string =>
  failure === 'invalid'
    ? 'This run cannot be saved.'
    : 'Could not save this run. Try again.';

/**
 * Whether a finished run goes into Log, as the Timer's main action:
 * Save run, with Reset beside it. Nothing is stored until Save is
 * pressed; Reset drops the run. Once saved, an Ink bar says so, with a
 * link to the drill's runs, and the screen puts Start back under it.
 */
export const SaveRunPrompt = ({
  completed,
  status,
  failure,
  onSave,
  onReset,
  onView,
}: SaveRunPromptProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > STACK_ACTIONS_ABOVE_FONT_SCALE;

  if (status === 'saved') {
    return (
      <View style={styles.saved} testID="card-save-run">
        <View style={styles.savedText} accessible testID="text-run-saved">
          <Icon name="check" size={sizes.iconLg} color="textOnInverse" />
          <Typography
            variant="bodyStrong"
            color="textOnInverse"
            style={styles.savedLabel}
          >
            {completed ? 'Saved to Log' : 'Saved to Log as incomplete'}
          </Typography>
        </View>
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel="View in Log"
          style={styles.view}
          testID="btn-view-run"
        >
          <Typography
            variant="actionLabel"
            color="textOnInverse"
            style={styles.viewLabel}
          >
            VIEW
          </Typography>
        </Pressable>
      </View>
    );
  }

  const saving = status === 'saving';
  // Storage turned this run down as it is: another press cannot help.
  const refused = failure === 'invalid';

  return (
    <View style={styles.prompt} testID="card-save-run">
      {completed ? null : (
        <Typography
          variant="caption"
          color="textSecondary"
          testID="text-save-run-note"
        >
          {INCOMPLETE_NOTE}
        </Typography>
      )}
      {/* Always mounted, so a reader hears the error when it appears. */}
      <View accessibilityLiveRegion="polite">
        {failure === null ? null : (
          <Typography
            variant="label"
            color="danger"
            testID="text-save-run-error"
          >
            {failureMessage(failure)}
          </Typography>
        )}
      </View>

      <View
        style={stacked ? styles.actionsStacked : styles.actions}
        testID="row-save-run-actions"
      >
        <Button
          label="Reset"
          variant="secondary"
          disabled={saving}
          onPress={onReset}
          accessibilityLabel="Reset without saving"
          style={[styles.reset, !stacked && styles.resetBeside]}
          testID="btn-reset-run"
        />
        <Button
          label={saving ? 'Saving…' : 'Save run'}
          // Said whole while it would save the run as incomplete.
          accessibilityLabel={
            saving || completed ? undefined : 'Save run as incomplete'
          }
          variant="primary"
          size="main"
          busy={saving}
          disabled={saving || refused}
          onPress={onSave}
          style={stacked ? undefined : styles.saveBeside}
          testID="btn-save-run"
        />
      </View>
    </View>
  );
};
