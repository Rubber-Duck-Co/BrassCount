import { Fragment } from 'react';

import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useThemedStyles } from '@hooks/useTheme';

import { Typography } from './Typography';

/**
 * Above this font scale two figures no longer fit side by side, so each
 * goes under the one before.
 */
const STACK_ABOVE_FONT_SCALE = 1.3;

/** One figure in the box. */
export type StatsBoxItem = {
  /** Shown in capitals under the figure: `RUNS`, `BEST`. */
  caption: string;
  value: string;
  /** The figure as a screen reader should say it: `Best 2.64 seconds`. */
  spoken: string;
  testID?: string;
};

type StatsBoxProps = {
  items: readonly StatsBoxItem[];
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    row: { flexDirection: 'row' },
    column: { flexDirection: 'column' },
    // An even grid: `flex: 1` starts every cell from no width, so a long
    // figure never squeezes the other one.
    cell: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.inset,
    },
    dividerInRow: {
      width: theme.sizes.rule,
      backgroundColor: theme.colors.outline,
    },
    dividerInColumn: {
      height: theme.sizes.rule,
      backgroundColor: theme.colors.outline,
    },
  });

/**
 * The ruled box of figures at the top of the Log's screens: each figure in
 * Plex Mono over its caption, the cells parted by a 1px rule. Each cell is
 * read as one phrase.
 */
export const StatsBox = ({ items, testID }: StatsBoxProps) => {
  const styles = useThemedStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > STACK_ABOVE_FONT_SCALE;

  return (
    <View
      style={[styles.box, stacked ? styles.column : styles.row]}
      testID={testID}
    >
      {items.map((item, index) => (
        <Fragment key={item.caption}>
          {index > 0 ? (
            <View
              style={stacked ? styles.dividerInColumn : styles.dividerInRow}
            />
          ) : null}
          <View style={styles.cell} accessible accessibilityLabel={item.spoken}>
            <Typography variant="metric" testID={item.testID}>
              {item.value}
            </Typography>
            <Typography variant="sectionLabel" color="textSecondary">
              {item.caption}
            </Typography>
          </View>
        </Fragment>
      ))}
    </View>
  );
};
