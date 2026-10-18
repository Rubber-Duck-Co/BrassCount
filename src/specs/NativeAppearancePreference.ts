import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Mirror the Appearance preference (`system`, `light` or `dark`) where
   * the next launch can read it before JavaScript runs.
   */
  setPreference(preference: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppearancePreference');
