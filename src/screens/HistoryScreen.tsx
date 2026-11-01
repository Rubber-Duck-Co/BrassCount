import { useCallback } from 'react';

import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  useNavigation,
  type CompositeNavigationProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Theme } from '@/theme/theme';
import type { LogStackParamList, MainTabParamList } from '@/types/navigation';
import { Card } from '@components/Card';
import { EmptyState } from '@components/EmptyState';
import { Icon } from '@components/Icon';
import { RefreshFailedNotice } from '@components/RefreshFailedNotice';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { StatsBox } from '@components/StatsBox';
import { Typography } from '@components/Typography';
import { useAnnounce } from '@hooks/useAnnounce';
import {
  useDrillHistory,
  type DrillHistoryState,
} from '@hooks/useDrillHistory';
import { useTheme, useThemedStyles } from '@hooks/useTheme';
import {
  formatSeconds,
  formatTimeAgo,
  pluralize,
  spokenSeconds,
  spokenTimeAgo,
} from '@utils/format';
import type { DrillHistorySummary } from '@utils/history';

/** The Log tab's list, which also sends the shooter to the Timer tab. */
type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<LogStackParamList, 'HistoryList'>,
  BottomTabNavigationProp<MainTabParamList>
>;

/** Stands in for a counter until the history has been read. */
const NO_COUNT = '—';

const ERROR_TITLE = 'Could not load your log';

/** What the list holds until the history has been read. */
const NO_SUMMARIES: DrillHistorySummary[] = [];

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // The list scrolls to the tab bar; its own padding ends it.
    screenContent: { paddingBottom: theme.spacing.none },
    list: { flex: 1 },
    listContent: { paddingBottom: theme.spacing.gutter },
    listHeader: { gap: theme.spacing.gutter },
    // The rows draw the ruled box between them: Ink down both sides, a 2px
    // rule above the first and below the last, 1px Rule lines between.
    rowFrame: {
      backgroundColor: theme.colors.surface,
      borderLeftWidth: theme.sizes.border,
      borderRightWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
    },
    firstRow: { borderTopWidth: theme.sizes.border },
    lastRow: { borderBottomWidth: theme.sizes.border },
    dividedRow: {
      borderBottomWidth: theme.sizes.rule,
      borderBottomColor: theme.colors.border,
    },
    // A minimum, so a large system font grows the row instead of clipping.
    row: {
      minHeight: theme.sizes.drillRowMin,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.inset,
      paddingHorizontal: theme.spacing.inset,
      paddingVertical: theme.spacing.sm,
    },
    rowBody: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    // Capitals from the style, so a screen reader reads the name as words.
    name: { textTransform: 'uppercase' },
    loading: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
    },
  });

/**
 * The line under a drill's name: `3 runs · Best 4.21s · 2d ago`. A drill
 * whose every run was stopped early has no best, so it is left out.
 */
const describeSummary = (summary: DrillHistorySummary, now: number): string =>
  [
    pluralize(summary.runCount, 'run'),
    summary.bestTime === null
      ? null
      : `Best ${formatSeconds(summary.bestTime)}`,
    formatTimeAgo(summary.lastRunAt, now),
  ]
    .filter(part => part !== null)
    .join(' · ');

/**
 * The whole row as a screen reader should say it. The best time is said
 * to the hundredth, the same figure the row shows.
 */
const speakSummary = (summary: DrillHistorySummary, now: number): string =>
  [
    summary.drillName,
    pluralize(summary.runCount, 'run'),
    summary.bestTime === null
      ? null
      : `best ${spokenSeconds(Number(summary.bestTime.toFixed(2)))}`,
    `last run ${spokenTimeAgo(summary.lastRunAt, now)}`,
  ]
    .filter(part => part !== null)
    .join(', ');

/** A counter in the stats box, said as a phrase ("3 runs"). */
const counter = (count: number | null, noun: string, testID: string) => ({
  caption: `${noun}s`.toUpperCase(),
  value: count === null ? NO_COUNT : String(count),
  spoken: count === null ? `${noun}s not loaded` : pluralize(count, noun),
  testID,
});

type LogDrillRowProps = {
  summary: DrillHistorySummary;
  /** The one clock reading the whole list is aged against. */
  now: number;
  /** Where the row sits in the ruled box, which it draws its part of. */
  first: boolean;
  last: boolean;
  onOpen: (summary: DrillHistorySummary) => void;
};

/** One drill that has been run: tap to see its runs. */
const LogDrillRow = ({
  summary,
  now,
  first,
  last,
  onOpen,
}: LogDrillRowProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();

  return (
    <View
      style={[
        styles.rowFrame,
        first && styles.firstRow,
        last ? styles.lastRow : styles.dividedRow,
      ]}
    >
      <TouchableOpacity
        onPress={() => onOpen(summary)}
        accessibilityRole="button"
        accessibilityLabel={speakSummary(summary, now)}
        activeOpacity={0.7}
        style={styles.row}
        testID={`row-history-${summary.drillId}`}
      >
        <View style={styles.rowBody}>
          <Typography
            variant="stencilSmall"
            // A drill that is gone is greyed: its runs are kept, not it.
            color={summary.deleted ? 'textSecondary' : 'textPrimary'}
            numberOfLines={2}
            style={styles.name}
            testID={`text-history-name-${summary.drillId}`}
          >
            {summary.drillName}
          </Typography>
          <Typography variant="metricCaption" color="textSecondary">
            {describeSummary(summary, now)}
          </Typography>
        </View>
        <Icon name="chevron" size={sizes.iconSm} color="textPrimary" />
      </TouchableOpacity>
    </View>
  );
};

type HistoryStatusProps = {
  /** Why there is no drill to list. */
  status: 'loading' | 'error' | 'empty';
  onRetry: () => void;
  onGoToTimer: () => void;
};

/** What sits under the "Drills" label when there is no drill to list. */
const HistoryStatus = ({
  status,
  onRetry,
  onGoToTimer,
}: HistoryStatusProps) => {
  const styles = useThemedStyles(createStyles);

  if (status === 'loading') {
    return (
      <Card>
        <View style={styles.loading}>
          <Typography
            variant="body"
            color="textSecondary"
            // Spoken when "Try again" swaps the error for this line.
            accessibilityLiveRegion="polite"
            testID="text-history-loading"
          >
            Loading your log…
          </Typography>
        </View>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card>
        <EmptyState
          mark="error"
          title={ERROR_TITLE}
          message="Something went wrong reading it from this device."
          actionLabel="Try again"
          onActionPress={onRetry}
          testID="state-history-error"
        />
      </Card>
    );
  }

  return (
    <Card>
      <EmptyState
        mark="empty"
        title="Nothing here yet"
        message="Run a drill from the timer and it will appear here."
        actionLabel="Go to Timer"
        onActionPress={onGoToTimer}
        testID="state-history-empty"
      />
    </Card>
  );
};

const keyOfSummary = (summary: DrillHistorySummary): string => summary.drillId;

/**
 * The Log tab: every drill that has been run, read from
 * `SessionStorageService` and grouped by drill, in one ruled box: how many
 * runs, the best time and how long ago the last one was, most recently run
 * first. Above the list, the number of runs and of drills they were made
 * against. With nothing logged yet, it sends the shooter to the Timer.
 *
 * A drill that has never been run is not listed. Runs whose drill no longer
 * exists (deleting a drill deletes its runs, but older versions left them)
 * are still listed, greyed, under a stand-in name.
 */
export const HistoryScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<Nav>();
  const { state, reload } = useDrillHistory();

  const ready = state.status === 'ready';
  const summaries = ready ? state.summaries : NO_SUMMARIES;

  // An error takes the place of the loading line, which TalkBack does not
  // announce on its own.
  useAnnounce(state.status === 'error' ? ERROR_TITLE : null);

  // One reading of the clock for the whole list, so two drills run at the
  // same moment never show different ages.
  const now = Date.now();

  const openDrill = useCallback(
    (summary: DrillHistorySummary) =>
      navigation.navigate('HistoryDetail', {
        drillId: summary.drillId,
        drillName: summary.drillName,
      }),
    [navigation],
  );

  const goToTimer = useCallback(
    () => navigation.navigate('Timer'),
    [navigation],
  );

  const lastIndex = summaries.length - 1;
  const renderDrill = useCallback(
    ({ item, index }: ListRenderItemInfo<DrillHistorySummary>) => (
      <LogDrillRow
        summary={item}
        now={now}
        first={index === 0}
        last={index === lastIndex}
        onOpen={openDrill}
      />
    ),
    [now, lastIndex, openDrill],
  );

  return (
    <Screen
      title="Log"
      subtitle="Pick a drill to see previous runs"
      contentStyle={styles.screenContent}
      testID="screen-history"
    >
      <FlatList
        data={summaries}
        keyExtractor={keyOfSummary}
        renderItem={renderDrill}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <StatsBox
              items={[
                counter(
                  ready ? state.runCount : null,
                  'run',
                  'text-history-run-count',
                ),
                counter(
                  ready ? summaries.length : null,
                  'drill',
                  'text-history-drill-count',
                ),
              ]}
            />
            {ready && state.refreshFailed ? (
              <RefreshFailedNotice testID="text-history-refresh-failed" />
            ) : null}
            <SectionHeader title="Drills" testID="header-history-drills" />
          </View>
        }
        ListEmptyComponent={
          <HistoryStatus
            status={state.status === 'ready' ? 'empty' : state.status}
            onRetry={reload}
            onGoToTimer={goToTimer}
          />
        }
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        testID="list-history"
      />
    </Screen>
  );
};
