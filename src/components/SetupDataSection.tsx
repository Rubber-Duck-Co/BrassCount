import { useCallback, useRef, useState } from 'react';

import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import {
  useRunHistoryClear,
  type RunCountState,
} from '@hooks/useRunHistoryClear';
import { useThemedStyles } from '@hooks/useTheme';
import { APP_VERSION } from '@utils/appInfo';
import { pluralize } from '@utils/format';

import { Card } from './Card';
import { ConfirmSheet } from './ConfirmSheet';
import { ListRow } from './ListRow';
import { SectionHeader } from './SectionHeader';
import { Typography } from './Typography';

const ROW_TITLE = 'Clear run history';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Lines up with the ListRow above it, under its Rule line.
    note: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.inset,
    },
  });

/** What the row shows at its right: none when the runs can't be counted. */
const runCountValue = (runCount: RunCountState): string | undefined => {
  switch (runCount.status) {
    case 'loading':
      return '…';
    case 'unknown':
      return undefined;
    case 'ready':
      return runCount.runCount === 0
        ? 'No runs'
        : pluralize(runCount.runCount, 'run');
  }
};

/** The row as a screen reader says it. */
const runCountSpoken = (runCount: RunCountState): string => {
  switch (runCount.status) {
    case 'loading':
      return `${ROW_TITLE}, counting saved runs`;
    case 'unknown':
      return ROW_TITLE;
    case 'ready':
      return runCount.runCount === 0
        ? `${ROW_TITLE}, no saved runs`
        : `${ROW_TITLE}, ${pluralize(runCount.runCount, 'saved run')}`;
  }
};

type SetupDataSectionProps = {
  /** Called once the runs are deleted, so other counts can catch up. */
  onCleared: () => void;
};

/**
 * The Data section: Clear run history, then where the shooter's data
 * lives and the app version. Clearing deletes every saved run after a
 * confirmation that names how many, and keeps drills and the profile.
 * The row is disabled while the runs are counted and when there are none;
 * if they cannot be counted, clearing is still offered.
 */
export const SetupDataSection = ({ onCleared }: SetupDataSectionProps) => {
  const styles = useThemedStyles(createStyles);
  const { runCount, clearRuns } = useRunHistoryClear();
  const [confirming, setConfirming] = useState(false);
  // How many runs the sheet asks about, fixed when it opens so the title
  // does not change under the reader, or while the sheet slides away.
  const [askedCount, setAskedCount] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);
  // A second press of the confirm button lands before `clearing` has
  // rendered, so the guard is a ref.
  const clearingRef = useRef(false);

  const clearUnavailable =
    runCount.status === 'loading' ||
    (runCount.status === 'ready' && runCount.runCount === 0);
  const knownCount = runCount.status === 'ready' ? runCount.runCount : null;

  const requestClear = useCallback(() => {
    setClearFailed(false);
    setAskedCount(knownCount);
    setConfirming(true);
  }, [knownCount]);

  const cancelClear = useCallback(() => {
    if (clearingRef.current) {
      return;
    }
    setConfirming(false);
    setClearFailed(false);
  }, []);

  const confirmClear = async () => {
    if (clearingRef.current) {
      return;
    }
    clearingRef.current = true;
    setClearing(true);
    setClearFailed(false);

    // `clearRuns` settles a failure into `false`, so this never rejects.
    const cleared = await clearRuns();

    clearingRef.current = false;
    setClearing(false);
    if (!cleared) {
      // The sheet stays up with the reason; nothing is reported deleted.
      setClearFailed(true);
      return;
    }
    // The sheet, and the reader's focus with it, is gone: say what happened.
    AccessibilityInfo.announceForAccessibility(
      askedCount === null
        ? 'Deleted every saved run'
        : `Deleted ${pluralize(askedCount, 'run')}`,
    );
    setConfirming(false);
    onCleared();
  };

  return (
    <View>
      <SectionHeader title="Data" />
      <Card flush>
        <ListRow
          title={ROW_TITLE}
          value={runCountValue(runCount)}
          accessibilityLabel={runCountSpoken(runCount)}
          onPress={requestClear}
          disabled={clearUnavailable}
          destructive
          // Hidden with the row disabled, like any ListRow's chevron.
          chevron={!clearUnavailable}
          divided
          testID="row-clear-history"
        />
        <View style={styles.note}>
          <Typography variant="label" color="textSecondary" testID="text-about">
            {`Version ${APP_VERSION}. Everything is stored only on this phone. There is no account, and nothing is sent anywhere.`}
          </Typography>
        </View>
      </Card>
      <ConfirmSheet
        visible={confirming}
        title={
          askedCount === null
            ? 'Delete every saved run?'
            : `Delete ${pluralize(askedCount, 'run')}?`
        }
        message="Every saved run is removed from this phone. Your drills and profile are kept. This cannot be undone."
        confirmLabel="Delete runs"
        busyLabel="Deleting…"
        busy={clearing}
        error={
          clearFailed
            ? 'Could not delete your runs. They are still saved. Try again.'
            : undefined
        }
        onConfirm={confirmClear}
        onCancel={cancelClear}
        testID="sheet-clear-history"
      />
    </View>
  );
};
