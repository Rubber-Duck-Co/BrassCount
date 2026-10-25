import { useCallback, useMemo } from 'react';

import type { DetectionSensitivity } from '@/types/profile';
import { usePreferences } from '@hooks/usePreferences';

export type DetectionSensitivityValue = {
  /** How far below a calibrated sample the detection threshold sits. */
  sensitivity: DetectionSensitivity;
  /**
   * Apply `sensitivity` straight away and store it. Rejects, with the last
   * saved choice back in place, when the save fails (see
   * `PreferencesContextValue.setPreference`).
   */
  setSensitivity: (sensitivity: DetectionSensitivity) => Promise<void>;
};

/**
 * Read and change the detection sensitivity. Every calibrated threshold
 * follows it at once (`CalibrationProvider`), with no new sample. Must be
 * called under `PreferencesProvider`, which `App` mounts above the
 * navigators.
 */
export const useDetectionSensitivity = (): DetectionSensitivityValue => {
  const { preferences, setPreference } = usePreferences();
  const { sensitivity } = preferences;

  const setSensitivity = useCallback(
    (value: DetectionSensitivity) => setPreference('sensitivity', value),
    [setPreference],
  );

  return useMemo(
    () => ({ sensitivity, setSensitivity }),
    [sensitivity, setSensitivity],
  );
};
