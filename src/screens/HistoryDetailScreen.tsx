import { useCallback, useMemo, useRef, useState } from 'react';

import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  useNavigation,
  useRoute,
  type CompositeNavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Theme } from '@/theme/theme';
import type { LogStackParamList, MainTabParamList } from '@/types/navigation';
import { Card } from '@components/Card';
import { EmptyState } from '@components/EmptyState';
import { RefreshFailedNotice } from '@components/RefreshFailedNotice';
import { RunCard } from '@components/RunCard';
import { RunPickerSheet } from '@components/RunPickerSheet';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { StatsBox, type StatsBoxItem } from '@components/StatsBox';
import { Typography } from '@components/Typography';
import { useAnnounce } from '@hooks/useAnnounce';
import { useDrillRuns, type DrillRunsState } from '@hooks/useDrillRuns';
import { useThemedStyles } from '@hooks/useTheme';
import { pluralize, spokenSeconds } from '@utils/format';
import type { RunSummary, RunTotals } from '@utils/history';

type HistoryDetailRoute = RouteProp<LogStackParamList, 'HistoryDetail'>;
/** One drill's runs, which can also send the shooter to the Timer tab. */
type HistoryDetailNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<LogStackParamList, 'HistoryDetail'>,
  BottomTabNavigationProp<MainTabParamList>
>;

/** Stands in for a time until the runs have been read, or when there are none. */
const NO_TIME = '—';

const ERROR_TITLE = 'Could not load the runs';

/** What the list holds until the runs have been read. */
const NO_RUNS: RunSummary[] = [];

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // The list scrolls to the tab bar; its own padding ends it.
    screenContent: { paddingBottom: theme.spacing.none },
    list: { flex: 1 },
    listContent: { paddingBottom: theme.spacing.gutter },
    listHeader: { gap: theme.spacing.gutter },
    separator: { height: theme.spacing.sm },
    loading: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
    },
  });

/** A time in the stats box, in plain figures; said as a phrase. */
const statOf = (
  caption: string,
  /** The caption said as a word: `Best`, `Average`. */
  spokenCaption: string,
  seconds: number | null,
  testID: string,
): StatsBoxItem => ({
  caption,
  value: seconds === null ? NO_TIME : seconds.toFixed(2),
  spoken:
    seconds === null
      ? `No ${spokenCaption.toLowerCase()} time`
      : `${spokenCaption} ${spokenSeconds(Number(seconds.toFixed(2)))}`,
  testID,
});

type RunListHeaderProps = {
  /** `null` until the runs have been read, and when there are none. */
  totals: RunTotals | null;
  /** Reading the runs again failed, so those listed are from earlier. */
  refreshFailed: boolean;
};

/** What scrolls above the runs: the Best / Average box and the list's label. */
const RunListHeader = ({ totals, refreshFailed }: RunListHeaderProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.listHeader}>
      <StatsBox
        items={[
          statOf(
            'BEST',
            'Best',
            totals?.bestTime ?? null,
            'text-history-detail-best',
          ),
          statOf(
            'AVERAGE',
            'Average',
            totals?.averageTime ?? null,
            'text-history-detail-avg',
          ),
        ]}
      />
      {refreshFailed ? (
        <RefreshFailedNotice testID="text-history-detail-refresh-failed" />
      ) : null}
      <SectionHeader title="Runs" testID="header-history-runs" />
    </View>
  );
};

type RunListStatusProps = {
  status: DrillRunsState['status'];
  onRetry: () => void;
  onGoToTimer: () => void;
};

/** What sits under the "Runs" header when there is no run to list, and why. */
const RunListStatus = ({
  status,
  onRetry,
  onGoToTimer,
}: RunListStatusProps) => {
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
            testID="text-history-detail-loading"
          >
            Loading the runs…
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
          message="Something went wrong reading them from this device."
          actionLabel="Try again"
          onActionPress={onRetry}
          testID="state-history-detail-error"
        />
      </Card>
    );
  }

  return (
    <Card>
      <EmptyState
        mark="empty"
        title="No runs yet"
        message="Runs of this drill will show up here once you have logged some."
        actionLabel="Go to Timer"
        onActionPress={onGoToTimer}
        testID="state-history-detail-empty"
      />
    </Card>
  );
};

const RunSeparator = () => {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.separator} />;
};

const keyOfRun = (run: RunSummary): string => run.session.id;

/**
 * Every run of one drill, read from `SessionStorageService`: the best and
 * average total time, then a card per run, newest first, with when it was
 * made, its total time and how that compares to the run before it. A card
 * opens to the Step / Par / Actual / Δ breakdown of the run, and from there
 * the run can be compared with another run of the drill, picked in a sheet.
 *
 * The title bar stays put and the list scrolls under it: a drill can be
 * run any number of times, so the cards are virtualised rather than mapped
 * inside the `Screen`'s scroll view.
 */
export const HistoryDetailScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<HistoryDetailNavigation>();
  const route = useRoute<HistoryDetailRoute>();
  const { drillId, drillName } = route.params;
  const { state, reload } = useDrillRuns(drillId);

  const ready = state.status === 'ready';
  // An error takes the place of the loading line, which TalkBack does not
  // announce on its own.
  useAnnounce(state.status === 'error' ? ERROR_TITLE : null);
  const runs = ready ? state.runs : NO_RUNS;
  // The newest run starts open, so the run just made is in full view;
  // every other card starts closed.
  const newestId = runs[0]?.session.id;
  const canCompare = runs.length > 1;

  // Only the cards the shooter has pressed, by session id: `true` is open.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  // The run whose Compare was pressed last. It is kept after the picker
  // closes, so the list does not change under the sheet as it slides away.
  const [compareFrom, setCompareFrom] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Claimed by the first run picked, so a double tap opens one comparison.
  const pickedRef = useRef(false);
  // Every other run of the drill can be picked; the sheet is only up while
  // the run it compares from is still listed.
  const compareCandidates = useMemo(
    () => runs.filter(run => run.session.id !== compareFrom),
    [runs, compareFrom],
  );
  const picking = pickerOpen && compareCandidates.length < runs.length;

  const openPicker = useCallback((sessionId: string) => {
    pickedRef.current = false;
    setCompareFrom(sessionId);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  const goToTimer = useCallback(
    () => navigation.navigate('Timer'),
    [navigation],
  );

  const compareWith = useCallback(
    (otherId: string) => {
      if (pickedRef.current || compareFrom === null) {
        return;
      }
      pickedRef.current = true;
      setPickerOpen(false);
      navigation.navigate('RunComparison', {
        drillId,
        runIds: [compareFrom, otherId],
      });
    },
    [compareFrom, drillId, navigation],
  );

  const toggle = useCallback(
    (sessionId: string) =>
      setToggled(previous => ({
        ...previous,
        [sessionId]: !(previous[sessionId] ?? sessionId === newestId),
      })),
    [newestId],
  );

  const renderRun = useCallback(
    ({ item }: ListRenderItemInfo<RunSummary>) => (
      <RunCard
        run={item}
        expanded={toggled[item.session.id] ?? item.session.id === newestId}
        onToggle={toggle}
        // A run can only be compared with another run of the drill.
        onCompare={canCompare ? openPicker : undefined}
      />
    ),
    [toggled, newestId, toggle, canCompare, openPicker],
  );

  return (
    <Screen
      // The name the list passed until the drill itself has been read: it
      // may have been renamed while this screen sat behind another tab.
      title={ready ? state.drillName : drillName}
      subtitle={ready ? `${pluralize(runs.length, 'run')} logged` : 'Run log'}
      onBack={navigation.goBack}
      backLabel="Log"
      contentStyle={styles.screenContent}
      testID="screen-history-detail"
    >
      <FlatList
        data={runs}
        keyExtractor={keyOfRun}
        renderItem={renderRun}
        ListHeaderComponent={
          <RunListHeader
            totals={ready ? state.totals : null}
            refreshFailed={ready && state.refreshFailed}
          />
        }
        ListEmptyComponent={
          <RunListStatus
            status={state.status}
            onRetry={reload}
            onGoToTimer={goToTimer}
          />
        }
        ItemSeparatorComponent={RunSeparator}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        testID="list-history-detail-runs"
      />

      <RunPickerSheet
        visible={picking}
        runs={compareCandidates}
        onSelect={compareWith}
        onClose={closePicker}
      />
    </Screen>
  );
};
