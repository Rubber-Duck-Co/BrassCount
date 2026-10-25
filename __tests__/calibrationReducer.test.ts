import {
  CalibrationError,
  calibrationReducer,
  createInitialCalibrationState,
  normalizeDbfs,
} from '../src/store/calibrationReducer';
import { CALIBRATION_SOUNDS, DBFS_MIN } from '../src/types/calibration';
import type { CalibrationSamples } from '../src/types/calibration';

const UNCALIBRATED = { peakDbfs: null, lastTestDbfs: null };

const calibratedShot = (): CalibrationSamples =>
  calibrationReducer(createInitialCalibrationState(), {
    type: 'setSample',
    sound: 'shot',
    peakDbfs: -12,
  });

describe('calibrationReducer', () => {
  it('starts with every sound uncalibrated', () => {
    const state = createInitialCalibrationState();

    expect(Object.keys(state).sort()).toEqual([...CALIBRATION_SOUNDS].sort());
    CALIBRATION_SOUNDS.forEach(sound => {
      expect(state[sound]).toEqual(UNCALIBRATED);
    });
  });

  it("keeps a sample's peak as the sound's calibration", () => {
    expect(calibratedShot().shot).toEqual({
      peakDbfs: -12,
      lastTestDbfs: null,
    });
  });

  it('leaves the other sounds alone when one sample is set', () => {
    const state = calibratedShot();

    expect(state.reload).toEqual(UNCALIBRATED);
    expect(state.rack).toEqual(UNCALIBRATED);
  });

  it('records a test reading without changing the peak', () => {
    const state = calibrationReducer(calibratedShot(), {
      type: 'recordTestReading',
      sound: 'shot',
      dbfs: -9.5,
    });

    expect(state.shot).toEqual({ peakDbfs: -12, lastTestDbfs: -9.5 });
  });

  it('ignores a test reading for a sound with no sample', () => {
    const before = createInitialCalibrationState();

    const state = calibrationReducer(before, {
      type: 'recordTestReading',
      sound: 'rack',
      dbfs: -30,
    });

    expect(state).toBe(before);
  });

  it('clears the last test reading when a sound is reset', () => {
    const tested = calibrationReducer(calibratedShot(), {
      type: 'recordTestReading',
      sound: 'shot',
      dbfs: -9.5,
    });

    const state = calibrationReducer(tested, {
      type: 'resetSound',
      sound: 'shot',
    });

    expect(state.shot).toEqual(UNCALIBRATED);
  });

  it('discards the last test reading when the sample changes', () => {
    const tested = calibrationReducer(calibratedShot(), {
      type: 'recordTestReading',
      sound: 'shot',
      dbfs: -9.5,
    });

    const state = calibrationReducer(tested, {
      type: 'setSample',
      sound: 'shot',
      peakDbfs: -20,
    });

    expect(state.shot).toEqual({ peakDbfs: -20, lastTestDbfs: null });
  });

  it('resets only the requested sound', () => {
    const both = calibrationReducer(calibratedShot(), {
      type: 'setSample',
      sound: 'reload',
      peakDbfs: -25,
    });

    const state = calibrationReducer(both, {
      type: 'resetSound',
      sound: 'shot',
    });

    expect(state.shot).toEqual(UNCALIBRATED);
    expect(state.reload.peakDbfs).toBe(-25);
  });

  it('returns every sound to uncalibrated on resetAll', () => {
    const state = calibrationReducer(calibratedShot(), { type: 'resetAll' });

    expect(state).toEqual(createInitialCalibrationState());
  });

  it('does not mutate the state it is given', () => {
    const before = createInitialCalibrationState();
    const snapshot = JSON.parse(JSON.stringify(before));

    const after = calibrationReducer(before, {
      type: 'setSample',
      sound: 'shot',
      peakDbfs: -12,
    });

    expect(after).not.toBe(before);
    expect(before).toEqual(snapshot);
  });
});

describe('normalizeDbfs', () => {
  it.each([-160, -42.5, 0])('returns %p dBFS unchanged', value => {
    expect(normalizeDbfs(value)).toBe(value);
  });

  it.each([-160.1, -1000, -Infinity])(
    'raises %p to the dBFS floor instead of throwing',
    value => {
      expect(normalizeDbfs(value)).toBe(DBFS_MIN);
    },
  );

  it.each([NaN, Infinity, 0.1, 96])(
    'rejects %p with CalibrationError',
    value => {
      expect(() => normalizeDbfs(value)).toThrow(CalibrationError);
    },
  );
});
