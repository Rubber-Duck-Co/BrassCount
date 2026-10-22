import { Pressable, StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { LEVEL_UNITS, type LevelUnit } from '@/types/profile';
import { useThemedStyles } from '@hooks/useTheme';

import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { Typography } from './Typography';

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

type LevelUnitSheetProps = {
  visible: boolean;
  /** The unit in use, marked with a check. */
  selected: LevelUnit;
  onSelect: (unit: LevelUnit) => void;
  /** Called when the sheet is dismissed without choosing. */
  onClose: () => void;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Matches the Appearance sheet so the two Display pickers feel alike.
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md - theme.spacing.xs,
      paddingHorizontal: theme.spacing.lg,
      minHeight: 56,
    },
    optionDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    optionBody: { flex: 1, gap: 2 },
  });

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
}: LevelUnitSheetProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Close level units picker"
      backdropTestID="btn-level-unit-close"
    >
      <View accessibilityRole="radiogroup">
        <View style={styles.header}>
          <Typography
            variant="overline"
            color="textSecondary"
            accessibilityRole="header"
          >
            LEVEL UNITS
          </Typography>
        </View>

        {LEVEL_UNITS.map((unit, i) => {
          const isSelected = unit === selected;
          const copy = LEVEL_UNIT_COPY[unit];
          return (
            <Pressable
              key={unit}
              onPress={() => onSelect(unit)}
              accessibilityRole="radio"
              accessibilityLabel={copy.spoken}
              accessibilityState={{ checked: isSelected }}
              style={[styles.option, i > 0 && styles.optionDivider]}
              testID={`opt-level-unit-${unit}`}
            >
              <View style={styles.optionBody}>
                <Typography
                  variant="bodyStrong"
                  color={isSelected ? 'primary' : 'textPrimary'}
                >
                  {copy.label}
                </Typography>
                <Typography variant="caption" color="textTertiary">
                  {copy.description}
                </Typography>
              </View>
              {isSelected ? (
                <Icon name="check" size={18} color="primary" />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};
