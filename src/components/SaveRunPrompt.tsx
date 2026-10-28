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
  onDiscard: () => void;
  /** Opens the saved run's drill in History. */
  onView: () => void;
};

/**
 * Above this font scale Discard and Save no longer fit side by side on a
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
    discard: { minHeight: theme.sizes.mainActionMin },
    // Save takes twice Discard's width: it is the main action.
    discardBeside: { flex: 1 },
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
    savedLabel: { flexShrink: 1 },
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
 * Whether a finished run goes into History, as the Timer's main action:
 * Save run, with Discard beside it. Nothing is stored until Save is
 * pressed; Discard drops the run. Once saved, an Ink bar says so, with a
 * link to the drill's runs, and the screen puts Start back under it.
 */
export const SaveRunPrompt = ({
  completed,
  status,
  failure,
  onSave,
  onDiscard,
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
            {completed ? 'Saved to History' : 'Saved to History as incomplete'}
          </Typography>
        </View>
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel="View in History"
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
          label="Discard"
          variant="secondary"
          disabled={saving}
          onPress={onDiscard}
          accessibilityLabel="Discard run"
          style={[styles.discard, !stacked && styles.discardBeside]}
          testID="btn-discard-run"
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
