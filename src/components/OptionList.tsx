import { Pressable, StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Icon } from './Icon';
import { Typography } from './Typography';

/** How an option is named and explained. */
export type OptionCopy = {
  label: string;
  /** Shown under the label. */
  description: string;
  /**
   * What a screen reader says for the option, when the label and
   * description do not read well (`dBFS`). Defaults to both, in order.
   */
  accessibilityLabel?: string;
};

export type OptionItem<T extends string> = OptionCopy & { value: T };

type OptionListProps<T extends string> = {
  options: readonly OptionItem<T>[];
  /** The option in use, ticked. */
  selected: T;
  onSelect: (value: T) => void;
  /** The box is `<testIDPrefix>`, each option `<testIDPrefix>-<value>`. */
  testIDPrefix: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // The options in a ruled box on the sheet's Paper, like `SelectSheet`.
    box: {
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    // A minimum height, so a label that wraps at a large font grows the
    // row instead of clipping.
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.sheetRowMin,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.inset,
    },
    divider: {
      borderTopWidth: theme.sizes.rule,
      borderTopColor: theme.colors.border,
    },
    body: { flex: 1, gap: theme.spacing.xxs },
  });

/**
 * A preference sheet's choices: a ruled box of radio rows, split by 1px
 * Rule lines. The chosen row is ticked, and only it: every label keeps the
 * same colour, so the choice never rests on the Signal colour alone.
 * Choosing calls `onSelect`; what happens next is the sheet's to decide.
 */
export function OptionList<T extends string>({
  options,
  selected,
  onSelect,
  testIDPrefix,
}: Readonly<OptionListProps<T>>) {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={styles.box}
      testID={testIDPrefix}
    >
      {options.map((option, i) => {
        const isSelected = option.value === selected;

        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={
              option.accessibilityLabel ??
              `${option.label}, ${option.description}`
            }
            accessibilityState={{ checked: isSelected }}
            style={[styles.option, i > 0 && styles.divider]}
            testID={`${testIDPrefix}-${option.value}`}
          >
            <View style={styles.body}>
              <Typography variant="bodyStrong">{option.label}</Typography>
              <Typography variant="caption" color="textSecondary">
                {option.description}
              </Typography>
            </View>
            {isSelected ? (
              <Icon name="check" size={sizes.iconLg} color="primary" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
