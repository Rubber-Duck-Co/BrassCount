import type { TextStyle, ViewStyle } from 'react-native';

import type { AppearancePreference } from '@/types/profile';

/**
 * Range Card palette (the RC boards of the redesign canvas).
 *
 * Roles: Paper is the screen ground, Card the inside of every ruled box,
 * Ink the text and the 2px outlines (dark mode draws outlines in a softer
 * grey), Pencil labels and captions, Rule the 1px row dividers only.
 * Signal orange means "act or look" and is used only for `primary` and
 * `warning` (an over-par split, a sound still to calibrate).
 *
 * The boards have no green and no red, so `danger` and `success` are Ink:
 * a destructive action takes the Ink-filled Stop style with Paper text, and
 * success needs no colour. Over-par moves from `danger` to `warning` in the
 * screen redesigns.
 *
 * Signal on light Paper is 4.15:1: fine for large text and marks, not for
 * body text. Orange body text belongs on Card (4.58:1).
 *
 * Never reference these directly from components — always go through the
 * semantic `colors` on the active theme.
 */
const palette = {
  white: '#FFFFFF',
  black: '#000000',

  paper: '#ECE6D4',
  card: '#F5F1E4',
  ink: '#1B1B17',
  pencil: '#5A574C',
  rule: '#BDB5A0',
  signal: '#C2410C',
  disabled: '#8C8778',

  paperDark: '#1F1E1B',
  cardDark: '#292824',
  inkDark: '#E6E0CE',
  outlineDark: '#858070',
  pencilDark: '#A8A291',
  ruleDark: '#3B3A34',
  signalDark: '#E8692F',
  disabledDark: '#6B675B',

  scrim: 'rgba(0, 0, 0, 0.45)',
} as const;

export type Palette = typeof palette;

// Spacing & radius — proportional scales. Screens/components MUST use these.
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  /** Side gutter and the gap between blocks. */
  gutter: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Range Card is square-cornered. The keys stay so existing call sites
// compile until the component redesigns drop them.
export const radius = {
  none: 0,
  sm: 0,
  badge: 0,
  md: 0,
  lg: 0,
  pill: 0,
} as const;

// Fixed dimensions in dp. The header and main-action heights are minimums,
// never fixed heights, so large system fonts grow them instead of clipping.
export const sizes = {
  touchTarget: 48,
  headerMin: 124,
  tabBar: 64,
  mainActionMin: 72,
  /** Box outline width. */
  border: 2,
  /** Divider between rows. */
  rule: 1,
  badge: 26,
  removeButton: 32,
  moveButton: 40,
  iconSm: 12,
  iconMd: 16,
  iconLg: 18,
} as const;

export type Spacing = typeof spacing;
export type Sizes = typeof sizes;
export type Radius = typeof radius;

/**
 * One `fontFamily` per weight, each the basename of a TTF in
 * `android/app/src/main/assets/fonts`. Android resolves a custom family by
 * file name; adding a `fontWeight` makes it look for another file or
 * synthesise the weight, so variants never set one.
 *
 * Timers and dB readings change digit-by-digit, so they use Plex Mono —
 * a proportional font makes the numbers jitter horizontally as they tick.
 */
export const fontFamilies = {
  stencil: 'BigShouldersStencilDisplay-ExtraBold',
  sansMedium: 'IBMPlexSansCondensed-Medium',
  sansSemibold: 'IBMPlexSansCondensed-SemiBold',
  sansBold: 'IBMPlexSansCondensed-Bold',
  mono: 'IBMPlexMono-Regular',
  monoMedium: 'IBMPlexMono-Medium',
  monoSemibold: 'IBMPlexMono-SemiBold',
} as const;

export type FontFamilies = typeof fontFamilies;
export type FontFamily = FontFamilies[keyof FontFamilies];

type TypographyStyle = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'letterSpacing'
> & { fontFamily: FontFamily };

// Typography — variants bundle family + size + lineHeight so callers pick a
// role ("title") instead of hand-mixing fonts and sizes everywhere.
export const typography = {
  display: {
    fontSize: 64,
    lineHeight: 72,
    fontFamily: fontFamilies.stencil,
    letterSpacing: 2,
  },
  /** Screen title in the header. */
  stencilTitle: {
    fontSize: 36,
    lineHeight: 40,
    fontFamily: fontFamilies.stencil,
    letterSpacing: 1.5,
  },
  /** Drill names and sheet titles. */
  stencilName: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fontFamilies.stencil,
    letterSpacing: 1,
  },
  title: { fontSize: 28, lineHeight: 34, fontFamily: fontFamilies.sansBold },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fontFamilies.sansBold,
  },
  body: { fontSize: 16, lineHeight: 22, fontFamily: fontFamilies.sansMedium },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fontFamilies.sansBold,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamilies.sansMedium,
  },

  /** Small all-caps section heading. Pair with `textSecondary`. */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFamilies.sansSemibold,
    letterSpacing: 1.2,
  },
  /** Range Card section label: 11 bold, 2px tracking, `textSecondary`. */
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFamilies.sansBold,
    letterSpacing: 2,
  },
  /** Field labels and dense table headers. */
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamilies.sansMedium,
  },

  /** Running shot timer. Mono so digits never shift as they tick. */
  timer: {
    fontSize: 68,
    lineHeight: 78,
    fontFamily: fontFamilies.monoMedium,
    letterSpacing: -1,
  },
  /** Split times, dB values, card stats. */
  metric: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: fontFamilies.monoSemibold,
  },
  metricSmall: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontFamilies.monoMedium,
  },
} as const satisfies Record<string, TypographyStyle>;

export type Typography = typeof typography;
export type TypographyVariant = keyof Typography;

// Semantic colors — every screen/component references these role names, never
// the palette. Both themes MUST have the same shape (SemanticColors) so
// adding a token forces you to define it for both modes.
export type SemanticColors = {
  /** Paper: the screen ground. */
  background: string;
  /** Card: inside every ruled box. */
  surface: string;
  /** A second stacked level — rows *inside* a card. */
  surfaceElevated: string;
  /** Rule: 1px row dividers only. */
  border: string;
  /** A card's outer edge; the same as `outline`. */
  borderStrong: string;
  /** 2px box outlines and the active tab. */
  outline: string;
  textPrimary: string;
  textSecondary: string;
  /** De-emphasised meta: timestamps, row indices, units. */
  textTertiary: string;
  textOnPrimary: string;
  textOnWarning: string;
  /** Text on a `danger` fill, e.g. a destructive button. */
  textOnDanger: string;
  primary: string;
  primaryMuted: string;
  /** Fill for chips/badges that carry `primary` text. */
  primarySoft: string;
  /** Disabled text and controls; exempt from the contrast minimum. */
  disabled: string;
  success: string;
  danger: string;
  warning: string;
  /** Backdrop behind modal surfaces. */
  overlay: string;
};

const lightColors: SemanticColors = {
  background: palette.paper,
  surface: palette.card,
  surfaceElevated: palette.card,
  border: palette.rule,
  borderStrong: palette.ink,
  outline: palette.ink,
  textPrimary: palette.ink,
  textSecondary: palette.pencil,
  textTertiary: palette.pencil,
  textOnPrimary: palette.white,
  textOnWarning: palette.white,
  textOnDanger: palette.paper,
  primary: palette.signal,
  primaryMuted: palette.signal,
  primarySoft: palette.card,
  disabled: palette.disabled,
  success: palette.ink,
  danger: palette.ink,
  warning: palette.signal,
  overlay: palette.scrim,
};

const darkColors: SemanticColors = {
  background: palette.paperDark,
  surface: palette.cardDark,
  surfaceElevated: palette.cardDark,
  border: palette.ruleDark,
  borderStrong: palette.outlineDark,
  outline: palette.outlineDark,
  textPrimary: palette.inkDark,
  textSecondary: palette.pencilDark,
  textTertiary: palette.pencilDark,
  textOnPrimary: palette.paperDark,
  textOnWarning: palette.paperDark,
  textOnDanger: palette.paperDark,
  primary: palette.signalDark,
  primaryMuted: palette.signalDark,
  primarySoft: palette.cardDark,
  disabled: palette.disabledDark,
  success: palette.inkDark,
  danger: palette.inkDark,
  warning: palette.signalDark,
  overlay: palette.scrim,
};

// Theme objects — one shape, two instances. Consumers get everything from
// `useTheme()`; no need to know whether the app is in light or dark mode.
export type ThemeMode = 'light' | 'dark';

export type Elevation = Pick<
  ViewStyle,
  | 'shadowColor'
  | 'shadowOffset'
  | 'shadowOpacity'
  | 'shadowRadius'
  | 'elevation'
>;

/**
 * Shadows read as mud on a near-black background, so dark mode leans on
 * surface/border contrast instead and keeps only a token Android elevation.
 */
const buildElevation = (mode: ThemeMode) => {
  const opacity = mode === 'light' ? 1 : 0;
  return {
    none: { elevation: 0 },
    card: {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06 * opacity,
      shadowRadius: 3,
      elevation: mode === 'light' ? 2 : 0,
    },
    raised: {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16 * opacity,
      shadowRadius: 10,
      elevation: mode === 'light' ? 8 : 6,
    },
  } as const satisfies Record<string, Elevation>;
};

export type Elevations = ReturnType<typeof buildElevation>;

export type Theme = {
  mode: ThemeMode;
  colors: SemanticColors;
  spacing: Spacing;
  radius: Radius;
  sizes: Sizes;
  typography: Typography;
  fontFamilies: FontFamilies;
  elevation: Elevations;
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  spacing,
  radius,
  sizes,
  typography,
  fontFamilies,
  elevation: buildElevation('light'),
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  spacing,
  radius,
  sizes,
  typography,
  fontFamilies,
  elevation: buildElevation('dark'),
};

export const themes = { light: lightTheme, dark: darkTheme } as const;

/**
 * Which mode the app draws in for an Appearance preference. `system`
 * follows the device's color scheme, and a device that reports none
 * (`null`, or `unspecified` on some Android builds) gets light.
 */
export const resolveThemeMode = (
  preference: AppearancePreference,
  systemScheme: string | null | undefined,
): ThemeMode => {
  if (preference !== 'system') {
    return preference;
  }
  return systemScheme === 'dark' ? 'dark' : 'light';
};
