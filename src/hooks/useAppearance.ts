import { useCallback, useMemo } from 'react';

import type { AppearancePreference } from '@/types/profile';
import { usePreferences } from '@hooks/usePreferences';

export type AppearanceValue = {
  /** The Appearance choice the app is drawn with. */
  preference: AppearancePreference;
  /**
   * Switch the app to `preference` straight away and store it. Rejects,
   * with the last saved choice back on screen, when the save fails (see
   * `PreferencesContextValue.setPreference`).
   */
  setPreference: (preference: AppearancePreference) => Promise<void>;
};

/**
 * Read and change the Appearance preference. Must be called under
 * `PreferencesProvider`, which `App` mounts above the navigators.
 */
export const useAppearance = (): AppearanceValue => {
  const { preferences, setPreference: setAny } = usePreferences();
  const preference = preferences.appearance;

  const setPreference = useCallback(
    (next: AppearancePreference) => setAny('appearance', next),
    [setAny],
  );

  return useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );
};
