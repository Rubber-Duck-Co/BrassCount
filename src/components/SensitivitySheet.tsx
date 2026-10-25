import { Pressable, StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import {
  DETECTION_SENSITIVITIES,
  type DetectionSensitivity,
} from '@/types/profile';
import { useThemedStyles } from '@hooks/useTheme';

import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { Typography } from './Typography';

type SensitivityCopy = { label: string; description: string };

/** How each sensitivity is named and explained. */
export const SENSITIVITY_COPY: Record<DetectionSensitivity, SensitivityCopy> = {
  low: { label: 'Low', description: 'Fewer false shots' },
  normal: { label: 'Normal', description: 'The default, a balance of both' },
  high: { label: 'High', description: 'Fewer missed shots' },
};

type SensitivitySheetProps = {
  visible: boolean;
  /** The sensitivity in use, marked with a check. */
  selected: DetectionSensitivity;
  onSelect: (sensitivity: DetectionSensitivity) => void;
  /** Called when the sheet is dismissed without choosing. */
  onClose: () => void;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Matches the Display pickers.
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
 * Bottom sheet for the detection sensitivity: Low, Normal or High. Choosing
 * one calls `onSelect`; closing the sheet is left to the caller, through
 * `visible`.
 */
export const SensitivitySheet = ({
  visible,
  selected,
  onSelect,
  onClose,
}: SensitivitySheetProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Close sensitivity picker"
      backdropTestID="btn-sensitivity-close"
    >
      <View accessibilityRole="radiogroup">
        <View style={styles.header}>
          <Typography
            variant="overline"
            color="textSecondary"
            accessibilityRole="header"
          >
            SENSITIVITY
          </Typography>
        </View>

        {DETECTION_SENSITIVITIES.map((sensitivity, i) => {
          const isSelected = sensitivity === selected;
          const copy = SENSITIVITY_COPY[sensitivity];
          return (
            <Pressable
              key={sensitivity}
              onPress={() => onSelect(sensitivity)}
              accessibilityRole="radio"
              accessibilityLabel={`${copy.label}, ${copy.description}`}
              accessibilityState={{ checked: isSelected }}
              style={[styles.option, i > 0 && styles.optionDivider]}
              testID={`opt-sensitivity-${sensitivity}`}
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
