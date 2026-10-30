import { LEVEL_UNITS, type LevelUnit } from '@/types/profile';

import { BottomSheet } from './BottomSheet';
import { OptionList } from './OptionList';

type UnitCopy = {
  label: string;
  description: string;
  /** What a screen reader says for the option: `dBFS` is not read well. */
  spoken: string;
};

/** How each unit is named and explained in the sheet. */
export const LEVEL_UNIT_COPY: Record<LevelUnit, UnitCopy> = {
  level: {
    label: 'Level',
    description: '0 to 100, e.g. 72',
    spoken: 'Level, 0 to 100',
  },
  dbfs: {
    label: 'dBFS',
    description: 'The raw reading, e.g. -12 dBFS',
    spoken: 'Decibels full scale, the raw reading',
  },
};

const LEVEL_UNIT_OPTIONS = LEVEL_UNITS.map(value => {
  const { label, description, spoken } = LEVEL_UNIT_COPY[value];
  return { value, label, description, accessibilityLabel: spoken };
});

type LevelUnitSheetProps = {
  visible: boolean;
  /** The unit in use, ticked. */
  selected: LevelUnit;
  onSelect: (unit: LevelUnit) => void;
  /** Called when the sheet is dismissed without choosing. */
  onClose: () => void;
};

/**
 * Bottom sheet for the unit sound levels are shown in: the 0–100 level
 * scale or raw dBFS. Choosing one calls `onSelect`; closing the sheet is
 * left to the caller, through `visible`.
 */
export const LevelUnitSheet = ({
  visible,
  selected,
  onSelect,
  onClose,
}: LevelUnitSheetProps) => (
  <BottomSheet
    visible={visible}
    onClose={onClose}
    closeLabel="Close level units picker"
    title="Level units"
    closeTestID="btn-level-unit-close"
    backdropTestID="btn-level-unit-backdrop"
  >
    <OptionList
      options={LEVEL_UNIT_OPTIONS}
      selected={selected}
      onSelect={onSelect}
      testIDPrefix="opt-level-unit"
    />
  </BottomSheet>
);
