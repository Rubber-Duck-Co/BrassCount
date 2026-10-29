import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Typography } from './Typography';

type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  /** Mono + numeric keypad, for dB and other calibration values. */
  numeric?: boolean;
  /** Mono + decimal keypad, for par times and other fractional values. */
  decimal?: boolean;
  /** Mono text on the default keypad, for a value such as a handle. */
  mono?: boolean;
  /** Trailing unit shown inside the field, e.g. "dB". */
  unit?: string;
  editable?: boolean;
  /** Most characters the field accepts; typing stops there. */
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  /** Turn off for values a dictionary would mangle, such as a handle. */
  autoCorrect?: boolean;
  /**
   * Why the current value cannot be used. Shown under the field, which
   * takes the danger border, and announced when it appears.
   */
  error?: string | null;
  /** A muted line under the field. The error takes its place while shown. */
  hint?: string;
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    group: { gap: theme.spacing.xs },
    // Paper inside the Card of the box it sits in, ruled like the box.
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
      paddingHorizontal: theme.spacing.inset,
      minHeight: theme.sizes.touchTarget,
    },
    input: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.textPrimary,
      ...theme.typography.body,
    },
    monoInput: {
      ...theme.typography.metricSmall,
      color: theme.colors.textPrimary,
    },
    numericInput: { textAlign: 'right' },
    disabled: { opacity: 0.5 },
    invalid: { borderColor: theme.colors.danger },
  });

/**
 * Labelled text input: the Range Card field, a 2px ruled Paper box at
 * least 48dp tall, with its label above and a hint or error below.
 */
export const TextField = ({
  label,
  value,
  onChangeText,
  placeholder,
  numeric = false,
  decimal = false,
  mono = false,
  unit,
  editable = true,
  maxLength,
  autoCapitalize,
  autoCorrect,
  error,
  hint,
  testID,
}: TextFieldProps) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();

  const keyboardType = decimal
    ? 'decimal-pad'
    : numeric
      ? 'number-pad'
      : 'default';
  const numericInput = numeric || decimal;

  return (
    <View style={styles.group}>
      {label ? <Typography variant="bodyStrong">{label}</Typography> : null}

      <View
        style={[
          styles.field,
          !editable && styles.disabled,
          error ? styles.invalid : null,
        ]}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          editable={editable}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          accessibilityLabel={label}
          // The hint is read on the input, where the reader is; the line
          // under the field is hidden from TalkBack so it is not read twice.
          accessibilityHint={error ? undefined : hint}
          style={[
            styles.input,
            (mono || numericInput) && styles.monoInput,
            numericInput && styles.numericInput,
          ]}
        />
        {unit ? (
          <Typography variant="label" color="textTertiary">
            {unit}
          </Typography>
        ) : null}
      </View>

      {error ? (
        <Typography
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Typography>
      ) : hint ? (
        <Typography
          variant="label"
          color="textSecondary"
          accessibilityElementsHidden
          importantForAccessibility="no"
          testID={testID ? `${testID}-hint` : undefined}
        >
          {hint}
        </Typography>
      ) : null}
    </View>
  );
};
