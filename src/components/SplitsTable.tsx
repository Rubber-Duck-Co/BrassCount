import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Sizes, Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';
import type { SplitDeltaTone, SplitRow } from '@utils/splitRows';

import { Typography } from './Typography';

/**
 * The figures grow with the system font only this far, and their columns
 * widen with them, so every row's figures stay in line under the header.
 */
const FIGURE_MAX_FONT_MULTIPLIER = 1.2;
/** A step's name grows further, wrapping inside its column if it must. */
const LABEL_MAX_FONT_MULTIPLIER = 1.5;

const DELTA_COLOR = {
  figure: 'textPrimary',
  over: 'warning',
  note: 'textSecondary',
} as const satisfies Record<SplitDeltaTone, string>;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Card fill: an over-par figure is small Signal text, which only meets
    // the contrast minimum on Card.
    box: {
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      minHeight: theme.sizes.splitRowMin,
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

/** What the time column is headed, and the width that caption needs. */
const TIME_COLUMNS = {
  time: { caption: 'TIME', size: 'splitFigureColumn' },
  actual: { caption: 'ACTUAL', size: 'splitActualColumn' },
} as const satisfies Record<string, { caption: string; size: keyof Sizes }>;

type TimeColumn = keyof typeof TIME_COLUMNS;

type SplitsTableProps = {
  rows: readonly SplitRow[];
  /**
   * Draw the table's own ruled box. Off when it sits inside a box that
   * already draws one, such as a run card in the Log.
   */
  framed?: boolean;
  /**
   * The time column: `time` on the Timer, `actual` in the Log, whose
   * longer caption takes a wider column.
   */
  timeColumn?: TimeColumn;
  /** Defaults to `table-splits`; give each table its own in a list. */
  testID?: string;
};

/**
 * A run's splits: a ruled table of STEP / PAR / TIME / Δ, one row per
 * step of the drill, the figures in Plex Mono. The Timer shows the run
 * being made, and each run card in the Log a saved one. Each row is read
 * as one sentence, so the column headings are hidden from a screen reader.
 */
export const SplitsTable = ({
  rows,
  framed = true,
  timeColumn = 'time',
  testID = 'table-splits',
}: SplitsTableProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(fontScale, FIGURE_MAX_FONT_MULTIPLIER);
  const figureCell = { width: sizes.splitFigureColumn * scale };
  const { caption: timeCaption, size: timeSize } = TIME_COLUMNS[timeColumn];
  const timeCell = { width: sizes[timeSize] * scale };
  const deltaCell = { width: sizes.splitDeltaColumn * scale };

  return (
    <View style={framed ? styles.box : undefined} testID={testID}>
      <View
        style={[styles.row, styles.header]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="row-splits-header"
      >
        <Typography
          variant="sectionLabel"
          color="textSecondary"
          maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
          style={styles.label}
        >
          STEP
        </Typography>
        <View style={figureCell}>
          <Typography
            variant="sectionLabel"
            color="textSecondary"
            align="right"
            maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
          >
            PAR
          </Typography>
        </View>
        <View style={timeCell}>
          <Typography
            variant="sectionLabel"
            color="textSecondary"
            align="right"
            maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
          >
            {timeCaption}
          </Typography>
        </View>
        <View style={deltaCell}>
          <Typography
            variant="sectionLabel"
            color="textSecondary"
            align="right"
            maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
          >
            Δ
          </Typography>
        </View>
      </View>

      {rows.map((row, i) => {
        const id = `row-split-${i}`;
        return (
          <View
            key={row.stepId}
            style={[styles.row, i < rows.length - 1 && styles.divided]}
            accessible
            accessibilityLabel={row.spoken}
            testID={id}
          >
            <Typography
              variant="rowLabel"
              maxFontSizeMultiplier={LABEL_MAX_FONT_MULTIPLIER}
              style={styles.label}
              testID={`${id}-label`}
            >
              {row.label}
            </Typography>
            <View style={figureCell}>
              <Typography
                variant="splitFigure"
                align="right"
                maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
                testID={`${id}-par`}
              >
                {row.par}
              </Typography>
            </View>
            <View style={timeCell}>
              <Typography
                variant="splitFigure"
                align="right"
                maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
                testID={`${id}-time`}
              >
                {row.time}
              </Typography>
            </View>
            <View style={deltaCell}>
              <Typography
                variant={
                  row.deltaTone === 'note' ? 'metricCaption' : 'splitFigure'
                }
                color={DELTA_COLOR[row.deltaTone]}
                align="right"
                maxFontSizeMultiplier={FIGURE_MAX_FONT_MULTIPLIER}
                testID={`${id}-delta`}
              >
                {row.delta}
              </Typography>
            </View>
          </View>
        );
      })}
    </View>
  );
};
