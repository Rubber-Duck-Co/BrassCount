import { StyleSheet, TouchableOpacity, View } from 'react-native';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '@/theme/theme';
import { Typography } from '@components/Typography';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

/**
 * Tab labels grow with the system font only this far, then shrink to fit
 * their one line: a word that wraps mid-letter reads worse than a smaller one.
 */
const LABEL_MAX_FONT_MULTIPLIER = 1.3;
const LABEL_MIN_FONT_SCALE = 0.7;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.outline,
    },
    tab: {
      flex: 1,
      minHeight: theme.sizes.tabBar,
      paddingHorizontal: theme.spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeTab: { backgroundColor: theme.colors.inverse },
  });

/**
 * Bottom bar — text-only tabs of equal width. The active tab is inverted
 * (Ink fill, Paper label) so it reads at a glance without colour or icons.
 */
export const TabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          minHeight: theme.sizes.tabBar + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            activeOpacity={0.7}
            style={[styles.tab, focused && styles.activeTab]}
            testID={`tab-${route.name}`}
          >
            <Typography
              variant="actionLabel"
              color={focused ? 'textOnInverse' : 'textPrimary'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={LABEL_MIN_FONT_SCALE}
              maxFontSizeMultiplier={LABEL_MAX_FONT_MULTIPLIER}
            >
              {label.toUpperCase()}
            </Typography>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
