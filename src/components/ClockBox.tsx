import { useEffect, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useThemedStyles } from '@hooks/useTheme';
import { formatElapsed } from '@utils/format';
import { shownDeltaSign } from '@utils/history';

import { Typography } from './Typography';

/** How often the running clock is redrawn. */
const CLOCK_TICK_MS = 50;

/**
 * The clock is already 88dp: it grows with the system font only this far,
 * then shrinks to fit the box rather than clipping a long time.
 */
const CLOCK_MAX_FONT_MULTIPLIER = 1.2;
const CLOCK_MIN_FONT_SCALE = 0.5;

type ClockBoxProps = {
  running: boolean;
  /** The run's time once it has ended. `null` while there is none. */
  finalSeconds: number | null;
  /** The drill's total par. `null` when a step is untimed. */
  parSeconds: number | null;
  readElapsed: () => number;
  /** The line at the top right: the shots and par, or the step heard next. */
  meta: string;
  /** Under the figure, unless the run is over par. */
  caption: string;
  /** Grey the figure: the run has not begun, as while waiting for the beep. */
  dimmed?: boolean;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Card fill, not Paper: the over-par caption is small Signal text, which
    // only meets the contrast minimum on Card.
    box: {
      minHeight: theme.sizes.clockBoxMin,
      paddingBottom: theme.spacing.inset,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    // The Ink tab sits over the box's top-left corner, on its outline.
    tab: {
      marginLeft: -theme.sizes.border,
      marginTop: -theme.sizes.border,
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.inverse,
    },
    meta: {
      flexShrink: 1,
      paddingTop: theme.spacing.xs,
      paddingRight: theme.spacing.inset,
    },
    readout: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
    },
    figure: { alignSelf: 'stretch' },
  });

/**
 * The Timer's clock: a ruled box with its figure, a caption under it and
 * the run's progress at the top right. It owns the tick, so the clock
 * redraws many times a second without the rest of the screen redrawing
 * with it: the JS thread is left free for the microphone readings.
 *
 * Over par, judged as the time reads to the hundredth like the splits, the
 * figure and caption turn Signal (`warning`) and the caption reads OVER PAR.
 */
export const ClockBox = ({
  running,
  finalSeconds,
  parSeconds,
  readElapsed,
  meta,
  caption,
  dimmed = false,
}: ClockBoxProps) => {
  const styles = useThemedStyles(createStyles);
  const [ticked, setTicked] = useState(0);

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => setTicked(readElapsed()), CLOCK_TICK_MS);
    return () => {
      clearInterval(id);
      // The next run starts from zero, not from where this one got to.
      setTicked(0);
    };
  }, [running, readElapsed]);

  const elapsed = finalSeconds ?? (running ? ticked : 0);
  // A run shown as 2.50 against a par of 2.50 is not over it.
  const overPar =
    parSeconds !== null && shownDeltaSign(elapsed - parSeconds) > 0;

  return (
    <View style={styles.box} testID="box-clock">
      <View style={styles.topRow}>
        <View style={styles.tab}>
          <Typography variant="sectionLabel" color="textOnInverse">
            TIME
          </Typography>
        </View>
        <Typography
          variant="metricCaption"
          color="textSecondary"
          align="right"
          style={styles.meta}
          testID="text-clock-meta"
        >
          {meta}
        </Typography>
      </View>

      <View style={styles.readout}>
        <Typography
          variant="timer"
          color={overPar ? 'warning' : dimmed ? 'disabled' : 'textPrimary'}
          align="center"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={CLOCK_MIN_FONT_SCALE}
          maxFontSizeMultiplier={CLOCK_MAX_FONT_MULTIPLIER}
          style={styles.figure}
          testID="text-elapsed"
        >
          {formatElapsed(elapsed)}
        </Typography>

        <Typography
          variant="sectionLabel"
          color={overPar ? 'warning' : 'textSecondary'}
          align="center"
          testID="text-elapsed-caption"
        >
          {overPar ? 'OVER PAR' : caption}
        </Typography>
      </View>
    </View>
  );
};
