import { useCallback, useRef, useState } from 'react';

import {
  AccessibilityInfo,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  type AccessibilityActionEvent,
  type ListRenderItemInfo,
} from 'react-native';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  useFocusEffect,
  useNavigation,
  type CompositeNavigationProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Theme } from '@/theme/theme';
import type { Drill } from '@/types/drill';
import type {
  DrillsStackParamList,
  MainTabParamList,
} from '@/types/navigation';
import { Button } from '@components/Button';
import { Card } from '@components/Card';
import { ConfirmSheet } from '@components/ConfirmSheet';
import { EmptyState } from '@components/EmptyState';
import { RefreshFailedNotice } from '@components/RefreshFailedNotice';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { SwipeableRow } from '@components/SwipeableRow';
import { Typography } from '@components/Typography';
import { useAnnounce } from '@hooks/useAnnounce';
import { useDrills } from '@hooks/useDrills';
import { useThemedStyles } from '@hooks/useTheme';
import { describeDrill } from '@utils/drill';

/** The Drills tab's list, which also loads a drill onto the Timer tab. */
type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<DrillsStackParamList, 'DrillList'>,
  BottomTabNavigationProp<MainTabParamList>
>;

const ERROR_TITLE = 'Could not load your drills';

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
    // Inside the rules, so a row swiped open slides under them, not over.
    rowClip: { overflow: 'hidden' },
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
      minHeight: theme.sizes.touchTarget,
      justifyContent: 'center',
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
 * A swipe is out of a screen reader's reach, so deleting is also offered
 * as an action on the row itself.
 */
const DELETE_ACTION = 'delete';
const DRILL_ROW_ACTIONS = [
  { name: DELETE_ACTION, label: 'Delete drill' },
] as const;

type DrillRowHandlers = {
  /** Open the editor on the saved drill with this id. */
  onEdit: (id: string) => void;
  /** Put the drill with this id on the Timer. */
  onLoad: (id: string) => void;
  /** A swipe left the row with this id open, or closed. */
  onOpenChange: (id: string, open: boolean) => void;
  /** Ask whether this drill should be deleted. */
  onRequestDelete: (drill: Drill) => void;
};

type DrillRowProps = DrillRowHandlers & {
  drill: Drill;
  /** Whether the row is swiped open, showing its Delete action. */
  open: boolean;
  /** Where the row sits in the ruled box, which it draws its part of. */
  first: boolean;
  last: boolean;
};

/** One saved drill: tap to edit, Load to time it, swipe left for Delete. */
const DrillRow = ({
  drill,
  open,
  first,
  last,
  onEdit,
  onLoad,
  onOpenChange,
  onRequestDelete,
}: DrillRowProps) => {
  const styles = useThemedStyles(createStyles);
  const meta = describeDrill(drill, { markUntimed: true });

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === DELETE_ACTION) {
      onRequestDelete(drill);
    }
  };

  return (
    <View
      style={[
        styles.rowFrame,
        first && styles.firstRow,
        last ? styles.lastRow : styles.dividedRow,
      ]}
    >
      <View style={styles.rowClip}>
        <SwipeableRow
          actionLabel="Delete"
          actionAccessibilityLabel={`Delete ${drill.name}`}
          onAction={() => onRequestDelete(drill)}
          open={open}
          onOpenChange={next => onOpenChange(drill.id, next)}
          actionTestID={`btn-delete-drill-${drill.id}`}
          gestureTestID={`swipe-drill-${drill.id}`}
        >
          <View style={styles.row}>
            <TouchableOpacity
              // A row showing its Delete action is put away by a tap, the
              // same as swiping it back, rather than opened in the editor.
              onPress={() =>
                open ? onOpenChange(drill.id, false) : onEdit(drill.id)
              }
              accessibilityRole="button"
              accessibilityLabel={`Edit ${drill.name}, ${meta}`}
              accessibilityActions={DRILL_ROW_ACTIONS}
              onAccessibilityAction={handleAccessibilityAction}
              activeOpacity={0.7}
              style={styles.rowBody}
              testID={`row-drill-${drill.id}`}
            >
              <Typography
                variant="stencilSmall"
                numberOfLines={2}
                style={styles.name}
              >
                {drill.name}
              </Typography>
              <Typography variant="metricCaption" color="textSecondary">
                {meta}
              </Typography>
            </TouchableOpacity>

            <Button
              label="Load"
              variant="secondary"
              accessibilityLabel={`Load ${drill.name} on the timer`}
              onPress={() => onLoad(drill.id)}
              testID={`btn-load-drill-${drill.id}`}
            />
          </View>
        </SwipeableRow>
      </View>
    </View>
  );
};

type DrillsStatusProps = {
  /** Why there is no drill to list. */
  status: 'loading' | 'error' | 'empty';
  onRetry: () => void;
  onCreate: () => void;
};

/** What sits under the "Saved" label when there is no drill to list. */
const DrillsStatus = ({ status, onRetry, onCreate }: DrillsStatusProps) => {
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
            testID="text-drills-loading"
          >
            Loading your drills…
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
          testID="state-drills-error"
        />
      </Card>
    );
  }

  return (
    <Card>
      <EmptyState
        mark="new"
        title="No drills yet"
        message="Create a drill and it will show up here, ready to time."
        actionLabel="New drill"
        actionVariant="primary"
        onActionPress={onCreate}
        testID="state-drills-empty"
      />
    </Card>
  );
};

const NO_DRILLS: Drill[] = [];

const keyOfDrill = (drill: Drill): string => drill.id;

/**
 * Library of saved drills, read from `DrillStorageService` — the same
 * drills the shot timer runs. Each row opens the drill in the editor, and
 * its Load button switches to the Timer with that drill on it; the
 * header's + New starts a new one.
 *
 * A drill is deleted by swiping its row left for the Delete action, then
 * confirming in a sheet. The runs recorded with it are deleted too, and the
 * sheet says so.
 */
export const DrillsScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<Nav>();
  const { state, reload, deleteDrill } = useDrills();
  const drills = state.status === 'ready' ? state.drills : NO_DRILLS;
  const listStatus = state.status === 'ready' ? 'empty' : state.status;
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  // The drill the confirmation sheet is asking about, while it is up.
  const [pendingDelete, setPendingDelete] = useState<Drill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  // A second press of the confirm button lands before `deleting` has
  // rendered, so the guard is a ref.
  const deletingRef = useRef(false);

  // An error takes the place of the loading line, which TalkBack does not
  // announce on its own.
  useAnnounce(state.status === 'error' ? ERROR_TITLE : null);

  const createDrill = useCallback(
    () => navigation.navigate('SequenceEditor', {}),
    [navigation],
  );

  const editDrill = useCallback(
    (id: string) => navigation.navigate('SequenceEditor', { id }),
    [navigation],
  );

  // The Timer takes the id, then clears it from its params.
  const loadDrill = useCallback(
    (id: string) => navigation.navigate('Timer', { drillId: id }),
    [navigation],
  );

  // A row left open is put away when the screen is left, so coming back
  // never finds a Delete action already showing.
  useFocusEffect(useCallback(() => () => setOpenRowId(null), []));

  const changeOpenRow = useCallback((id: string, open: boolean) => {
    // Opening a row closes whichever was open; closing one only counts if
    // it is still the open one.
    setOpenRowId(current => {
      if (open) {
        return id;
      }
      return current === id ? null : current;
    });
  }, []);

  const requestDelete = useCallback((drill: Drill) => {
    setDeleteFailed(false);
    setPendingDelete(drill);
  }, []);

  const cancelDelete = useCallback(() => {
    if (deletingRef.current) {
      return;
    }
    setPendingDelete(null);
    setDeleteFailed(false);
  }, []);

  const confirmDelete = async () => {
    if (pendingDelete === null || deletingRef.current) {
      return;
    }
    deletingRef.current = true;
    setDeleting(true);
    setDeleteFailed(false);

    // `deleteDrill` settles a failure into `false`, so this never rejects.
    const deleted = await deleteDrill(pendingDelete.id);

    deletingRef.current = false;
    setDeleting(false);
    if (!deleted) {
      // The sheet stays up with the reason, and the drill stays listed.
      setDeleteFailed(true);
      return;
    }
    // The row, and the reader's focus with the sheet, is gone: say so.
    AccessibilityInfo.announceForAccessibility(`Deleted ${pendingDelete.name}`);
    setPendingDelete(null);
    setOpenRowId(null);
  };

  const lastIndex = drills.length - 1;
  const renderDrill = useCallback(
    ({ item, index }: ListRenderItemInfo<Drill>) => (
      <DrillRow
        drill={item}
        open={item.id === openRowId}
        first={index === 0}
        last={index === lastIndex}
        onEdit={editDrill}
        onLoad={loadDrill}
        onOpenChange={changeOpenRow}
        onRequestDelete={requestDelete}
      />
    ),
    [openRowId, lastIndex, editDrill, loadDrill, changeOpenRow, requestDelete],
  );

  return (
    <Screen
      title="Drills"
      subtitle="Your library of runnable drills"
      action={{
        label: '+ New',
        accessibilityLabel: 'New drill',
        onPress: createDrill,
        testID: 'btn-create-drill',
      }}
      contentStyle={styles.screenContent}
      testID="screen-drills"
    >
      <FlatList
        data={drills}
        keyExtractor={keyOfDrill}
        renderItem={renderDrill}
        // Which row is open reaches the rows only through `renderItem`.
        // Which is last needs nothing here: it can only change with `data`.
        extraData={openRowId}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {state.status === 'ready' && state.refreshFailed ? (
              <RefreshFailedNotice testID="text-drills-refresh-failed" />
            ) : null}
            <SectionHeader
              title={
                state.status === 'ready'
                  ? `Saved · ${state.drills.length}`
                  : 'Saved'
              }
              hint={drills.length > 0 ? 'Swipe left to delete' : undefined}
              testID="header-saved-drills"
            />
          </View>
        }
        ListEmptyComponent={
          <DrillsStatus
            status={listStatus}
            onRetry={reload}
            onCreate={createDrill}
          />
        }
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        testID="list-drills"
      />

      <ConfirmSheet
        visible={pendingDelete !== null}
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        message="This removes the drill and every run saved with it from this device and cannot be undone."
        confirmLabel="Delete drill"
        busyLabel="Deleting…"
        busy={deleting}
        error={
          deleteFailed && pendingDelete !== null
            ? `Could not delete ${pendingDelete.name}. Try again.`
            : undefined
        }
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        testID="sheet-delete-drill"
      />
    </Screen>
  );
};
