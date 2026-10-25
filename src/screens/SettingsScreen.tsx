import { useCallback, useRef, useState } from 'react';

import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';

import type { Theme } from '@/theme/theme';
import type {
  AppearancePreference,
  BeepVolume,
  DetectionSensitivity,
  LevelUnit,
} from '@/types/profile';
import { AppearanceSheet } from '@components/AppearanceSheet';
import { BEEP_VOLUME_COPY, BeepVolumeSheet } from '@components/BeepVolumeSheet';
import { Card } from '@components/Card';
import { ConfirmSheet } from '@components/ConfirmSheet';
import { LEVEL_UNIT_COPY, LevelUnitSheet } from '@components/LevelUnitSheet';
import { ListRow } from '@components/ListRow';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import {
  SENSITIVITY_COPY,
  SensitivitySheet,
} from '@components/SensitivitySheet';
import { StartDelaySheet } from '@components/StartDelaySheet';
import { Typography } from '@components/Typography';
import { useAppearance } from '@hooks/useAppearance';
import { useDetectionSensitivity } from '@hooks/useDetectionSensitivity';
import { useLevelUnit } from '@hooks/useLevelUnit';
import {
  useRunHistoryClear,
  type RunCountState,
} from '@hooks/useRunHistoryClear';
import { useThemedStyles } from '@hooks/useTheme';
import { useTimerSettings } from '@hooks/useTimerSettings';
import { StartSequenceService } from '@services/startSequence';
import { APP_VERSION } from '@utils/appInfo';
import { pluralize } from '@utils/format';
import {
  BEEP_VOLUME_GAIN,
  describeStartDelay,
  spokenStartDelayRange,
} from '@utils/startSettings';

/** What the Appearance row says for each stored preference. */
const APPEARANCE_SUMMARY: Record<AppearancePreference, string> = {
  system: 'Follows your device setting',
  light: 'Light',
  dark: 'Dark',
};

/** What the Level units row says for each unit. */
const LEVEL_UNIT_SUMMARY: Record<LevelUnit, string> = {
  level: 'Level, 0 to 100',
  dbfs: 'dBFS, the raw reading',
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sections: {
      gap: theme.spacing.lg,
    },
    preferenceError: {
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
    },
    // Lines up with the ListRow above it.
    privacyRow: {
      paddingVertical: theme.spacing.md - theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
    privacy: {
      gap: theme.spacing.xs,
    },
  });

const VOLUME_SAVE_ERROR = 'Could not save the beep volume. Try again.';
const TEST_BEEP_ERROR =
  'Could not play the beep. Check the phone is not muted.';

type SaveErrorProps = { message: string; testID: string };

/** The line under the Display card when a choice could not be saved. */
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

/**
 * Track a preference picker: whether its sheet is open and whether the
 * last choice failed to save. Choosing closes the sheet and saves; the
 * preference itself rolls back on a failure, so only the error is kept
 * here.
 */
const usePreferencePicker = <T,>(save: (value: T) => Promise<void>) => {
  const [open, setOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const choose = useCallback(
    (value: T) => {
      setOpen(false);
      setSaveFailed(false);
      save(value).catch(() => setSaveFailed(true));
    },
    [save],
  );

  return {
    open,
    saveFailed,
    choose,
    show: useCallback(() => setOpen(true), []),
    hide: useCallback(() => setOpen(false), []),
  };
};

/**
 * The Display section: Appearance and Level units. Each choice applies at
 * once; a save that fails puts the old value back and says so under the
 * card.
 */
const DisplaySettings = () => {
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
          subtitle={APPEARANCE_SUMMARY[preference]}
          onPress={appearancePicker.show}
          divided
          testID="row-appearance"
        />
        <ListRow
          title="Level units"
          subtitle={LEVEL_UNIT_SUMMARY[levelUnit]}
          accessibilityLabel={`Level units, ${LEVEL_UNIT_COPY[levelUnit].spoken}`}
          onPress={levelUnitPicker.show}
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

/** What the Sensitivity row says under its title. */
const SENSITIVITY_SUMMARY: Record<DetectionSensitivity, string> = {
  low: 'Low, fewer false shots',
  normal: 'Normal',
  high: 'High, fewer missed shots',
};

/**
 * The Detection section: Sensitivity. It sets how far below a calibrated
 * sample the threshold sits, and applies to every calibrated sound at once
 * without recalibrating.
 */
const DetectionSettings = () => {
  const { sensitivity, setSensitivity } = useDetectionSensitivity();
  const picker = usePreferencePicker(setSensitivity);

  return (
    <View>
      <SectionHeader title="Detection" />
      <Card flush>
        <ListRow
          title="Sensitivity"
          subtitle={SENSITIVITY_SUMMARY[sensitivity]}
          accessibilityLabel={`Sensitivity, ${SENSITIVITY_COPY[sensitivity].label}`}
          onPress={picker.show}
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

/** What the Clear run history row says under its title. */
const runCountSummary = (runCount: RunCountState): string => {
  switch (runCount.status) {
    case 'loading':
      return 'Counting saved runs…';
    case 'unknown':
      return 'Deletes every saved run. Drills are kept.';
    case 'ready':
      return runCount.runCount === 0
        ? 'No saved runs to delete'
        : `${pluralize(runCount.runCount, 'saved run')}. Drills are kept.`;
  }
};

/**
 * The Data section: Clear run history. Deletes every saved run after a
 * confirmation that names how many, and keeps drills and the profile.
 * The row is disabled while the runs are counted and when there are none;
 * if they cannot be counted, clearing is still offered.
 */
const DataSettings = () => {
  const { runCount, clearRuns } = useRunHistoryClear();
  const [confirming, setConfirming] = useState(false);
  // How many runs the sheet asks about, fixed when it opens so the title
  // does not change under the reader, or while the sheet slides away.
  const [askedCount, setAskedCount] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);
  // A second press of the confirm button lands before `clearing` has
  // rendered, so the guard is a ref.
  const clearingRef = useRef(false);

  const clearUnavailable =
    runCount.status === 'loading' ||
    (runCount.status === 'ready' && runCount.runCount === 0);
  const knownCount = runCount.status === 'ready' ? runCount.runCount : null;

  const requestClear = useCallback(() => {
    setClearFailed(false);
    setAskedCount(knownCount);
    setConfirming(true);
  }, [knownCount]);

  const cancelClear = useCallback(() => {
    if (clearingRef.current) {
      return;
    }
    setConfirming(false);
    setClearFailed(false);
  }, []);

  const confirmClear = async () => {
    if (clearingRef.current) {
      return;
    }
    clearingRef.current = true;
    setClearing(true);
    setClearFailed(false);

    // `clearRuns` settles a failure into `false`, so this never rejects.
    const cleared = await clearRuns();

    clearingRef.current = false;
    setClearing(false);
    if (!cleared) {
      // The sheet stays up with the reason; nothing is reported deleted.
      setClearFailed(true);
      return;
    }
    // The sheet, and the reader's focus with it, is gone: say what happened.
    AccessibilityInfo.announceForAccessibility(
      askedCount === null
        ? 'Deleted every saved run'
        : `Deleted ${pluralize(askedCount, 'run')}`,
    );
    setConfirming(false);
  };

  return (
    <View>
      <SectionHeader title="Data" />
      <Card flush>
        <ListRow
          title="Clear run history"
          subtitle={runCountSummary(runCount)}
          onPress={requestClear}
          disabled={clearUnavailable}
          destructive
          testID="row-clear-history"
        />
      </Card>
      <ConfirmSheet
        visible={confirming}
        title={
          askedCount === null
            ? 'Delete every saved run?'
            : `Delete ${pluralize(askedCount, 'run')}?`
        }
        message="Every saved run is removed from this phone. Your drills and profile are kept. This cannot be undone."
        confirmLabel="Delete runs"
        busyLabel="Deleting…"
        busy={clearing}
        error={
          clearFailed
            ? 'Could not delete your runs. They are still saved. Try again.'
            : undefined
        }
        onConfirm={confirmClear}
        onCancel={cancelClear}
        testID="sheet-clear-history"
      />
    </View>
  );
};

/** The About section: the app version and where the shooter's data lives. */
const AboutSettings = () => {
  const styles = useThemedStyles(createStyles);

  return (
    <View>
      <SectionHeader title="About" />
      <Card flush>
        <ListRow
          title="Version"
          value={APP_VERSION}
          accessibilityLabel={`Version ${APP_VERSION}`}
          divided
          testID="row-version"
        />
        <View style={styles.privacyRow}>
          <View style={styles.privacy} accessible testID="text-privacy">
            <Typography variant="bodyStrong">Your data</Typography>
            <Typography variant="caption" color="textSecondary">
              Everything is stored only on this phone. There is no account, and
              nothing is sent anywhere. Calibration resets when the app closes.
            </Typography>
          </View>
        </View>
      </Card>
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
const TimerSettings = () => {
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

  const volumeLabel = BEEP_VOLUME_COPY[beepVolume].label;
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
          subtitle={describeStartDelay(startDelay)}
          accessibilityLabel={`Start delay, ${spokenStartDelayRange(startDelay)}`}
          onPress={delayPicker.show}
          divided
          testID="row-start-delay"
        />
        <ListRow
          title="Beep volume"
          subtitle={volumeLabel}
          onPress={showVolume}
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
 * App preferences, pushed over the tabs from the Profile header. Grouped
 * into sections: Display, Timer, Detection, Data and About.
 */
export const SettingsScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation();

  return (
    <Screen
      title="Settings"
      onBack={navigation.goBack}
      scrollable
      testID="screen-settings"
    >
      <View style={styles.sections}>
        <DisplaySettings />
        <TimerSettings />
        <DetectionSettings />
        <DataSettings />
        <AboutSettings />
      </View>
    </Screen>
  );
};
