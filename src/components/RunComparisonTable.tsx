import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { SemanticColors, Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';
import { formatSignedFigure, spokenSeconds } from '@utils/format';
import { shownDeltaSign, type StepComparison } from '@utils/history';

import { Typography } from './Typography';

/** Stands in for a time a run does not have: a step it never heard. */
const NO_VALUE = '—';

/**
 * The figures grow with the system font only this far, and their columns
 * widen with them, so every row's figures stay in line under the header.
 */
const FIGURE_MAX_FONT_MULTIPLIER = 1.2;
/** A step's name grows further, wrapping inside its column if it must. */
const LABEL_MAX_FONT_MULTIPLIER = 1.5;

const CAPTIONS = ['EARLIER', 'LATER', 'Δ'] as const;

/**
 * Slower is what to look at, in Signal; faster or the same is plain Ink.
 * The sign says which, so the colour is never the only cue.
 */
export const deltaColor = (delta: number | null): keyof SemanticColors =>
  delta !== null && shownDeltaSign(delta) > 0 ? 'warning' : 'textPrimary';

/** A length of time said to the hundredth, the figure the table shows. */
const speak = (seconds: number): string =>
  spokenSeconds(Number(Math.abs(seconds).toFixed(2)));

/**
 * How the later run did against the earlier one, as a screen reader should
 * say it: "later run 0.03 seconds faster", or "the same in both runs".
 */
export const speakDifference = (delta: number): string => {
  const sign = shownDeltaSign(delta);
  if (sign === 0) {
    return 'the same in both runs';
  }
  return `later run ${speak(delta)} ${sign < 0 ? 'faster' : 'slower'}`;
};

/** One step as a screen reader should say it. */
const speakStep = ({ label, earlier, later, delta }: StepComparison): string =>
  [
    label,
    earlier === null
      ? 'not heard in the earlier run'
      : `earlier run ${speak(earlier)}`,
    later === null ? 'not heard in the later run' : `later run ${speak(later)}`,
    ...(delta === null ? [] : [speakDifference(delta)]),
  ].join(', ');

/** A time as a plain table figure, `1.48`, or `—` when there is none. */
const figureOf = (seconds: number | null): string =>
  seconds === null ? NO_VALUE : seconds.toFixed(2);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Card fill: a slower figure is small Signal text, which only meets
    // the contrast minimum on Card.
    box: {
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    // Minimum heights, so a large system font grows a row instead of
    // clipping it.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      minHeight: theme.sizes.compareRowMin,
      paddingHorizontal: theme.spacing.inset,
      paddingVertical: theme.spacing.xxs,
    },
    header: {
      minHeight: theme.sizes.splitHeaderMin,
      borderBottomWidth: theme.sizes.rule,
      borderBottomColor: theme.colors.outline,
    },
    divided: {
      borderBottomWidth: theme.sizes.rule,
      borderBottomColor: theme.colors.border,
    },
    label: { flex: 1 },
  });

type RunComparisonTableProps = {
  steps: readonly StepComparison[];
};

/**
 * STEP / EARLIER / LATER / Δ for every step either of two runs heard, in a
 * ruled box, the figures in Plex Mono so they line up down each column.
 * Δ is the later run's time minus the earlier one's, signed so it reads
 * without its colour. Each row is read as one sentence, so the column
 * headings are hidden from a screen reader. A drill has at most
 * `MAX_DRILL_STEPS` steps, so the rows are mapped, not virtualised.
 */
export const RunComparisonTable = ({ steps }: RunComparisonTableProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();
  const { fontScale } = useWindowDimensions();
  const figureCell = {
    width:
      sizes.compareFigureColumn *
      Math.min(fontScale, FIGURE_MAX_FONT_MULTIPLIER),
  };

  return (
    <View style={styles.box} testID="table-comparison">
      <View
        style={[styles.row, styles.header]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="header-comparison-table"
      >
        <Typography
          variant="sectionLabel"
          color="textSecondary"
          maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
          style={styles.label}
        >
          STEP
        </Typography>
        {CAPTIONS.map(caption => (
          <View key={caption} style={figureCell}>
            <Typography
              variant="sectionLabel"
              color="textSecondary"
              align="right"
              maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
            >
              {caption}
            </Typography>
          </View>
        ))}
      </View>

      {steps.map((step, i) => {
        const id = `row-comparison-${step.stepId}`;
        const figures = [
          { key: 'earlier', value: figureOf(step.earlier) },
          { key: 'later', value: figureOf(step.later) },
          {
            key: 'delta',
            value:
              step.delta === null ? NO_VALUE : formatSignedFigure(step.delta),
            color: deltaColor(step.delta),
          },
        ];

        return (
          <View
            key={step.stepId}
            style={[styles.row, i < steps.length - 1 && styles.divided]}
            accessible
            accessibilityLabel={speakStep(step)}
            testID={id}
          >
            <Typography
              variant="rowLabel"
              maxFontSizeMultiplier={LABEL_MAX_FONT_MULTIPLIER}
              style={styles.label}
            >
              {step.label}
            </Typography>
            {figures.map(({ key, value, color }) => (
              <View key={key} style={figureCell}>
                <Typography
                  variant="splitFigure"
                  color={color}
                  align="right"
                  maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
                  testID={`text-comparison-${step.stepId}-${key}`}
                >
                  {value}
                </Typography>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
};
