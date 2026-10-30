import {
  APPEARANCE_PREFERENCES,
  type AppearancePreference,
} from '@/types/profile';

import { BottomSheet } from './BottomSheet';
import { OptionList, type OptionCopy } from './OptionList';

/** How each choice is named and explained in the sheet. */
const APPEARANCE_COPY: Record<AppearancePreference, OptionCopy> = {
  system: { label: 'System', description: 'Follows your device setting' },
  light: { label: 'Light', description: 'Always use the light theme' },
  dark: { label: 'Dark', description: 'Always use the dark theme' },
};

const APPEARANCE_OPTIONS = APPEARANCE_PREFERENCES.map(value => ({
  value,
  ...APPEARANCE_COPY[value],
}));

type AppearanceSheetProps = {
  visible: boolean;
  /** The choice in use, ticked. */
  selected: AppearancePreference;
  onSelect: (preference: AppearancePreference) => void;
  /** Called when the sheet is dismissed without choosing. */
  onClose: () => void;
};

/**
 * Bottom sheet for the Appearance preference: System, Light or Dark.
 * Choosing one calls `onSelect`; closing the sheet is left to the caller,
 * through `visible`.
 */
export const AppearanceSheet = ({
  visible,
  selected,
  onSelect,
  onClose,
}: AppearanceSheetProps) => (
  <BottomSheet
    visible={visible}
    onClose={onClose}
    closeLabel="Close appearance picker"
    title="Appearance"
    closeTestID="btn-appearance-close"
    backdropTestID="btn-appearance-backdrop"
  >
    <OptionList
      options={APPEARANCE_OPTIONS}
      selected={selected}
      onSelect={onSelect}
      testIDPrefix="opt-appearance"
    />
  </BottomSheet>
);
