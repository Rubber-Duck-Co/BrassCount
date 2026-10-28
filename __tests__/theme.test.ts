import fs from 'fs';
import path from 'path';

import {
  darkTheme,
  fontFamilies,
  lightTheme,
  radius,
  resolveThemeMode,
  sizes,
  spacing,
  typography,
  type SemanticColors,
  type Theme,
} from '../src/theme/theme';

const FONTS_DIR = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'fonts',
);

const channel = (hex: string, offset: number): number => {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) +
  0.7152 * channel(hex, 3) +
  0.0722 * channel(hex, 5);

const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

const SPEC: Record<'light' | 'dark', Partial<SemanticColors>> = {
  light: {
    background: '#ECE6D4',
    surface: '#F5F1E4',
    textPrimary: '#1B1B17',
    outline: '#1B1B17',
    inverse: '#1B1B17',
    textOnInverse: '#ECE6D4',
    textSecondary: '#5A574C',
    border: '#BDB5A0',
    primary: '#C2410C',
    primaryBorder: '#1B1B17',
    disabled: '#8C8778',
  },
  dark: {
    background: '#1F1E1B',
    surface: '#292824',
    textPrimary: '#E6E0CE',
    outline: '#858070',
    inverse: '#E6E0CE',
    textOnInverse: '#1F1E1B',
    textSecondary: '#A8A291',
    border: '#3B3A34',
    primary: '#E8692F',
    primaryBorder: '#E8692F',
    textOnPrimary: '#1F1E1B',
    disabled: '#6B675B',
  },
};

const themesByMode: [string, Theme][] = [
  ['light', lightTheme],
  ['dark', darkTheme],
];

describe('Range Card palettes', () => {
  it('gives light and dark identical colour keys', () => {
    expect(Object.keys(darkTheme.colors).sort()).toEqual(
      Object.keys(lightTheme.colors).sort(),
    );
  });

  it.each(themesByMode)('matches the spec hexes in %s mode', (mode, theme) => {
    expect(theme.colors).toMatchObject(SPEC[mode as 'light' | 'dark']);
  });

  it.each(themesByMode)(
    'keeps text and primary pairs at 4.5:1 or better in %s mode',
    (_mode, { colors }) => {
      const pairs: [string, string][] = [
        [colors.textPrimary, colors.background],
        [colors.textPrimary, colors.surface],
        [colors.textSecondary, colors.background],
        [colors.textSecondary, colors.surface],
        [colors.textTertiary, colors.background],
        [colors.textTertiary, colors.surface],
        [colors.textOnPrimary, colors.primary],
        [colors.textOnWarning, colors.warning],
        [colors.textOnDanger, colors.danger],
        [colors.textOnInverse, colors.inverse],
        [colors.danger, colors.surface],
        [colors.success, colors.surface],
        [colors.primary, colors.surface],
      ];
      pairs.forEach(([fg, bg]) => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    },
  );

  it.each(themesByMode)(
    'keeps primary on the screen ground at 3:1 for large text and marks in %s mode',
    (_mode, { colors }) => {
      expect(
        contrast(colors.primary, colors.background),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(themesByMode)(
    'uses orange only for primary and warning roles in %s mode',
    (mode, { colors }) => {
      const orangeRoles = Object.entries(colors)
        .filter(([, value]) => value === colors.primary)
        .map(([key]) => key)
        .sort();

      // Dark mode outlines the primary button in its own orange.
      const expected =
        mode === 'dark'
          ? ['primary', 'primaryBorder', 'primaryMuted', 'warning']
          : ['primary', 'primaryMuted', 'warning'];
      expect(orangeRoles).toEqual(expected);
    },
  );

  it('sets the main action and the small stencil in Big Shoulders Stencil', () => {
    expect(typography.mainAction).toMatchObject({
      fontFamily: fontFamilies.stencil,
      fontSize: 36,
      letterSpacing: 8,
    });
    expect(typography.stencilSmall).toMatchObject({
      fontFamily: fontFamilies.stencil,
      fontSize: 22,
    });
  });
});

describe('Range Card tokens', () => {
  it('squares every corner', () => {
    Object.values(radius).forEach(value => expect(value).toBe(0));
  });

  it('defines the layout sizes from the spec', () => {
    expect(spacing.gutter).toBe(20);
    expect(spacing.inset).toBe(12);
    expect(sizes.markBox).toBe(40);
    expect(sizes).toMatchObject({
      headerMin: 124,
      tabBar: 64,
      mainActionMin: 72,
      border: 2,
      rule: 1,
      touchTarget: 48,
    });
  });

  it('sets no fontWeight, so Android never synthesises a weight', () => {
    Object.values(typography).forEach(variant => {
      expect(variant).not.toHaveProperty('fontWeight');
    });
  });

  it('gives every typography variant a bundled family', () => {
    const families = new Set(Object.values(fontFamilies));
    Object.values(typography).forEach(variant => {
      expect(families.has(variant.fontFamily)).toBe(true);
    });
  });

  it('sets the readouts in Plex Mono', () => {
    [typography.timer, typography.metric, typography.metricSmall].forEach(
      variant => expect(variant.fontFamily).toMatch(/^IBMPlexMono-/),
    );
  });

  it('has a bundled .ttf for every font family name', () => {
    Object.values(fontFamilies).forEach(name => {
      expect(fs.existsSync(path.join(FONTS_DIR, `${name}.ttf`))).toBe(true);
    });
  });

  it('ships the OFL licence for each family', () => {
    const licences = fs
      .readdirSync(FONTS_DIR)
      .filter(file => file.startsWith('OFL-'));
    expect(licences.sort()).toEqual([
      'OFL-BigShoulders.txt',
      'OFL-IBMPlexMono.txt',
      'OFL-IBMPlexSansCondensed.txt',
    ]);
  });
});

describe('resolveThemeMode', () => {
  it('follows the device only for the system preference', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', null)).toBe('light');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });
});
