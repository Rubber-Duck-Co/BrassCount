import { createContext, useMemo, useReducer, type ReactNode } from 'react';

import type { CalibrationSound, CalibrationState } from '@/types/calibration';
import { usePreferences } from '@hooks/usePreferences';
import { deriveCalibration } from '@utils/calibration';

import {
  calibrationReducer,
  createInitialCalibrationState,
  normalizeDbfs,
} from './calibrationReducer';

export type CalibrationContextValue = {
  /** Every sound's threshold, at the detection sensitivity now chosen. */
  state: CalibrationState;
  /**
   * Calibrate a sound from the loudest level of a sample. Its threshold is
   * that level less the detection sensitivity's margin, and follows the
   * sensitivity if it changes. A level below the dBFS floor (silence
   * reads as `-Infinity`) is raised to the floor, so a reading off the
   * microphone stream is always safe to pass. Throws `CalibrationError`
   * only for `NaN` or a level above full scale.
   */
  setSample: (sound: CalibrationSound, peakDbfs: number) => void;
  /** Record the level measured by a test. Same level handling as `setSample`. */
  recordTestReading: (sound: CalibrationSound, dbfs: number) => void;
  resetSound: (sound: CalibrationSound) => void;
  resetAll: () => void;
};

export const CalibrationContext = createContext<CalibrationContextValue | null>(
  null,
);

type CalibrationProviderProps = {
  children: ReactNode;
};

/**
 * Holds calibration for the lifetime of the app process. Nothing here is
 * written to storage: thresholds depend on the room and the gear on hand,
 * so they are meant to be lost when the app is closed. Only the sensitivity
 * that turns a sample's peak into a threshold is a stored preference. Must
 * be mounted under `PreferencesProvider`.
 *
 * Only settled values belong here. The live microphone level changes many
 * times a second and would re-render every consumer — keep it in local
 * state next to the meter that draws it.
 */
export const CalibrationProvider = ({ children }: CalibrationProviderProps) => {
  const [samples, dispatch] = useReducer(
    calibrationReducer,
    undefined,
    createInitialCalibrationState,
  );
  const { sensitivity } = usePreferences().preferences;
  const state = useMemo(
    () => deriveCalibration(samples, sensitivity),
    [samples, sensitivity],
  );

  const actions = useMemo(
    () => ({
      setSample: (sound: CalibrationSound, peakDbfs: number): void =>
        dispatch({
          type: 'setSample',
          sound,
          peakDbfs: normalizeDbfs(peakDbfs),
        }),
      recordTestReading: (sound: CalibrationSound, dbfs: number): void =>
        dispatch({
          type: 'recordTestReading',
          sound,
          dbfs: normalizeDbfs(dbfs),
        }),
      resetSound: (sound: CalibrationSound): void =>
        dispatch({ type: 'resetSound', sound }),
      resetAll: (): void => dispatch({ type: 'resetAll' }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, ...actions }), [state, actions]);

  return (
    <CalibrationContext.Provider value={value}>
      {children}
    </CalibrationContext.Provider>
  );
};
