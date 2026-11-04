import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';

import type { Theme } from '@/theme/theme';
import type { LogStackParamList } from '@/types/navigation';
import type { Session } from '@/types/session';
import { Card } from '@components/Card';
import { Chip } from '@components/Chip';
import { EmptyState } from '@components/EmptyState';
import {
  RunComparisonTable,
  speakDifference,
} from '@components/RunComparisonTable';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { Typography } from '@components/Typography';
import {
  useRunComparison,
  type RunComparisonState,
} from '@hooks/useRunComparison';
import { useThemedStyles } from '@hooks/useTheme';
import {
  formatDateTime,
  formatSeconds,
  spokenDateTime,
  spokenSeconds,
} from '@utils/format';
import { shownDeltaSign, type RunComparison } from '@utils/history';

type RunComparisonRoute = RouteProp<LogStackParamList, 'RunComparison'>;

/** What a run stopped before its last step is marked with, as on its card. */
const STOPPED_EARLY = 'Stopped early';

/** What the drill's quickest completed run is marked with. */
const PERSONAL_BEST = 'PB';

/** The subtitle and back link until the drill's name is known. */
const NO_DRILL_NAME = 'Runs';

/**
 * Above this font scale two runs no longer fit side by side, so the later
 * one goes under the earlier one. The point the totals box stacks at.
 */
const STACK_RUNS_ABOVE_FONT_SCALE = 1.3;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    runs: { flexDirection: 'row' },
    run: {
      flex: 1,
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.inset,
      paddingVertical: theme.spacing.inset,
    },
    // The 1px Ink rule between the two runs, and under them.
    runRuled: {
      borderRightWidth: theme.sizes.rule,
      borderRightColor: theme.colors.outline,
    },
    runRuledStacked: {
      borderBottomWidth: theme.sizes.rule,
      borderBottomColor: theme.colors.outline,
    },
    // As tall as the PB badge whether it shows or not, so the two runs'
    // dates and totals stay level with each other.
    caption: {
      minHeight: theme.sizes.badge,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    chip: { marginTop: theme.spacing.xs },
    difference: {
      paddingHorizontal: theme.spacing.inset,
      paddingVertical: theme.spacing.inset,
      borderTopWidth: theme.sizes.rule,
      borderTopColor: theme.colors.outline,
    },
    key: { marginTop: theme.spacing.sm },
    loading: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
    },
  });

type RunColumnProps = {
  /** `EARLIER` or `LATER`. */
  caption: string;
  session: Session;
  personalBest: boolean;
  /** Draw the rule that parts this run from the one after it. */
  ruled: boolean;
  stacked: boolean;
  testID: string;
};

/** One of the two runs: its caption and PB mark, when it was made, its total. */
const RunColumn = ({
  caption,
  session,
  personalBest,
  ruled,
  stacked,
  testID,
}: RunColumnProps) => {
  const styles = useThemedStyles(createStyles);
  const said = [
    `${caption.toLowerCase()} run, ${spokenDateTime(session.createdAt)}`,
    spokenSeconds(Number(session.totalTime.toFixed(2))),
    ...(session.completed ? [] : [STOPPED_EARLY.toLowerCase()]),
    // Said in full: TalkBack reads "PB" as letters.
    ...(personalBest ? ['personal best'] : []),
  ];

  return (
    <View
      style={[
        styles.run,
        ruled && (stacked ? styles.runRuledStacked : styles.runRuled),
      ]}
      accessible
      accessibilityLabel={said.join(', ')}
      testID={testID}
    >
      <View style={styles.caption}>
        <Typography variant="sectionLabel" color="textSecondary">
          {caption}
        </Typography>
        {personalBest ? (
          <Chip label={PERSONAL_BEST} tone="inverse" testID={`${testID}-pb`} />
        ) : null}
      </View>
      <Typography variant="bodyStrong">
        {formatDateTime(session.createdAt)}
      </Typography>
      <Typography variant="metric" testID={`${testID}-total`}>
        {session.totalTime.toFixed(2)}
      </Typography>
      {session.completed ? null : (
        <View style={styles.chip}>
          <Chip label={STOPPED_EARLY} testID={`${testID}-incomplete`} />
        </View>
      )}
    </View>
  );
};

/** How the totals compare, in words: "0.08s faster than the earlier run". */
const describeTotal = (totalDelta: number | null): string => {
  if (totalDelta === null) {
    return 'Total times are not compared: a run stopped early has no time for the whole drill.';
  }
  const sign = shownDeltaSign(totalDelta);
  if (sign === 0) {
    return 'The same time as the earlier run';
  }
  const shown = formatSeconds(Math.abs(totalDelta));
  return `${shown} ${sign < 0 ? 'faster' : 'slower'} than the earlier run`;
};

type TotalsCardProps = {
  comparison: RunComparison;
  personalBestId: string | null;
};

/** Both runs side by side, and how the later one's total compares. */
const TotalsCard = ({ comparison, personalBestId }: TotalsCardProps) => {
  const styles = useThemedStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > STACK_RUNS_ABOVE_FONT_SCALE;
  const { earlier, later, totalDelta } = comparison;

  return (
    <Card flush testID="card-comparison-totals">
      <View style={stacked ? undefined : styles.runs}>
        <RunColumn
          caption="EARLIER"
          session={earlier}
          personalBest={earlier.id === personalBestId}
          ruled
          stacked={stacked}
          testID="run-earlier"
        />
        <RunColumn
          caption="LATER"
          session={later}
          personalBest={later.id === personalBestId}
          ruled={false}
          stacked={stacked}
          testID="run-later"
        />
      </View>

      <View
        style={styles.difference}
        accessible
        accessibilityLabel={
          totalDelta === null
            ? describeTotal(null)
            : `Total time: ${speakDifference(totalDelta)}`
        }
        testID="comparison-difference"
      >
        <Typography variant="bodyStrong">
          {describeTotal(totalDelta)}
        </Typography>
      </View>
    </Card>
  );
};

type ComparisonStatusProps = {
  status: Exclude<RunComparisonState['status'], 'ready'>;
  onRetry: () => void;
  onBackToRuns: () => void;
};

/** What the screen shows when there is no comparison to draw, and why. */
const ComparisonStatus = ({
  status,
  onRetry,
  onBackToRuns,
}: ComparisonStatusProps) => {
  const styles = useThemedStyles(createStyles);

  if (status === 'loading') {
    return (
      <Card>
        <View style={styles.loading}>
          <Typography
            variant="body"
            color="textSecondary"
            testID="text-comparison-loading"
          >
            Loading the runs…
          </Typography>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      {/* Announced: it takes the place of the loading line on its own. */}
      <View accessibilityLiveRegion="polite">
        {status === 'error' ? (
          <EmptyState
            mark="error"
            title="Could not load the runs"
            message="Something went wrong reading them from this device."
            actionLabel="Try again"
            onActionPress={onRetry}
            testID="state-comparison-error"
          />
        ) : (
          <EmptyState
            mark="empty"
            title="These runs are not here"
            message="One of the runs could not be found for this drill."
            actionLabel="Back to runs"
            onActionPress={onBackToRuns}
            testID="state-comparison-missing"
          />
        )}
      </View>
    </Card>
  );
};

/**
 * Two runs of one drill side by side: each run's date, total time and
 * marks, how the totals compare, and every step with the time it took in
 * each run and how the later run did against the earlier one.
 *
 * Opened from Compare on a run card in the drill's runs, with the ids of
 * the two runs; it reads them itself, so what is shown is always what is
 * stored. When either run is gone it says so, with a way back to the runs.
 */
export const RunComparisonScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute<RunComparisonRoute>();
  const {
    drillId,
    runIds: [firstRunId, secondRunId],
    drillName,
  } = route.params;
  const { state, reload } = useRunComparison(drillId, firstRunId, secondRunId);
  // The name passed in until the drill itself has been read: it may have
  // been renamed while this screen sat behind another tab.
  const shownName =
    state.status === 'ready' ? state.drillName : (drillName ?? NO_DRILL_NAME);

  return (
    <Screen
      title="Compare runs"
      subtitle={shownName}
      onBack={navigation.goBack}
      backLabel={shownName}
      scrollable
      testID="screen-run-comparison"
    >
      {state.status === 'ready' ? (
        <>
          <TotalsCard
            comparison={state.comparison}
            personalBestId={state.personalBestId}
          />
          <View>
            <SectionHeader title="Steps" />
            <RunComparisonTable steps={state.comparison.steps} />
            {/* The sign on each figure says the same to a screen reader. */}
            <Typography
              variant="label"
              color="textSecondary"
              style={styles.key}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              Orange: slower than the earlier run.
            </Typography>
          </View>
        </>
      ) : (
        <ComparisonStatus
          status={state.status}
          onRetry={reload}
          onBackToRuns={navigation.goBack}
        />
      )}
    </Screen>
  );
};
