import { CALIBRATION_SOUNDS, DBFS_MIN } from '@/types/calibration';
import type {
  CalibrationSamples,
  CalibrationSound,
  CalibrationState,
  SoundCalibration,
} from '@/types/calibration';
import type { DetectionSensitivity } from '@/types/profile';

/** How long a calibration sample or a test listens for the sound. */
export const CALIBRATION_LISTEN_MS = 3000;

/**
 * How far below the loudest level of a sample its threshold is set, for
 * each detection sensitivity. The same sound is never exactly as loud
 * twice, so a threshold at the peak itself would be missed by about every
 * other repeat. `normal` is the margin calibration has always used.
 */
export const SENSITIVITY_MARGIN_DB: Readonly<
  Record<DetectionSensitivity, number>
> = {
  low: 3,
  normal: 6,
  high: 10,
};

/**
 * Quietest peak a sample may have and still count as the sound having been
 * made. Below this the microphone heard only the room.
 */
export const MIN_SAMPLE_DBFS = -60;

/** Whether a sample's loudest level is loud enough to calibrate from. */
export const isAudibleSample = (peakDbfs: number): boolean =>
  peakDbfs >= MIN_SAMPLE_DBFS;

/**
 * The threshold a sample with this loudest level calibrates its sound to
 * at `sensitivity`.
 */
export const thresholdFromPeak = (
  peakDbfs: number,
  sensitivity: DetectionSensitivity,
): number => Math.max(peakDbfs - SENSITIVITY_MARGIN_DB[sensitivity], DBFS_MIN);

const deriveSound = (
  { peakDbfs, lastTestDbfs }: CalibrationSamples[CalibrationSound],
  sensitivity: DetectionSensitivity,
): SoundCalibration =>
  peakDbfs === null
    ? { status: 'uncalibrated', thresholdDbfs: null, lastTestDbfs }
    : {
        status: 'calibrated',
        thresholdDbfs: thresholdFromPeak(peakDbfs, sensitivity),
        lastTestDbfs,
      };

/**
 * The calibration the detector and the Calibration screen use: every
 * sample's threshold at `sensitivity`. Derived rather than stored, so a
 * change of sensitivity moves every threshold at once.
 */
export const deriveCalibration = (
  samples: CalibrationSamples,
  sensitivity: DetectionSensitivity,
): CalibrationState => ({
  shot: deriveSound(samples.shot, sensitivity),
  reload: deriveSound(samples.reload, sensitivity),
  rack: deriveSound(samples.rack, sensitivity),
});

export type CalibrationTestOutcome = 'passed' | 'failed';

/**
 * How the last test of a sound went: it passes when the level it measured
 * reached the threshold. `null` while there is no test to judge — the sound
 * is uncalibrated, or has not been tested since its threshold was set.
 */
export const testOutcome = (
  calibration: Readonly<SoundCalibration>,
): CalibrationTestOutcome | null => {
  if (
    calibration.status === 'uncalibrated' ||
    calibration.lastTestDbfs === null
  ) {
    return null;
  }
  return calibration.lastTestDbfs >= calibration.thresholdDbfs
    ? 'passed'
    : 'failed';
};

/**
 * How many sounds have a threshold this session, of the
 * `CALIBRATION_SOUNDS.length` there are. Setup flags the Calibration row
 * while it is short of all of them.
 */
export const countCalibratedSounds = (state: CalibrationState): number =>
  CALIBRATION_SOUNDS.filter(sound => state[sound].status === 'calibrated')
    .length;
