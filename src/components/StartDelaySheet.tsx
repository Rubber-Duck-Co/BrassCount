import { useState } from 'react';

import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import type { Theme } from '@/theme/theme';
import {
  MAX_START_DELAY_MS,
  MIN_START_DELAY_MS,
  type StartDelayRange,
} from '@/types/profile';
import { useThemedStyles } from '@hooks/useTheme';
import {
  describeStartDelay,
  formatStartDelay,
  spokenStartDelay,
  spokenStartDelayRange,
  stepStartDelay,
} from '@utils/startSettings';

import { BottomSheet, SHEET_CONTENT_MAX_HEIGHT_RATIO } from './BottomSheet';
import { Button } from './Button';
import { Typography } from './Typography';

type StartDelaySheetProps = {
  visible: boolean;
  /** The range in use, which the sheet starts from each time it opens. */
  value: StartDelayRange;
  onSave: (range: StartDelayRange) => void;
  /** Called when the sheet is dismissed without saving. */
  onClose: () => void;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { gap: theme.spacing.md },
    // Label above, controls below: on one line the label is squeezed to a
    // sliver at the largest text size.
    stepper: { gap: theme.spacing.sm },
    stepperLabel: { gap: theme.spacing.xxs },
    stepperControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    // A square ruled box, as wide as it is tall at the default font size.
    stepButton: {
      minWidth: theme.sizes.touchTarget,
      paddingHorizontal: theme.spacing.none,
    },
    stepValue: { flex: 1 },
    // Side by side, like a confirm sheet's Cancel and confirm.
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.inset,
      marginTop: theme.spacing.sm,
    },
    action: { flex: 1, minHeight: theme.sizes.sheetActionMin },
  });

type StepperProps = {
  label: string;
  hint: string;
  valueMs: number;
  /** The value cannot go below this. */
  floorMs: number;
  /** The value cannot go above this. */
  ceilingMs: number;
  onChange: (ms: number) => void;
  /** Prefix for the stepper's `testID`s. */
  testID: string;
};

/** One end of the range: its value, and a button either side to change it. */
const Stepper = ({
  label,
  hint,
  valueMs,
  floorMs,
  ceilingMs,
  onChange,
  testID,
}: StepperProps) => {
  const styles = useThemedStyles(createStyles);
  const subject = label.toLowerCase();

  return (
    <View style={styles.stepper}>
      <View style={styles.stepperLabel}>
        <Typography variant="bodyStrong">{label}</Typography>
        <Typography variant="caption" color="textSecondary">
          {hint}
        </Typography>
      </View>
      <View style={styles.stepperControls}>
        <Button
          label="−"
          variant="secondary"
          accessibilityLabel={`Shorten the ${subject} delay`}
          disabled={valueMs <= floorMs}
          onPress={() =>
            onChange(stepStartDelay(valueMs, -1, floorMs, ceilingMs))
          }
          style={styles.stepButton}
          testID={`${testID}-shorter`}
        />
        <Typography
          variant="metric"
          align="center"
          style={styles.stepValue}
          accessibilityLabel={`${label} delay, ${spokenStartDelay(valueMs)}`}
          accessibilityLiveRegion="polite"
          testID={`${testID}-value`}
        >
          {formatStartDelay(valueMs)}
        </Typography>
        <Button
          label="+"
          variant="secondary"
          accessibilityLabel={`Lengthen the ${subject} delay`}
          disabled={valueMs >= ceilingMs}
          onPress={() =>
            onChange(stepStartDelay(valueMs, 1, floorMs, ceilingMs))
          }
          style={styles.stepButton}
          testID={`${testID}-longer`}
        />
      </View>
    </View>
  );
};

/**
 * Bottom sheet for the range the random start delay comes from. The two
 * ends move in half-second steps between 1 and 10 s, and neither can
 * pass the other: equal ends make a fixed delay. Nothing is kept until
 * Save, which calls `onSave`; closing the sheet is left to the caller,
 * through `visible`.
 */
export const StartDelaySheet = ({
  visible,
  value,
  onSave,
  onClose,
}: StartDelaySheetProps) => {
  const styles = useThemedStyles(createStyles);
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<StartDelayRange>(value);
  const [wasVisible, setWasVisible] = useState(visible);

  // Each opening starts from the range in use, not from an earlier,
  // unsaved edit. Reset while rendering the opening, so its first frame
  // already shows it; nothing resets the draft while the sheet is up.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Close start delay picker"
      title="Start delay"
      closeTestID="btn-start-delay-close"
      backdropTestID="btn-start-delay-backdrop"
    >
      {/* Scrolls when large text makes the sheet taller than the screen
          allows, so Save stays reachable. */}
      <ScrollView
        style={{ maxHeight: height * SHEET_CONTENT_MAX_HEIGHT_RATIO }}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        <Typography
          variant="body"
          color="textSecondary"
          accessibilityLabel={spokenStartDelayRange(draft)}
          testID="text-start-delay-summary"
        >
          {describeStartDelay(draft)}
        </Typography>

        <Stepper
          label="Shortest"
          hint="The beep never comes sooner"
          valueMs={draft.minMs}
          floorMs={MIN_START_DELAY_MS}
          ceilingMs={draft.maxMs}
          onChange={minMs => setDraft(current => ({ ...current, minMs }))}
          testID="stepper-start-delay-min"
        />
        <Stepper
          label="Longest"
          hint="The beep never comes later"
          valueMs={draft.maxMs}
          floorMs={draft.minMs}
          ceilingMs={MAX_START_DELAY_MS}
          onChange={maxMs => setDraft(current => ({ ...current, maxMs }))}
          testID="stepper-start-delay-max"
        />

        <View style={styles.actions}>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={onClose}
            style={styles.action}
            testID="btn-start-delay-cancel"
          />
          <Button
            label="Save"
            variant="primary"
            onPress={() => onSave(draft)}
            style={styles.action}
            testID="btn-start-delay-save"
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};
