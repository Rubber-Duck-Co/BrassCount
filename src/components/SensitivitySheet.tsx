import {
  DETECTION_SENSITIVITIES,
  type DetectionSensitivity,
} from '@/types/profile';

import { BottomSheet } from './BottomSheet';
import { OptionList, type OptionCopy } from './OptionList';

/** How each sensitivity is named and explained. */
export const SENSITIVITY_COPY: Record<DetectionSensitivity, OptionCopy> = {
  low: { label: 'Low', description: 'Fewer false shots' },
  normal: { label: 'Normal', description: 'The default, a balance of both' },
  high: { label: 'High', description: 'Fewer missed shots' },
};

const SENSITIVITY_OPTIONS = DETECTION_SENSITIVITIES.map(value => ({
  value,
  ...SENSITIVITY_COPY[value],
}));

type SensitivitySheetProps = {
  visible: boolean;
  /** The sensitivity in use, ticked. */
  selected: DetectionSensitivity;
  onSelect: (sensitivity: DetectionSensitivity) => void;
  /** Called when the sheet is dismissed without choosing. */
  onClose: () => void;
};

/**
 * Bottom sheet for the detection sensitivity: Low, Normal or High. Choosing
 * one calls `onSelect`; closing the sheet is left to the caller, through
 * `visible`.
 */
export const SensitivitySheet = ({
  visible,
  selected,
  onSelect,
  onClose,
}: SensitivitySheetProps) => (
  <BottomSheet
    visible={visible}
    onClose={onClose}
    closeLabel="Close sensitivity picker"
    title="Sensitivity"
    closeTestID="btn-sensitivity-close"
    backdropTestID="btn-sensitivity-backdrop"
  >
    <OptionList
      options={SENSITIVITY_OPTIONS}
      selected={selected}
      onSelect={onSelect}
      testIDPrefix="opt-sensitivity"
    />
  </BottomSheet>
);
