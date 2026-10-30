import { useCallback, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { CALIBRATION_SOUNDS } from '@/types/calibration';
import type { AppearancePreference, BeepVolume } from '@/types/profile';
import { useAppearance } from '@hooks/useAppearance';
import { useCalibration } from '@hooks/useCalibration';
import { useDetectionSensitivity } from '@hooks/useDetectionSensitivity';
import { useLevelUnit } from '@hooks/useLevelUnit';
import { usePreferencePicker } from '@hooks/usePreferencePicker';
import { useThemedStyles } from '@hooks/useTheme';
import { useTimerSettings } from '@hooks/useTimerSettings';
import { StartSequenceService } from '@services/startSequence';
import { countCalibratedSounds } from '@utils/calibration';
import {
  BEEP_VOLUME_GAIN,
  describeStartDelay,
  spokenStartDelayRange,
} from '@utils/startSettings';

import { AppearanceSheet } from './AppearanceSheet';
import { BEEP_VOLUME_COPY, BeepVolumeSheet } from './BeepVolumeSheet';
import { Card } from './Card';
import { LEVEL_UNIT_COPY, LevelUnitSheet } from './LevelUnitSheet';
import { ListRow } from './ListRow';
import { SectionHeader } from './SectionHeader';
import { SENSITIVITY_COPY, SensitivitySheet } from './SensitivitySheet';
import { StartDelaySheet } from './StartDelaySheet';
import { Typography } from './Typography';

/** What the Appearance row shows for each stored preference. */
const APPEARANCE_VALUE: Record<AppearancePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

/** The Appearance row as a screen reader says it. */
const APPEARANCE_SPOKEN: Record<AppearancePreference, string> = {
  system: 'follows your device setting',
  light: 'Light',
  dark: 'Dark',
};

const VOLUME_SAVE_ERROR = 'Could not save the beep volume. Try again.';
const TEST_BEEP_ERROR =
  'Could not play the beep. Check the phone is not muted.';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    preferenceError: {
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
    },
  });

type SaveErrorProps = { message: string; testID: string };

/** The line under a section's box when a choice could not be saved. */
const SaveError = ({ message, testID }: SaveErrorProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <Typography
      variant="caption"
      color="danger"
      accessibilityLiveRegion="polite"
      style={styles.preferenceError}
      testID={testID}
    >
      {message}
    </Typography>
  );
};

type MicrophoneSettingsProps = {
  /** Open the Calibration screen. */
  onOpenCalibration: () => void;
};

/**
 * The Microphone section: Calibration and Sensitivity, both for this
 * session's sounds. Calibration says how many sounds have a threshold, in
 * Signal until every one does. Sensitivity sets how far below a calibrated
 * sample the threshold sits, and applies to every sound at once without
 * recalibrating.
 */
export const MicrophoneSettings = ({
  onOpenCalibration,
}: MicrophoneSettingsProps) => {
  const { state } = useCalibration();
  const { sensitivity, setSensitivity } = useDetectionSensitivity();
  const picker = usePreferencePicker(setSensitivity);

  const total = CALIBRATION_SOUNDS.length;
  const calibrated = countCalibratedSounds(state);
  const progress = `${calibrated} of ${total} sounds`;
  const sensitivityLabel = SENSITIVITY_COPY[sensitivity].label;

  return (
    <View>
      <SectionHeader title="Microphone · this session" />
      <Card flush>
        <ListRow
          title="Calibration"
          value={progress}
          valueColor={calibrated < total ? 'warning' : 'textSecondary'}
          accessibilityLabel={`Calibration, ${progress} calibrated`}
          onPress={onOpenCalibration}
          chevron
          divided
          testID="row-calibration"
        />
        <ListRow
          title="Sensitivity"
          value={sensitivityLabel}
          accessibilityLabel={`Sensitivity, ${sensitivityLabel}`}
          onPress={picker.show}
          chevron
          testID="row-sensitivity"
        />
      </Card>
      {picker.saveFailed ? (
        <SaveError
          message="Could not save the sensitivity. Try again."
          testID="text-sensitivity-error"
        />
      ) : null}
      <SensitivitySheet
        visible={picker.open}
        selected={sensitivity}
        onSelect={picker.choose}
        onClose={picker.hide}
      />
    </View>
  );
};

/**
 * Play the start beep at `volume`, as a run would. Resolves to whether it
 * played; a failure is settled here, never thrown.
 */
const playTestBeep = (volume: BeepVolume): Promise<boolean> =>
  StartSequenceService.testBeep({
    ...StartSequenceService.beep,
    volume: BEEP_VOLUME_GAIN[volume],
  }).then(
    () => true,
    () => false,
  );

/**
 * The Timer section: the range the random start delay comes from, and the
 * beep volume. Both are used from the next run. The delay is edited in a
 * sheet and kept on Save; a volume applies as soon as it is chosen, with
 * the sheet left open so each one can be tried with Test beep.
 */
export const TimerSettings = () => {
  const { startDelay, beepVolume, setStartDelay, setBeepVolume } =
    useTimerSettings();
  const delayPicker = usePreferencePicker(setStartDelay);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumeSaveFailed, setVolumeSaveFailed] = useState(false);
  const [testBeepFailed, setTestBeepFailed] = useState(false);
  // Bumped by every choice, test beep, opening and closing of the volume
  // sheet, so the outcome of one that has been overtaken (a slow beep
  // that fails after another volume was chosen, or after the sheet
  // closed) is never shown against the newer state.
  const volumeActionRef = useRef(0);

  /** Start a volume action; the result says whether it is still current. */
  const beginVolumeAction = useCallback((): (() => boolean) => {
    const id = ++volumeActionRef.current;
    setVolumeSaveFailed(false);
    setTestBeepFailed(false);
    return () => volumeActionRef.current === id;
  }, []);

  const chooseVolume = useCallback(
    (volume: BeepVolume) => {
      const isCurrent = beginVolumeAction();
      setBeepVolume(volume).catch(() => {
        if (isCurrent()) {
          setVolumeSaveFailed(true);
        }
      });
    },
    [beginVolumeAction, setBeepVolume],
  );

  const testBeep = useCallback(() => {
    const isCurrent = beginVolumeAction();
    // `playTestBeep` settles a failure into `false`, so this never rejects.
    playTestBeep(beepVolume)
      .then(played => {
        if (isCurrent()) {
          setTestBeepFailed(!played);
        }
      })
      .catch(() => {});
  }, [beepVolume, beginVolumeAction]);

  const showVolume = useCallback(() => {
    beginVolumeAction();
    setVolumeOpen(true);
  }, [beginVolumeAction]);
  const hideVolume = useCallback(() => {
    // The sheet showed any error; the row already shows the volume kept.
    beginVolumeAction();
    setVolumeOpen(false);
  }, [beginVolumeAction]);

  let volumeSheetError: string | undefined;
  if (volumeSaveFailed) {
    volumeSheetError = VOLUME_SAVE_ERROR;
  } else if (testBeepFailed) {
    volumeSheetError = TEST_BEEP_ERROR;
  }

  return (
    <View>
      <SectionHeader title="Timer" />
      <Card flush>
        <ListRow
          title="Start delay"
          value={describeStartDelay(startDelay)}
          accessibilityLabel={`Start delay, ${spokenStartDelayRange(startDelay)}`}
          onPress={delayPicker.show}
          chevron
          divided
          testID="row-start-delay"
        />
        <ListRow
          title="Beep volume"
          value={BEEP_VOLUME_COPY[beepVolume].label}
          onPress={showVolume}
          chevron
          testID="row-beep-volume"
        />
      </Card>
      {delayPicker.saveFailed ? (
        <SaveError
          message="Could not save the start delay. Try again."
          testID="text-start-delay-error"
        />
      ) : null}
      <StartDelaySheet
        visible={delayPicker.open}
        value={startDelay}
        onSave={delayPicker.choose}
        onClose={delayPicker.hide}
      />
      <BeepVolumeSheet
        visible={volumeOpen}
        selected={beepVolume}
        onSelect={chooseVolume}
        onTestBeep={testBeep}
        error={volumeSheetError}
        onClose={hideVolume}
      />
    </View>
  );
};

/**
 * The Display section: Appearance and Level units. Each choice applies at
 * once; a save that fails puts the old value back and says so under the
 * box.
 */
export const DisplaySettings = () => {
  const { preference, setPreference } = useAppearance();
  const { levelUnit, setLevelUnit } = useLevelUnit();
  const appearancePicker = usePreferencePicker(setPreference);
  const levelUnitPicker = usePreferencePicker(setLevelUnit);

  return (
    <View>
      <SectionHeader title="Display" />
      <Card flush>
        <ListRow
          title="Appearance"
          value={APPEARANCE_VALUE[preference]}
          accessibilityLabel={`Appearance, ${APPEARANCE_SPOKEN[preference]}`}
          onPress={appearancePicker.show}
          chevron
          divided
          testID="row-appearance"
        />
        <ListRow
          title="Level units"
          value={LEVEL_UNIT_COPY[levelUnit].label}
          accessibilityLabel={`Level units, ${LEVEL_UNIT_COPY[levelUnit].spoken}`}
          onPress={levelUnitPicker.show}
          chevron
          testID="row-level-unit"
        />
      </Card>
      {appearancePicker.saveFailed ? (
        <SaveError
          message="Could not save your theme. Try again."
          testID="text-appearance-error"
        />
      ) : null}
      {levelUnitPicker.saveFailed ? (
        <SaveError
          message="Could not save your level units. Try again."
          testID="text-level-unit-error"
        />
      ) : null}
      <AppearanceSheet
        visible={appearancePicker.open}
        selected={preference}
        onSelect={appearancePicker.choose}
        onClose={appearancePicker.hide}
      />
      <LevelUnitSheet
        visible={levelUnitPicker.open}
        selected={levelUnit}
        onSelect={levelUnitPicker.choose}
        onClose={levelUnitPicker.hide}
      />
    </View>
  );
};
