import { StyleSheet, TouchableOpacity, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Icon } from './Icon';
import { Typography } from './Typography';

type AvatarProps = {
  /**
   * Full name. Reduced to up to two initials; a blank name shows a person
   * glyph instead, so the square is never empty.
   */
  name: string;
  /** Width and height. Defaults to the `avatar` size token. */
  size?: number;
  onPress?: () => void;
  testID?: string;
};

/** How much of the square the person glyph fills. */
const GLYPH_SCALE = 0.5;

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    // By code point, so a simple emoji at the start of a name is not cut
    // in half.
    .map(part => Array.from(part)[0] ?? '')
    .join('')
    .toUpperCase();

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.inverse,
      borderRadius: theme.radius.none,
    },
  });

/**
 * The Range Card initials square: stencil initials in Paper on an Ink
 * fill. Avoids bundling image assets for a placeholder.
 */
export const Avatar = ({ name, size, onPress, testID }: AvatarProps) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const initials = initialsOf(name);
  const side = size ?? theme.sizes.avatar;

  const sizing = { width: side, height: side };
  const content = initials ? (
    <Typography
      variant="stencilSmall"
      color="textOnInverse"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {initials}
    </Typography>
  ) : (
    <Icon name="user" size={side * GLYPH_SCALE} color="textOnInverse" />
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          initials ? `${name.trim()}, open profile` : 'Open profile'
        }
        activeOpacity={0.75}
        style={[styles.base, sizing]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={name}
      style={[styles.base, sizing]}
    >
      {content}
    </View>
  );
};
