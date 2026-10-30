import { DBFS_MIN } from '../src/types/calibration';
import type {
  CalibrationSamples,
  CalibrationState,
  SoundCalibration,
} from '../src/types/calibration';
import {
  countCalibratedSounds,
  deriveCalibration,
  isAudibleSample,
  MIN_SAMPLE_DBFS,
  SENSITIVITY_MARGIN_DB,
  testOutcome,
  thresholdFromPeak,
} from '../src/utils/calibration';

const calibrated = (
  thresholdDbfs: number,
  lastTestDbfs: number | null,
): SoundCalibration => ({ status: 'calibrated', thresholdDbfs, lastTestDbfs });

describe('isAudibleSample', () => {
  it('accepts a sample whose peak is exactly at the quietest usable level', () => {
    expect(isAudibleSample(MIN_SAMPLE_DBFS)).toBe(true);
  });

  it('rejects a sample that never rose above the room', () => {
    expect(isAudibleSample(MIN_SAMPLE_DBFS - 0.1)).toBe(false);
    expect(isAudibleSample(DBFS_MIN)).toBe(false);
  });

  it('accepts a sample at full scale', () => {
    expect(isAudibleSample(0)).toBe(true);
  });
});

describe('thresholdFromPeak', () => {
  it.each([
    ['low', 3],
    ['normal', 6],
    ['high', 10],
  ] as const)('sets the %s threshold %p dB below the peak', (level, margin) => {
    expect(SENSITIVITY_MARGIN_DB[level]).toBe(margin);
    expect(thresholdFromPeak(-12, level)).toBe(-12 - margin);
    expect(thresholdFromPeak(0, level)).toBe(-margin);
  });

  it('gives normal sensitivity the threshold calibration has always set', () => {
    expect(thresholdFromPeak(-20, 'normal')).toBe(-26);
  });

  it.each(['low', 'normal', 'high'] as const)(
    'never goes below the bottom of the dBFS scale on %s',
    level => {
      expect(thresholdFromPeak(DBFS_MIN, level)).toBe(DBFS_MIN);
      expect(thresholdFromPeak(DBFS_MIN + 1, level)).toBe(DBFS_MIN);
    },
  );
});

describe('deriveCalibration', () => {
  const samples: CalibrationSamples = {
    shot: { peakDbfs: -10, lastTestDbfs: -14 },
    reload: { peakDbfs: null, lastTestDbfs: null },
    rack: { peakDbfs: -30, lastTestDbfs: null },
  };

  it('puts every calibrated sound its sensitivity margin below its peak', () => {
    const state = deriveCalibration(samples, 'high');

    expect(state.shot).toEqual({
      status: 'calibrated',
      thresholdDbfs: -20,
      lastTestDbfs: -14,
    });
    expect(state.rack.thresholdDbfs).toBe(-40);
  });

  it('moves every threshold when only the sensitivity changes', () => {
    const low = deriveCalibration(samples, 'low');
    const high = deriveCalibration(samples, 'high');

    expect(low.shot.thresholdDbfs).toBe(-13);
    expect(high.shot.thresholdDbfs).toBe(-20);
    expect(low.rack.thresholdDbfs).toBe(-33);
    expect(high.rack.thresholdDbfs).toBe(-40);
  });

  it('leaves a sound with no sample uncalibrated', () => {
    expect(deriveCalibration(samples, 'normal').reload).toEqual({
      status: 'uncalibrated',
      thresholdDbfs: null,
      lastTestDbfs: null,
    });
  });
});

describe('testOutcome', () => {
  it('has no outcome for a sound that is not calibrated', () => {
    expect(
      testOutcome({
        status: 'uncalibrated',
        thresholdDbfs: null,
        lastTestDbfs: null,
      }),
    ).toBeNull();
  });

  it('has no outcome until a calibrated sound is tested', () => {
    expect(testOutcome(calibrated(-30, null))).toBeNull();
  });

  it('passes a test that is louder than the threshold', () => {
    expect(testOutcome(calibrated(-30, -12))).toBe('passed');
  });

  it('passes a test that lands exactly on the threshold', () => {
    expect(testOutcome(calibrated(-30, -30))).toBe('passed');
  });

  it('fails a test that is quieter than the threshold', () => {
    expect(testOutcome(calibrated(-30, -30.1))).toBe('failed');
    expect(testOutcome(calibrated(-30, DBFS_MIN))).toBe('failed');
  });
});

describe('countCalibratedSounds', () => {
  const uncalibrated: SoundCalibration = {
    status: 'uncalibrated',
    thresholdDbfs: null,
    lastTestDbfs: null,
  };

  it('counts none before any sound is calibrated', () => {
    const state: CalibrationState = {
      shot: uncalibrated,
      reload: uncalibrated,
      rack: uncalibrated,
    };

    expect(countCalibratedSounds(state)).toBe(0);
  });

  it('counts only the sounds that have a threshold', () => {
    const state: CalibrationState = {
      shot: calibrated(-20, null),
      reload: uncalibrated,
      rack: calibrated(-25, -10),
    };

    expect(countCalibratedSounds(state)).toBe(2);
  });

  it('counts every sound once all are calibrated', () => {
    const state: CalibrationState = {
      shot: calibrated(-20, null),
      reload: calibrated(-30, null),
      rack: calibrated(-25, null),
    };

    expect(countCalibratedSounds(state)).toBe(3);
  });
});
