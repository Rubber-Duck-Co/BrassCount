import { useCallback, useMemo } from 'react';

import type { BeepVolume, StartDelayRange } from '@/types/profile';
import { usePreferences } from '@hooks/usePreferences';

export type TimerSettingsValue = {
  /** The range the random delay before the start beep is drawn from. */
  startDelay: StartDelayRange;
  /** How loud the start beep is. */
  beepVolume: BeepVolume;
  /**
   * Use `range` from the next run and store it. Rejects, with the last
   * saved range back in place, when the save fails or the range is not
   * one that can be stored (see `PreferencesContextValue.setPreference`).
   */
  setStartDelay: (range: StartDelayRange) => Promise<void>;
  /** As `setStartDelay`, for the beep volume. */
  setBeepVolume: (volume: BeepVolume) => Promise<void>;
};

/**
 * Read and change the timer settings: the start delay range and the beep
 * volume the Timer's next run uses. Must be called under
 * `PreferencesProvider`, which `App` mounts above the navigators.
 */
export const useTimerSettings = (): TimerSettingsValue => {
  const { preferences, setPreference } = usePreferences();
  const { startDelay, beepVolume } = preferences;

  const setStartDelay = useCallback(
    (range: StartDelayRange) => setPreference('startDelay', range),
    [setPreference],
  );
  const setBeepVolume = useCallback(
    (volume: BeepVolume) => setPreference('beepVolume', volume),
    [setPreference],
  );

  return useMemo(
    () => ({ startDelay, beepVolume, setStartDelay, setBeepVolume }),
    [startDelay, beepVolume, setStartDelay, setBeepVolume],
  );
};
