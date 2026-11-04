import { useCallback } from 'react';

import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import type { Theme } from '@/theme/theme';
import type { Session } from '@/types/session';
import { useThemedStyles } from '@hooks/useTheme';
import { formatDateTime, spokenDateTime, spokenSeconds } from '@utils/format';
import type { RunSummary } from '@utils/history';

import { BottomSheet, SHEET_CONTENT_MAX_HEIGHT_RATIO } from './BottomSheet';
import { Chip } from './Chip';
import { Typography } from './Typography';

/** What a run stopped before its last step is marked with, as on its card. */
const STOPPED_EARLY = 'Stopped early';

/** What the drill's quickest completed run is marked with. */
const PERSONAL_BEST = 'PB';

type RunPickerSheetProps = {
  visible: boolean;
  /**
   * The run the one picked is set against, named in the line under the
   * title. Without it the line asks for another run of the drill.
   */
  from?: Session;
  /** The runs that can be picked, newest first. */
  runs: readonly RunSummary[];
  /** Called with the session id of the run picked. */
  onSelect: (sessionId: string) => void;
  /** Called when the sheet is dismissed without picking. */
  onClose: () => void;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // The runs in a ruled box on the sheet's Paper, like `OptionList`.
    box: {
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    // A minimum height, so a date that wraps at a large font grows the
    // row instead of clipping.
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.sheetRowMin,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.inset,
    },
    divider: {
      borderTopWidth: theme.sizes.rule,
      borderTopColor: theme.colors.border,
    },
    // The date and its marks take the room the total leaves, and wrap.
    summary: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
  });

/** A run as a screen reader should say it in the list. */
const speakRun = ({ session, personalBest }: RunSummary): string =>
  [
    `Run on ${spokenDateTime(session.createdAt)}`,
    spokenSeconds(Number(session.totalTime.toFixed(2))),
    ...(session.completed ? [] : [STOPPED_EARLY.toLowerCase()]),
    // Said in full: TalkBack reads "PB" as letters.
    ...(personalBest ? ['personal best'] : []),
  ].join(', ');

type RunOptionProps = {
  run: RunSummary;
  divided: boolean;
  onSelect: (sessionId: string) => void;
};

/** One run: its date and marks, then its total in plain figures. */
const RunOption = ({ run, divided, onSelect }: RunOptionProps) => {
  const styles = useThemedStyles(createStyles);
  const { session, personalBest } = run;

  return (
    <Pressable
      onPress={() => onSelect(session.id)}
      accessibilityRole="button"
      accessibilityLabel={speakRun(run)}
      accessibilityHint="Compares this run with the one you chose"
      style={[styles.option, divided && styles.divider]}
      testID={`opt-compare-${session.id}`}
    >
      <View style={styles.summary}>
        <Typography variant="bodyStrong">
          {formatDateTime(session.createdAt)}
        </Typography>
        {personalBest ? <Chip label={PERSONAL_BEST} tone="inverse" /> : null}
        {session.completed ? null : <Chip label={STOPPED_EARLY} />}
      </View>
      <Typography variant="metricRow">
        {session.totalTime.toFixed(2)}
      </Typography>
    </Pressable>
  );
};

const keyOfRun = (run: RunSummary): string => run.session.id;

/**
 * Bottom sheet that picks the run to compare another run of the same drill
 * with, on the Range Card sheet frame: a line naming the run it compares
 * from, then the runs in a ruled box. Picking one calls `onSelect`;
 * closing the sheet is left to the caller, through `visible`. A drill can
 * be run any number of times, so the runs are a list that scrolls inside
 * the sheet.
 */
export const RunPickerSheet = ({
  visible,
  from,
  runs,
  onSelect,
  onClose,
}: RunPickerSheetProps) => {
  const styles = useThemedStyles(createStyles);
  const { height } = useWindowDimensions();

  const renderRun = useCallback(
    ({ item, index }: ListRenderItemInfo<RunSummary>) => (
      <RunOption run={item} divided={index > 0} onSelect={onSelect} />
    ),
    [onSelect],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Compare with"
      closeLabel="Close run picker"
      backdropTestID="btn-compare-backdrop"
      closeTestID="btn-compare-close"
      testID="sheet-compare"
    >
      <Typography
        variant="body"
        color="textSecondary"
        testID="text-compare-from"
      >
        {from === undefined
          ? 'Pick another run of this drill.'
          : `Pick a run to set against the run on ${formatDateTime(from.createdAt)}.`}
      </Typography>

      <FlatList
        data={runs}
        keyExtractor={keyOfRun}
        renderItem={renderRun}
        style={[
          styles.box,
          { maxHeight: height * SHEET_CONTENT_MAX_HEIGHT_RATIO },
        ]}
        testID="list-compare-runs"
      />
    </BottomSheet>
  );
};
