import { memo, useEffect, useRef } from 'react';

import {
  AccessibilityInfo,
  findNodeHandle,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import type { Theme } from '@/theme/theme';
import type { Session } from '@/types/session';
import { useTheme, useThemedStyles } from '@hooks/useTheme';
import { formatDateTime, spokenDateTime, spokenSeconds } from '@utils/format';
import { shownDeltaSign, type RunSummary } from '@utils/history';
import { describeSavedSplits } from '@utils/splitRows';

import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { SplitsTable } from './SplitsTable';
import { Typography } from './Typography';

/** What a run stopped before its last step is marked with. */
const STOPPED_EARLY = 'Stopped early';

/** What the drill's quickest completed run is marked with. */
const PERSONAL_BEST = 'PB';

/**
 * Above this font scale the date and the total time no longer fit side by
 * side, so the total goes under the date and chips.
 */
const STACK_HEADER_ABOVE_FONT_SCALE = 1.3;

/** A true minus sign, so a difference reads as the split table's do. */
const MINUS = '−';

/**
 * How a run's total compares to the run before, in plain figures as the
 * split table shows them: `+0.06`, `−0.10`, or `0.00` for one that
 * rounds to nothing.
 */
const signedFigure = (delta: number): string => {
  const sign = shownDeltaSign(delta);
  const size = Math.abs(delta).toFixed(2);
  if (sign === 0) {
    return size;
  }
  return `${sign > 0 ? '+' : MINUS}${size}`;
};

/** A difference that reads as faster is good news, slower is bad. */
const toneOf = (delta: number): 'success' | 'danger' | 'neutral' => {
  const sign = shownDeltaSign(delta);
  if (sign === 0) {
    return 'neutral';
  }
  return sign < 0 ? 'success' : 'danger';
};

/** A length of time said to the hundredth, the figure the card shows. */
const speak = (seconds: number): string =>
  spokenSeconds(Number(Math.abs(seconds).toFixed(2)));

/** The card's header as a screen reader should say it. */
const speakRun = ({
  session,
  deltaToPrevious,
  personalBest,
}: RunSummary): string => {
  const said = [
    `Run on ${spokenDateTime(session.createdAt)}`,
    speak(session.totalTime),
  ];

  if (!session.completed) {
    said.push(STOPPED_EARLY.toLowerCase());
  }
  // Said in full: TalkBack reads "PB" as letters.
  if (personalBest) {
    said.push('personal best');
  }
  if (deltaToPrevious !== null) {
    const sign = shownDeltaSign(deltaToPrevious);
    said.push(
      sign === 0
        ? 'the same as the run before'
        : `${speak(deltaToPrevious)} ${sign < 0 ? 'faster' : 'slower'} than the run before`,
    );
  }

  return said.join(', ');
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // A minimum, so a large system font grows the row instead of clipping.
    closed: {
      minHeight: theme.sizes.runRowMin,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.inset,
      paddingVertical: theme.spacing.sm,
    },
    closedEnd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    // The one chevron glyph points right: turned down for "open me".
    chevronDown: { transform: [{ rotate: '90deg' }] },
    header: {
      paddingHorizontal: theme.spacing.inset,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: theme.sizes.rule,
      borderBottomColor: theme.colors.outline,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    headerStacked: { gap: theme.spacing.xs },
    // Beside the total, the date takes the room that is left and wraps.
    summaryInRow: { flex: 1 },
    summary: { gap: theme.spacing.xs },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    // Under the splits, which is what a comparison sets side by side.
    footer: {
      gap: theme.spacing.inset,
      paddingHorizontal: theme.spacing.inset,
      paddingVertical: theme.spacing.sm,
      borderTopWidth: theme.sizes.rule,
      borderTopColor: theme.colors.border,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    hide: { paddingHorizontal: theme.spacing.none },
    // Beside Hide splits, Compare takes the rest of the row. `minWidth: 0`
    // lets it narrow below its label, which then wraps inside the button
    // instead of running past the card.
    compareInRow: { flex: 1, minWidth: 0 },
  });

type RunSummaryLineProps = {
  run: RunSummary;
  /** Beside the total, rather than over it. */
  inRow: boolean;
};

/** When the run was made, over its marks: stopped early, PB, the delta. */
const RunSummaryLine = ({ run, inRow }: RunSummaryLineProps) => {
  const styles = useThemedStyles(createStyles);
  const { session, deltaToPrevious, personalBest } = run;
  // A run stopped early is not compared, so it has one or the other.
  const hasChips =
    !session.completed || personalBest || deltaToPrevious !== null;

  return (
    <View style={[styles.summary, inRow && styles.summaryInRow]}>
      <Typography variant="bodyStrong">
        {formatDateTime(session.createdAt)}
      </Typography>
      {hasChips ? (
        <View style={styles.chips}>
          {session.completed ? null : (
            <Chip
              label={STOPPED_EARLY}
              testID={`chip-incomplete-${session.id}`}
            />
          )}
          {personalBest ? (
            <Chip
              label={PERSONAL_BEST}
              tone="inverse"
              testID={`chip-pb-${session.id}`}
            />
          ) : null}
          {deltaToPrevious !== null ? (
            <Chip
              label={`${signedFigure(deltaToPrevious)} vs previous`}
              tone={toneOf(deltaToPrevious)}
              testID={`chip-delta-${session.id}`}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

type TotalProps = { session: Session };

/** A run's total, in plain figures as on the Timer's clock. */
const Total = ({ session }: TotalProps) => (
  <Typography variant="metric" testID={`text-run-total-${session.id}`}>
    {session.totalTime.toFixed(2)}
  </Typography>
);

type RunCardProps = {
  run: RunSummary;
  /** Whether the step breakdown is showing. */
  expanded: boolean;
  /** Show or hide the breakdown of the run with this session id. */
  onToggle: (sessionId: string) => void;
  /**
   * Start comparing the run with this session id with another run of the
   * drill. Left out when the drill has no other run, and then the card
   * offers no Compare action.
   */
  onCompare?: (sessionId: string) => void;
};

const RunCardBase = ({ run, expanded, onToggle, onCompare }: RunCardProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();
  const { fontScale } = useWindowDimensions();
  const headerStacked = fontScale > STACK_HEADER_ABOVE_FONT_SCALE;
  const { session } = run;
  const spokenWhen = spokenDateTime(session.createdAt);

  // Hide splits goes with the splits, so a screen reader's focus is moved
  // to the closed card rather than left on nothing.
  const closedRef = useRef<View>(null);
  const refocusOnClose = useRef(false);
  useEffect(() => {
    if (expanded || !refocusOnClose.current) {
      return;
    }
    refocusOnClose.current = false;
    const handle = findNodeHandle(closedRef.current);
    if (handle !== null) {
      AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [expanded]);

  const hide = () => {
    refocusOnClose.current = true;
    onToggle(session.id);
  };

  if (!expanded) {
    return (
      <Card flush testID={`card-run-${session.id}`}>
        {/* The whole row is the button: a big target for a gloved hand. */}
        <TouchableOpacity
          ref={closedRef}
          onPress={() => onToggle(session.id)}
          accessibilityRole="button"
          accessibilityLabel={speakRun(run)}
          accessibilityHint="Shows the time of each step"
          accessibilityState={{ expanded: false }}
          activeOpacity={0.75}
          style={styles.closed}
          testID={`btn-toggle-${session.id}`}
        >
          <RunSummaryLine run={run} inRow />
          <View style={styles.closedEnd}>
            <Total session={session} />
            <View style={styles.chevronDown}>
              <Icon name="chevron" size={sizes.iconSm} color="textPrimary" />
            </View>
          </View>
        </TouchableOpacity>
      </Card>
    );
  }

  return (
    <Card flush testID={`card-run-${session.id}`}>
      <View
        style={styles.header}
        accessible
        accessibilityLabel={speakRun(run)}
        testID={`header-run-${session.id}`}
      >
        <View style={headerStacked ? styles.headerStacked : styles.headerRow}>
          <RunSummaryLine run={run} inRow={!headerStacked} />
          <Total session={session} />
        </View>
      </View>

      <SplitsTable
        rows={describeSavedSplits(session.splits)}
        framed={false}
        timeColumn="actual"
        testID={`table-splits-${session.id}`}
      />

      <View style={[styles.footer, !headerStacked && styles.footerRow]}>
        <Button
          label="Hide splits"
          variant="text"
          expanded
          onPress={hide}
          // Starts with what the button says, so a voice command finds it.
          accessibilityLabel={`Hide splits, run on ${spokenWhen}`}
          style={styles.hide}
          testID={`btn-toggle-${session.id}`}
        />
        {onCompare !== undefined ? (
          <Button
            label="Compare with another run"
            variant="secondary"
            onPress={() => onCompare(session.id)}
            accessibilityLabel={`Compare the run on ${spokenWhen} with another run`}
            style={!headerStacked && styles.compareInRow}
            testID={`btn-compare-${session.id}`}
          />
        ) : null}
      </View>
    </Card>
  );
};

/**
 * One run of a drill, as a ruled card. Closed, it is one row: when the run
 * was made, its marks (stopped early, PB, how its total compares to the
 * completed run before it), the total, and a chevron; pressing the row
 * opens it. Open, the same header sits over the run's STEP / PAR / ACTUAL
 * / Δ table, the Timer's own, and a footer with Hide splits and, when the
 * drill has another run, Compare.
 *
 * Memoised because the screen lists every run of the drill and pressing
 * one card must not redraw the others.
 */
export const RunCard = memo(RunCardBase);
