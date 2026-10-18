import { Platform } from 'react-native';

import NativeAppearancePreference from '@/specs/NativeAppearancePreference';
import type { AppearancePreference } from '@/types/profile';

/**
 * Copy the Appearance preference to the native side, which reads it on the
 * next launch to paint the window in the pinned theme before JavaScript
 * has started. The profile in storage stays the source of truth, so a
 * failure here is not an error the shooter can act on: the only cost is a
 * brief wrong-coloured window at the next cold start, and the next change
 * tries again.
 *
 * Android-only, like the module behind it: a no-op elsewhere.
 */
export const mirrorAppearance = (preference: AppearancePreference): void => {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    NativeAppearancePreference.setPreference(preference);
  } catch {
    // Deliberately ignored; see above.
  }
};
