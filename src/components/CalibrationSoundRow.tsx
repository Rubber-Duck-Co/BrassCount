import { memo, type ComponentProps } from 'react';

import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import type { CalibrationSound, SoundCalibration } from '@/types/calibration';
import type { LevelUnit } from '@/types/profile';
import type {
  CalibrationCaptureMode,
  CalibrationCaptureNoticeKind,
} from '@hooks/useCalibrationCapture';
import { useLevelUnit } from '@hooks/useLevelUnit';
import { useTheme, useThemedStyles } from '@hooks/useTheme';
import { testOutcome } from '@utils/calibration';
import { formatLevel, spokenLevel } from '@utils/format';

import { Button } from './Button';
import { CalibrationMeter } from './CalibrationMeter';
import { Card } from './Card';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Typography } from './Typography';

/**
 * Narrowest a piece of a row may get before it wraps, in dp at the default
 * font size. Each is multiplied by the system font scale, so at large text
 * the status chip drops under the name and the paired readouts and buttons
 * stack, instead of squeezing their text into a sliver.
 */
const HEADER_TEXT_MIN_WIDTH = 72;
const HALF_ROW_MIN_WIDTH = 112;

/** One sound the audio detector needs a threshold for. */
export type CalibrationSoundType = {
  key: CalibrationSound;
  badge: string;
  label: string;
  description: string;
  /** What the shooter is asked to do while the microphone listens. */
  prompt: string;
};

/**
 * The sounds, in the order the screen lists them. Calibration is scoped to
 * the current shooting session — each sound is dialled in against the
 * ambient noise and gear on hand (see `useCalibration`). The single-letter
 * badge tells reload (R) from rack (K).
 */
export const CALIBRATION_SOUND_TYPES: readonly CalibrationSoundType[] = [
  {
    key: 'shot',
    badge: 'S',
    label: 'Shot',
    description: 'A single round downrange',
    prompt: 'Fire one shot',
  },
  {
    key: 'reload',
    badge: 'R',
    label: 'Reload',
    description: 'Magazine change',
    prompt: 'Change the magazine',
  },
  {
    key: 'rack',
    badge: 'K',
    label: 'Rack',
    description: 'Cycle the slide',
    prompt: 'Rack the slide',
  },
];

/** Why a capture fell short, as the row says it. */
const noticeMessages: Record<CalibrationCaptureNoticeKind, string> = {
  'no-sound': 'No sound heard. Try again, closer to the microphone.',
  'permission-denied': 'Microphone access is needed to listen for this sound.',
  'permission-blocked':
    'Microphone access is turned off. Allow it in Settings, then try again.',
  interrupted: 'Listening stopped because the app was left. Try again.',
  failed: 'The microphone could not be used. Try again.',
};

/** Why the Test button is disabled, for a screen reader; undefined when it is not. */
const testDisabledReason = (
  locked: boolean,
  recalibrating: boolean,
  status: SoundCalibration['status'],
): string | undefined => {
  if (status === 'uncalibrated') {
    return 'Recalibrate this sound first';
  }
  if (locked) {
    return 'Another sound is being measured';
  }
  return recalibrating ? 'Recalibrating this sound' : undefined;
};

/** One sound's calibration as a screen reader should say it. */
const spokenSummary = (
  label: string,
  calibration: Readonly<SoundCalibration>,
  listening: boolean,
  unit: LevelUnit,
): string => {
  // A test only ever belongs to a threshold, so there is none to report.
  if (calibration.status === 'uncalibrated') {
    return `${label}, ${listening ? 'listening' : 'not calibrated'}, threshold not set`;
  }
  const outcome = testOutcome(calibration);
  const lastTest =
    outcome === null
      ? 'not tested yet'
      : `last test ${spokenLevel(calibration.lastTestDbfs, unit)}, test ${outcome}`;
  return `${label}, ${listening ? 'listening' : 'calibrated'}, threshold ${spokenLevel(calibration.thresholdDbfs, unit)}, ${lastTest}`;
};

type StatusChip = Pick<ComponentProps<typeof Chip>, 'label' | 'tone'>;

/**
 * The row's status chip. A capture in progress comes first, filled in
 * Signal; after that a test result says more than "Calibrated", which it
 * implies. Signal outlines what still needs the shooter: a sound not yet
 * calibrated, or one whose test fell short. Ink fills what is done.
 */
const statusChip = (
  calibration: Readonly<SoundCalibration>,
  listening: boolean,
): StatusChip => {
  if (listening) {
    return { label: 'Listening', tone: 'signal' };
  }
  if (calibration.status === 'uncalibrated') {
    return { label: 'Not calibrated', tone: 'primary' };
  }
  switch (testOutcome(calibration)) {
    case 'passed':
      return { label: 'Test passed', tone: 'inverse' };
    case 'failed':
      return { label: 'Test failed', tone: 'primary' };
    case null:
      return { label: 'Calibrated', tone: 'inverse' };
  }
};

type Feedback = {
  message: string;
  /** How a screen reader should say it, when the message holds a level. */
  spoken?: string;
  /** Why the microphone stopped: drawn with the warning mark. */
  failure: boolean;
};

/**
 * The line under the readouts: what to do while listening, why the last
 * capture fell short, or how the last test went. `null` when there is
 * nothing to say.
 */
const feedbackFor = (
  type: CalibrationSoundType,
  calibration: Readonly<SoundCalibration>,
  listening: boolean,
  noticeKind: CalibrationCaptureNoticeKind | null,
  unit: LevelUnit,
): Feedback | null => {
  if (listening) {
    return { message: `Listening. ${type.prompt} now.`, failure: false };
  }
  if (noticeKind !== null) {
    return { message: noticeMessages[noticeKind], failure: true };
  }
  if (calibration.status === 'uncalibrated') {
    return null;
  }
  switch (testOutcome(calibration)) {
    case 'passed':
      return {
        message: 'Test passed. The sound reached the threshold.',
        failure: false,
      };
    case 'failed':
      return {
        message: 'Test failed. The sound was quieter than the threshold.',
        failure: false,
      };
    case null:
      // Without this a recalibration that worked would end in silence for
      // a screen reader: the chip that turns to "Calibrated" is not live.
      return {
        message: `Threshold set to ${formatLevel(calibration.thresholdDbfs, unit)}. Run a test to check it.`,
        spoken: `Threshold set to ${spokenLevel(calibration.thresholdDbfs, unit)}. Run a test to check it.`,
        failure: false,
      };
  }
};

const openAppSettings = (): void => {
  // Nothing more to offer if the settings screen will not open: the
  // failure line above the button already says where the permission lives.
  Linking.openSettings().catch(() => {});
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.inset },
    summary: { gap: theme.spacing.inset },
    header: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: theme.spacing.inset,
      rowGap: theme.spacing.sm,
    },
    // Minimums, so a large system font grows the box around its letter.
    badge: {
      minWidth: theme.sizes.soundBadge,
      minHeight: theme.sizes.soundBadge,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
    },
    headerText: { flex: 1, gap: theme.spacing.xxs },
    readoutRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    readout: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: theme.spacing.sm,
    },
    // Capitals come from the style, so the label is read as a word.
    readoutLabel: { textTransform: 'uppercase' },
    failureLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    // Drops the mark onto the first line of text.
    failureMark: { marginTop: theme.spacing.xxs },
    feedbackText: { flexShrink: 1 },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.inset,
    },
    actionButton: { flex: 1 },
  });

type ReadoutProps = {
  label: string;
  value: string;
  /** Width below which the readout wraps onto its own line. */
  minWidth: number;
  valueTestID: string;
};

const Readout = ({ label, value, minWidth, valueTestID }: ReadoutProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.readout, { minWidth }]}>
      <Typography
        variant="sectionLabel"
        color="textSecondary"
        style={styles.readoutLabel}
      >
        {label}
      </Typography>
      <Typography variant="splitFigure" testID={valueTestID}>
        {value}
      </Typography>
    </View>
  );
};

type FeedbackLineProps = {
  feedback: Feedback;
  sound: CalibrationSound;
};

/** The line under the readouts; a failure leads with the Signal warning mark. */
const FeedbackLine = ({ feedback, sound }: FeedbackLineProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();

  return (
    <View style={styles.failureLine}>
      {feedback.failure ? (
        <View style={styles.failureMark} testID={`mark-failure-${sound}`}>
          <Icon name="warning" size={sizes.iconMd} color="warning" />
        </View>
      ) : null}
      <Typography
        variant="rowLabel"
        // Always set: Android keeps the previous label when this goes
        // back to undefined, and would read it over the new text.
        accessibilityLabel={feedback.spoken ?? feedback.message}
        style={styles.feedbackText}
        testID={`text-feedback-${sound}`}
      >
        {feedback.message}
      </Typography>
    </View>
  );
};

type CalibrationSoundRowProps = {
  type: CalibrationSoundType;
  calibration: Readonly<SoundCalibration>;
  /** The capture running for this sound, if one is. */
  activeMode: CalibrationCaptureMode | null;
  /** The level that capture is hearing, for the meter; `null` otherwise. */
  liveLevelDbfs: number | null;
  /** Another sound holds the microphone, so this row cannot start. */
  locked: boolean;
  /** Why this sound's last capture fell short, if it did. */
  noticeKind: CalibrationCaptureNoticeKind | null;
  onRecalibrate: (sound: CalibrationSound) => void;
  onTest: (sound: CalibrationSound) => void;
  onCancel: () => void;
};

/**
 * One sound on the Calibration screen, in a ruled box: its letter, name and
 * status chip, the level meter, the threshold and last test readouts, the
 * line that says what is happening, and Recalibrate and Test.
 *
 * The meter's bar is the level being heard while the sound is listened
 * for, and its last test otherwise; the Signal tick is its threshold.
 *
 * Memoised, so the rows not being listened for skip the screen's redraws
 * while a live level comes in: the store keeps their sounds' objects
 * identical, the capture callbacks keep their identity, and they get a
 * `null` live level. The listening row redraws with each level.
 */
export const CalibrationSoundRow = memo((props: CalibrationSoundRowProps) => {
  const {
    type,
    calibration,
    activeMode,
    liveLevelDbfs,
    locked,
    noticeKind,
    onRecalibrate,
    onTest,
    onCancel,
  } = props;
  const styles = useThemedStyles(createStyles);
  const { levelUnit } = useLevelUnit();
  const { fontScale } = useWindowDimensions();

  const { thresholdDbfs, status, lastTestDbfs } = calibration;
  const sound = type.label.toLowerCase();
  const halfRowMinWidth = HALF_ROW_MIN_WIDTH * fontScale;

  const listening = activeMode !== null;
  const recalibrating = activeMode === 'recalibrate';
  const testing = activeMode === 'test';
  const testDisabledHint = testDisabledReason(locked, recalibrating, status);
  const chip = statusChip(calibration, listening);
  const feedback = feedbackFor(
    type,
    calibration,
    listening,
    noticeKind,
    levelUnit,
  );

  return (
    <Card style={styles.card} testID={`card-calibration-${type.key}`}>
      {/*
       * One screen-reader stop for the whole readout, in place of the
       * badge letter, the dashes and the bar being announced piecemeal.
       */}
      <View
        accessible
        accessibilityLabel={spokenSummary(
          type.label,
          calibration,
          listening,
          levelUnit,
        )}
        style={styles.summary}
        testID={`summary-calibration-${type.key}`}
      >
        <View style={styles.header}>
          <View style={styles.badge}>
            <Typography variant="stencilSmall">{type.badge}</Typography>
          </View>

          <View
            style={[
              styles.headerText,
              { minWidth: HEADER_TEXT_MIN_WIDTH * fontScale },
            ]}
          >
            <Typography variant="bodyStrong" numberOfLines={1}>
              {type.label}
            </Typography>
            <Typography variant="label" color="textSecondary">
              {type.description}
            </Typography>
          </View>

          <Chip
            label={chip.label}
            tone={chip.tone}
            testID={`chip-calibration-${type.key}`}
          />
        </View>

        <CalibrationMeter
          levelDbfs={listening ? liveLevelDbfs : lastTestDbfs}
          thresholdDbfs={thresholdDbfs}
          testID={`meter-calibration-${type.key}`}
        />

        <View style={styles.readoutRow}>
          <Readout
            label="Threshold"
            value={formatLevel(thresholdDbfs, levelUnit)}
            minWidth={halfRowMinWidth}
            valueTestID={`text-threshold-${type.key}`}
          />
          <Readout
            label="Last test"
            value={formatLevel(lastTestDbfs, levelUnit)}
            minWidth={halfRowMinWidth}
            valueTestID={`text-last-test-${type.key}`}
          />
        </View>
      </View>

      {/*
       * Always mounted, so a screen reader is told when the line inside
       * appears or changes rather than only when the region itself does.
       */}
      <View
        accessibilityLiveRegion="polite"
        testID={`feedback-calibration-${type.key}`}
      >
        {feedback === null ? null : (
          <FeedbackLine feedback={feedback} sound={type.key} />
        )}
      </View>

      {noticeKind === 'permission-blocked' && !listening ? (
        <Button
          label="Open settings"
          variant="secondary"
          onPress={openAppSettings}
          testID={`btn-open-settings-${type.key}`}
        />
      ) : null}

      <View style={styles.actionRow}>
        <View style={[styles.actionButton, { minWidth: halfRowMinWidth }]}>
          <Button
            label={recalibrating ? 'Cancel' : 'Recalibrate'}
            accessibilityLabel={
              recalibrating
                ? `Cancel recalibrating ${sound}`
                : `Recalibrate ${sound}`
            }
            variant="secondary"
            disabled={locked || testing}
            onPress={recalibrating ? onCancel : () => onRecalibrate(type.key)}
            testID={`btn-recalibrate-${type.key}`}
          />
        </View>
        <View style={[styles.actionButton, { minWidth: halfRowMinWidth }]}>
          <Button
            label={testing ? 'Cancel' : 'Test'}
            accessibilityLabel={
              testing ? `Cancel testing ${sound}` : `Test ${sound}`
            }
            variant="secondary"
            // A test measures a sound against its threshold, so there is
            // nothing to run one against until the sound is calibrated.
            disabled={testDisabledHint !== undefined}
            accessibilityHint={testDisabledHint}
            onPress={testing ? onCancel : () => onTest(type.key)}
            testID={`btn-test-${type.key}`}
          />
        </View>
      </View>
    </Card>
  );
});
