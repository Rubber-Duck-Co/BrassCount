import { useState } from 'react';

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { Typography } from './Typography';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Optional hint shown under the label in the open sheet. */
  description?: string;
};

type SelectProps<T extends string> = {
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (next: T) => void;
  /** Heading for the sheet that opens on press. */
  sheetTitle?: string;
  /** The value cannot be changed: the trigger is dimmed and does not open. */
  disabled?: boolean;
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    group: { gap: theme.spacing.xs },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.touchTarget,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    // Matches a disabled `Button`.
    triggerDisabled: { opacity: 0.5 },
    triggerText: { flex: 1 },
    // Points the chevron down without a second glyph.
    triggerChevron: { transform: [{ rotate: '90deg' }] },

    // An untitled sheet pads its own options; a titled one's frame does.
    untitled: { paddingHorizontal: theme.spacing.gutter },
    // The options in a ruled box on the sheet's Paper.
    optionBox: {
      maxHeight: theme.sizes.sheetListMax,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.sheetRowMin,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.inset,
    },
    optionDivider: {
      borderTopWidth: theme.sizes.rule,
      borderTopColor: theme.colors.border,
    },
    optionBody: { flex: 1, gap: theme.spacing.xxs },
  });

type SelectSheetProps<T extends string> = {
  visible: boolean;
  onClose: () => void;
  value: T;
  options: SelectOption<T>[];
  onChoose: (next: T) => void;
  /**
   * Written as a sentence ("Drill"): the sheet's title row shows it in
   * stencil capitals beside a close button.
   */
  title?: string;
  /** The descriptions are figures (shots and par), set in Plex Mono. */
  figureDescriptions?: boolean;
  /**
   * Each option is `<testID>-option-<value>`, the box `<testID>-options`,
   * the backdrop `<testID>-backdrop` and the close button `<testID>-close`.
   */
  testID?: string;
};

/**
 * The options of a `Select` in a bottom sheet: a ruled box of rows on the
 * Range Card sheet frame, the chosen one ticked in Signal. For a screen
 * that draws its own trigger, such as the Timer's drill box.
 */
export function SelectSheet<T extends string>({
  visible,
  onClose,
  value,
  options,
  onChoose,
  title,
  figureDescriptions = false,
  testID,
}: Readonly<SelectSheetProps<T>>) {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Close"
      title={title || undefined}
      backdropTestID={testID ? `${testID}-backdrop` : undefined}
      closeTestID={testID ? `${testID}-close` : undefined}
    >
      <View style={title ? undefined : styles.untitled}>
        <ScrollView
          style={styles.optionBox}
          bounces={false}
          testID={testID ? `${testID}-options` : undefined}
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;

            return (
              <Pressable
                key={option.value}
                onPress={() => onChoose(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[styles.option, i > 0 && styles.optionDivider]}
                testID={testID ? `${testID}-option-${option.value}` : undefined}
              >
                <View style={styles.optionBody}>
                  <Typography variant="bodyStrong">{option.label}</Typography>
                  {option.description ? (
                    <Typography
                      variant={figureDescriptions ? 'metricCaption' : 'caption'}
                      color="textSecondary"
                    >
                      {option.description}
                    </Typography>
                  ) : null}
                </View>

                {isSelected ? (
                  <Icon name="check" size={sizes.iconLg} color="primary" />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

/**
 * Dropdown built on React Native's core `Modal`.
 *
 * The project has no picker dependency, so the options open in a bottom
 * sheet — which also gives more room for labels than a native picker wheel.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  sheetTitle,
  disabled = false,
  testID,
}: Readonly<SelectProps<T>>) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);

  const selected = options.find(option => option.value === value);

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <View style={styles.group}>
      {label ? (
        <Typography variant="label" color="textSecondary">
          {label}
        </Typography>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? sheetTitle ?? 'Select an option'}
        accessibilityValue={{ text: selected?.label }}
        accessibilityState={{ disabled }}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        testID={testID}
      >
        <View style={styles.triggerText}>
          <Typography
            variant="bodyStrong"
            color={selected ? 'textPrimary' : 'textTertiary'}
            numberOfLines={1}
          >
            {selected?.label ?? 'Choose…'}
          </Typography>
        </View>

        <View style={styles.triggerChevron}>
          <Icon name="chevron" size={14} color="textTertiary" />
        </View>
      </Pressable>

      <SelectSheet
        visible={open}
        onClose={() => setOpen(false)}
        value={value}
        options={options}
        onChoose={choose}
        title={sheetTitle}
        testID={testID}
      />
    </View>
  );
}
