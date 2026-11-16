import type { ReactNode } from 'react';

import {
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { Theme } from '@/theme/theme';
import { useThemedStyles } from '@hooks/useTheme';

type CardProps = {
  children: ReactNode;
  /** Render as a button. Adds press feedback and a button a11y role. */
  onPress?: () => void;
  /** Drop the default inner padding when the card hosts its own rows. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.none,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      overflow: 'hidden',
    },
    padded: {
      padding: theme.spacing.md,
    },
  });

/**
 * The Range Card ruled box: a 2px outline around the Card fill, square
 * corners and no shadow. The base unit every screen is built from; rows
 * inside it are split by 1px Rule lines (`ListRow` `divided`).
 */
export const Card = ({
  children,
  onPress,
  flush = false,
  style,
  testID,
}: CardProps) => {
  const styles = useThemedStyles(createStyles);

  const composed = [styles.base, !flush && styles.padded, style];

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        activeOpacity={0.75}
        style={composed}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={composed}>
      {children}
    </View>
  );
};
