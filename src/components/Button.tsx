import type { ReactNode, Ref } from 'react';

import {
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { SemanticColors, Theme } from '@/theme/theme';
import { Typography } from '@components/Typography';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

/**
 * The Range Card buttons. `primary` is the one main action on a screen,
 * including the confirm of a destructive sheet (Delete drill); `secondary`
 * is Cancel, Load, Try again; `stop` (Ink fill) is Stop only; `text` is an
 * underlined word with no box.
 */
type ButtonVariant = 'primary' | 'secondary' | 'stop' | 'text';

/**
 * `main` is the main action at the bottom of a screen (Start, Stop, Save
 * run): taller, with a stencil label.
 */
type ButtonSize = 'default' | 'main';

type ColorKey = keyof SemanticColors;

type VariantColors = {
  /** `null` draws no fill. */
  fill: ColorKey | null;
  /** `null` draws no outline. */
  border: ColorKey | null;
  text: ColorKey;
};

const VARIANT_COLORS: Record<ButtonVariant, VariantColors> = {
  primary: { fill: 'primary', border: 'primaryBorder', text: 'textOnPrimary' },
  secondary: { fill: null, border: 'outline', text: 'textPrimary' },
  stop: { fill: 'inverse', border: 'inverse', text: 'textOnInverse' },
  text: { fill: null, border: null, text: 'textPrimary' },
};

/** A disabled or busy button: no fill, greyed outline and label. */
const INERT_COLORS: VariantColors = {
  fill: null,
  border: 'disabled',
  text: 'disabled',
};

const TRANSPARENT = 'transparent';

type ButtonProps = {
  /** Written as a sentence ("Try again"); the button shows it in capitals. */
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** The button's work is under way: announced as busy, and not pressable. */
  busy?: boolean;
  /**
   * What a screen reader announces in place of `label`. Set it when the
   * visible label repeats on the screen and needs its subject spelled out.
   */
  accessibilityLabel?: string;
  /** Read after the label; use it to say why the button is disabled. */
  accessibilityHint?: string;
  /**
   * For a button that shows or hides something: whether it is showing.
   * Left out, the button is announced as neither.
   */
  expanded?: boolean;
  /** A mark drawn before the label, such as Stop's square. */
  leading?: ReactNode;
  /** The touchable, so a screen can move a screen reader's focus to it. */
  ref?: Ref<View>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      borderWidth: theme.sizes.border,
      borderRadius: theme.radius.none,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Heights are minimums, so a large system font grows the button
    // instead of clipping its label.
    default: { minHeight: theme.sizes.touchTarget },
    main: { minHeight: theme.sizes.mainActionMin },
    // A leading mark sits beside the label, the pair centred together.
    withLeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    label: { textTransform: 'uppercase' },
    underline: { textDecorationLine: 'underline' },
  });

const colorOf = (theme: Theme, key: ColorKey | null): string =>
  key === null ? TRANSPARENT : theme.colors[key];

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  busy = false,
  accessibilityLabel,
  accessibilityHint,
  expanded,
  leading,
  ref,
  style,
  testID,
}: ButtonProps) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const inert = disabled || busy;
  const colors = inert ? INERT_COLORS : VARIANT_COLORS[variant];
  // A text button stays a bare word when disabled: no outline appears.
  const border = variant === 'text' ? null : colors.border;

  const colorStyle: ViewStyle = {
    backgroundColor: colorOf(theme, colors.fill),
    borderColor: colorOf(theme, border),
  };
  const labelStyle: StyleProp<TextStyle> = [
    styles.label,
    variant === 'text' && !inert && styles.underline,
  ];

  // Centred, so a label that wraps stays in the middle of the button.
  const text = (
    <Typography
      variant={size === 'main' ? 'mainAction' : 'actionLabel'}
      color={colors.text}
      align="center"
      style={labelStyle}
    >
      {label}
    </Typography>
  );

  return (
    <TouchableOpacity
      ref={ref}
      testID={testID}
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      // Announced as written: TalkBack spells out some words in capitals.
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy, expanded }}
      activeOpacity={0.7}
      style={[styles.box, styles[size], colorStyle, style]}
    >
      {leading === undefined ? (
        text
      ) : (
        <View style={styles.withLeading}>
          {leading}
          {text}
        </View>
      )}
    </TouchableOpacity>
  );
};
