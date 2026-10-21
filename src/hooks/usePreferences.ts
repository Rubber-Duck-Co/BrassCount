import { useContext } from 'react';

import {
  PreferencesContext,
  type PreferencesContextValue,
} from '@store/PreferencesContext';

/**
 * Read and change the display preferences. Must be called under
 * `PreferencesProvider`, which `App` mounts above the navigators. Most
 * callers want one preference: `useAppearance` or `useLevelUnit`.
 */
export const usePreferences = (): PreferencesContextValue => {
  const value = useContext(PreferencesContext);
  if (value === null) {
    throw new Error(
      'Display preferences must be used within a PreferencesProvider',
    );
  }
  return value;
};
