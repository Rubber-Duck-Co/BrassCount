import { useContext, useMemo } from 'react';

import { StyleSheet, useColorScheme } from 'react-native';

import { resolveThemeMode, themes, type Theme } from '@/theme/theme';
import { PreferencesContext } from '@store/PreferencesContext';

/**
 * Resolves the active theme from the Appearance preference in the profile
 * (`PreferencesProvider`), following the OS color scheme when it is
 * `system` — or when there is no provider, as for a component rendered on
 * its own in a test. Screens/components should get every design token from
 * here — never import the theme module directly.
 */
export const useTheme = (): Theme => {
  const scheme = useColorScheme();
  const preferences = useContext(PreferencesContext);
  const appearance = preferences?.preferences.appearance ?? 'system';
  return themes[resolveThemeMode(appearance, scheme)];
};

/**
 * Memoize a themed StyleSheet. Define `factory` at module scope (or wrap it
 * in `useCallback`) so the memo only recomputes when the theme changes —
 * an inline arrow works but recomputes every render.
 *
 * @example
 * const createStyles = (theme: Theme) =>
 *   StyleSheet.create({
 *     container: { backgroundColor: theme.colors.background, padding: theme.spacing.lg },
 *   });
 *
 * const styles = useThemedStyles(createStyles);
 */
export const useThemedStyles = <T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
): T => {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
};
