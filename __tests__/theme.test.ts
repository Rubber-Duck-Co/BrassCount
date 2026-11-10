import fs from 'fs';
import path from 'path';

import {
  darkTheme,
  fieldTheme,
  fontFamilies,
  lightTheme,
  nightTheme,
  radius,
  resolveThemeScheme,
  sizes,
  spacing,
  typography,
  type SemanticColors,
  type Theme,
  type ThemeScheme,
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

const SPEC: Record<ThemeScheme, Partial<SemanticColors>> = {
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
    meterTrack: '#DDD5C0',
    overlay: 'rgba(27, 27, 23, 0.55)',
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
    meterTrack: '#35342E',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  field: {
    background: '#1C2017',
    surface: '#262B20',
    textPrimary: '#ECE7D6',
    outline: '#7E8466',
    borderStrong: '#7E8466',
    inverse: '#ECE7D6',
    textOnInverse: '#1C2017',
    textSecondary: '#B3AF98',
    border: '#3A4130',
    primary: '#CFA55A',
    primaryBorder: '#CFA55A',
    warning: '#CFA55A',
    textOnPrimary: '#1C2017',
    textOnWarning: '#1C2017',
    success: '#ECE7D6',
    danger: '#ECE7D6',
    disabled: '#646A50',
    meterTrack: '#313828',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  night: {
    background: '#0A0A0A',
    surface: '#151515',
    textPrimary: '#EDE6D6',
    outline: '#6E6A63',
    borderStrong: '#6E6A63',
    inverse: '#EDE6D6',
    textOnInverse: '#0A0A0A',
    textSecondary: '#999488',
    border: '#2A2A2A',
    primary: '#FFB547',
    primaryBorder: '#FFB547',
    warning: '#FFB547',
    textOnPrimary: '#0A0A0A',
    textOnWarning: '#0A0A0A',
    success: '#EDE6D6',
    danger: '#EDE6D6',
    disabled: '#5A574F',
    meterTrack: '#2A2A2A',
    overlay: 'rgba(0, 0, 0, 0.72)',
  },
};

const themesByMode: [ThemeScheme, Theme][] = [
  ['light', lightTheme],
  ['dark', darkTheme],
  ['field', fieldTheme],
  ['night', nightTheme],
];

describe('Range Card palettes', () => {
  it.each(themesByMode)(
    'gives %s the same colour keys as light',
    (_scheme, theme) => {
      expect(Object.keys(theme.colors).sort()).toEqual(
        Object.keys(lightTheme.colors).sort(),
      );
    },
  );

  it.each(themesByMode)('matches the spec hexes in %s mode', (mode, theme) => {
    expect(theme.colors).toMatchObject(SPEC[mode]);
  });

  it.each(themesByMode)('names the %s scheme on its theme', (scheme, theme) => {
    expect(theme.scheme).toBe(scheme);
  });

  it.each([
    ['field', fieldTheme],
    ['night', nightTheme],
  ] as const)('draws %s as a dark scheme', (_scheme, theme) => {
    expect(theme.mode).toBe('dark');
    expect(theme.elevation).toEqual(darkTheme.elevation);
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

      // The dark schemes outline the primary button in its own Signal.
      const expected =
        mode === 'light'
          ? ['primary', 'primaryMuted', 'warning']
          : ['primary', 'primaryBorder', 'primaryMuted', 'warning'];
      expect(orangeRoles).toEqual(expected);
    },
  );

  it.each(themesByMode)(
    'keeps the meter fill, tick and outline at 3:1 against the meter track in %s mode',
    (_mode, { colors }) => {
      // The track sits close to the card it is drawn on, so the outline is
      // what marks the meter's edge; it has to stand out from the card.
      const pairs: [string, string][] = [
        [colors.primary, colors.meterTrack],
        [colors.textPrimary, colors.meterTrack],
        [colors.outline, colors.surface],
      ];
      pairs.forEach(([fg, bg]) => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
      });
    },
  );

  it('keeps the meter track hexes out of every file but the theme', () => {
    const srcDir = path.join(__dirname, '..', 'src');
    const themeFile = path.join(srcDir, 'theme', 'theme.ts');
    const offenders = (fs.readdirSync(srcDir, { recursive: true }) as string[])
      .map(file => path.join(srcDir, file))
      .filter(file => /\.(ts|tsx)$/.test(file) && file !== themeFile)
      .filter(file =>
        // Night's track is its Rule grey too, so only Field's is guarded.
        /#(DDD5C0|35342E|313828)\b/i.test(fs.readFileSync(file, 'utf8')),
      );
    expect(offenders).toEqual([]);
  });

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
      headerCompactMin: 90,
      tabBar: 64,
      mainActionMin: 72,
      border: 2,
      rule: 1,
      touchTarget: 48,
      sheetHandleWidth: 40,
      sheetHandleHeight: 4,
      sheetActionMin: 56,
      sheetRowMin: 56,
      splitRowMin: 28,
      compareRowMin: 36,
      compareFigureColumn: 64,
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
    [
      typography.timer,
      typography.metric,
      typography.metricSmall,
      typography.metricRow,
      typography.metricCaption,
      typography.splitFigure,
    ].forEach(variant => expect(variant.fontFamily).toMatch(/^IBMPlexMono-/));
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

describe('resolveThemeScheme', () => {
  it('follows the device only for the system preference', () => {
    expect(resolveThemeScheme('system', 'dark')).toBe('dark');
    expect(resolveThemeScheme('system', null)).toBe('light');
    expect(resolveThemeScheme('light', 'dark')).toBe('light');
    expect(resolveThemeScheme('dark', 'light')).toBe('dark');
  });

  it('pins Field and Night whatever the device scheme', () => {
    expect(resolveThemeScheme('field', 'light')).toBe('field');
    expect(resolveThemeScheme('field', null)).toBe('field');
    expect(resolveThemeScheme('night', 'light')).toBe('night');
    expect(resolveThemeScheme('night', 'dark')).toBe('night');
  });
});
