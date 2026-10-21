import { useCallback, useMemo } from 'react';

import type { LevelUnit } from '@/types/profile';
import { usePreferences } from '@hooks/usePreferences';

export type LevelUnitValue = {
  /** The unit sound levels are shown in. */
  levelUnit: LevelUnit;
  /**
   * Show levels in `unit` straight away and store it. Rejects, with the
   * last saved unit back on screen, when the save fails (see
   * `PreferencesContextValue.setPreference`).
   */
  setLevelUnit: (unit: LevelUnit) => Promise<void>;
};

/**
 * Read and change the unit sound levels are shown in. Display only: every
 * level is still measured and kept in dBFS. Must be called under
 * `PreferencesProvider`, which `App` mounts above the navigators.
 */
export const useLevelUnit = (): LevelUnitValue => {
  const { preferences, setPreference } = usePreferences();
  const { levelUnit } = preferences;

  const setLevelUnit = useCallback(
    (unit: LevelUnit) => setPreference('levelUnit', unit),
    [setPreference],
  );

  return useMemo(
    () => ({ levelUnit, setLevelUnit }),
    [levelUnit, setLevelUnit],
  );
};
