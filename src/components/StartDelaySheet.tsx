import { useState } from 'react';

import {
  Pressable,
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

import { BottomSheet } from './BottomSheet';
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

/** The most of the screen's height the sheet's contents take up. */
const SHEET_MAX_HEIGHT_RATIO = 0.8;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    body: {
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    // Label above, controls below: on one line the label is squeezed to a
    // sliver at the largest text size.
    stepper: { gap: theme.spacing.sm },
    stepperLabel: { gap: 2 },
    stepperControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    stepButton: {
      width: theme.sizes.touchTarget,
      height: theme.sizes.touchTarget,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Matches a disabled `Button`.
    stepButtonDisabled: { opacity: 0.5 },
    stepValue: {
      flex: 1,
      textAlign: 'center',
    },
    actions: { gap: theme.spacing.sm },
  });

type StepButtonProps = {
  symbol: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
};

const StepButton = ({
  symbol,
  accessibilityLabel,
  disabled,
  onPress,
  testID,
}: StepButtonProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
      testID={testID}
    >
      <Typography variant="title" color="textPrimary">
        {symbol}
      </Typography>
    </Pressable>
  );
};

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
        <Typography variant="caption" color="textTertiary">
          {hint}
        </Typography>
      </View>
      <View style={styles.stepperControls}>
        <StepButton
          symbol="−"
          accessibilityLabel={`Shorten the ${subject} delay`}
          disabled={valueMs <= floorMs}
          onPress={() =>
            onChange(stepStartDelay(valueMs, -1, floorMs, ceilingMs))
          }
          testID={`${testID}-shorter`}
        />
        <Typography
          variant="metric"
          style={styles.stepValue}
          accessibilityLabel={`${label} delay, ${spokenStartDelay(valueMs)}`}
          accessibilityLiveRegion="polite"
          testID={`${testID}-value`}
        >
          {formatStartDelay(valueMs)}
        </Typography>
        <StepButton
          symbol="+"
          accessibilityLabel={`Lengthen the ${subject} delay`}
          disabled={valueMs >= ceilingMs}
          onPress={() =>
            onChange(stepStartDelay(valueMs, 1, floorMs, ceilingMs))
          }
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
      backdropTestID="btn-start-delay-close"
    >
      {/* Scrolls when large text makes the sheet taller than the screen
          allows, so Save stays reachable. */}
      <ScrollView
        style={{ maxHeight: height * SHEET_MAX_HEIGHT_RATIO }}
        contentContainerStyle={styles.body}
      >
        <View>
          <Typography
            variant="overline"
            color="textSecondary"
            accessibilityRole="header"
          >
            START DELAY
          </Typography>
          <Typography
            variant="body"
            color="textSecondary"
            accessibilityLabel={spokenStartDelayRange(draft)}
            testID="text-start-delay-summary"
          >
            {describeStartDelay(draft)}
          </Typography>
        </View>

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
            label="Save"
            onPress={() => onSave(draft)}
            testID="btn-start-delay-save"
          />
          <Button
            label="Cancel"
            variant="secondary"
            onPress={onClose}
            testID="btn-start-delay-cancel"
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};
