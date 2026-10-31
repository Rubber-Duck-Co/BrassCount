import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementRef,
} from 'react';

import {
  AccessibilityInfo,
  findNodeHandle,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Theme } from '@/theme/theme';
import {
  MAX_DRILL_NAME_LENGTH,
  MAX_DRILL_STEPS,
  type DrillStep,
  type DrillStepType,
} from '@/types/drill';
import type { DrillsStackParamList } from '@/types/navigation';
import { Card } from '@components/Card';
import { DrillStepRow } from '@components/DrillStepRow';
import { EmptyState } from '@components/EmptyState';
import { Icon } from '@components/Icon';
import { ParPickerSheet } from '@components/ParPickerSheet';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { SelectSheet, type SelectOption } from '@components/Select';
import { TextField } from '@components/TextField';
import { Typography } from '@components/Typography';
import {
  useDrillEditor,
  type DrillEditorStatus,
  type DrillSaveFailure,
  type DrillSaveState,
} from '@hooks/useDrillEditor';
import { useTheme, useThemedStyles } from '@hooks/useTheme';
import {
  countShots,
  stepLabel,
  stepTypeDescription,
  stepTypeLabel,
  totalPar,
} from '@utils/drill';
import {
  canAddStep,
  nextStepType,
  stepTypeChoices,
  type DrillDraftProblem,
} from '@utils/drillDraft';
import { formatSeconds, pluralize, spokenSeconds } from '@utils/format';

type Nav = NativeStackNavigationProp<DrillsStackParamList, 'SequenceEditor'>;
type EditorRoute = RouteProp<DrillsStackParamList, 'SequenceEditor'>;

/**
 * Narrowest a step's name may get, at the default text size, before the
 * controls after it drop to a line of their own. It grows with the system
 * font scale, so large text wraps the row instead of cutting the name
 * short.
 */
const STEP_LABEL_MIN_WIDTH = 112;

/** Where focus goes after a removal when no step is left beside it. */
const ADD_STEP_FOCUS = 'add-step';

type PendingFocus = {
  /** Id of the step to focus, or `ADD_STEP_FOCUS`. */
  target: string;
  /** Id of the step being removed: still listed means the removal was refused. */
  removedId: string;
};

/** The line under the title once the drill has steps. */
const describeSteps = (steps: readonly DrillStep[]): string => {
  const counts = `${pluralize(steps.length, 'step')} · ${pluralize(
    countShots(steps),
    'shot',
  )}`;
  const par = totalPar(steps);
  return par === null ? counts : `${counts} · Par ${formatSeconds(par)}`;
};

/**
 * What the draft still needs before it can be saved, for the line under
 * the save button. The two a shooter meets building a drill — no name, no
 * steps — are worded together when both apply.
 */
const saveHint = (problems: readonly DrillDraftProblem[]): string => {
  const needsName = problems.includes('name-missing');
  const needsStep = problems.includes('no-steps');

  if (needsName && needsStep) {
    return 'Name the drill and add at least one step to save.';
  }
  if (needsName) {
    return 'Name the drill to save.';
  }
  if (needsStep) {
    return 'Add at least one step to save.';
  }
  if (problems.includes('name-too-long')) {
    return `Use ${MAX_DRILL_NAME_LENGTH} characters or fewer for the name.`;
  }
  return `A drill can have at most ${MAX_DRILL_STEPS} steps.`;
};

/**
 * Words for a failed save. The service's own message is written for a
 * developer, so the shooter is only told which kind of failure it was.
 */
const saveFailureMessage = (
  failure: DrillSaveFailure,
  editing: boolean,
): string => {
  if (failure === 'invalid') {
    return 'This drill cannot be saved as it is. Check its name and steps, then try again.';
  }
  if (failure === 'missing') {
    return 'This drill is no longer saved on this device, so it cannot be changed.';
  }
  return editing
    ? 'Could not save your changes. Try again.'
    : 'Could not save the drill. Try again.';
};

/**
 * The types the step type sheet offers a step of type `current`, each
 * with what it means; none while the sheet is closed.
 */
const typeOptions = (
  current: DrillStepType | undefined,
): SelectOption<DrillStepType>[] =>
  current === undefined
    ? []
    : stepTypeChoices(current).map(type => ({
        value: type,
        label: stepTypeLabel(type),
        description: stepTypeDescription(type),
      }));

/** The whole sequence in one sentence, for the Preview box's reader label. */
const spokenPreview = (steps: readonly DrillStep[]): string =>
  steps
    .map((step, i) => {
      const label = stepLabel(steps, i);
      return step.par === undefined
        ? label
        : `${label}, ${spokenSeconds(step.par)}`;
    })
    .join('; then ');

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    hint: { marginBottom: theme.spacing.sm },
    // A minimum height, so the label grows the row at a large font.
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.addRowMin,
      paddingHorizontal: theme.spacing.inset,
    },
    addLabel: { textTransform: 'uppercase' },
    limitNote: {
      paddingHorizontal: theme.spacing.inset,
      paddingBottom: theme.spacing.inset,
    },
    // Outlined on the Paper, with no Card fill: it shows, it is not edited.
    previewBox: {
      padding: theme.spacing.inset,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    emptyRow: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    summary: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    status: { gap: theme.spacing.xs },
    loading: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
    },
  });

type StepPreviewProps = {
  steps: readonly DrillStep[];
};

/**
 * The sequence on one wrapping line: each step, its par, and an arrow.
 * Memoised so typing the drill's name does not draw the sequence again.
 */
const StepPreview = memo(({ steps }: StepPreviewProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View>
      <SectionHeader title="Preview" />
      <View style={styles.previewBox}>
        {/* Read as one sentence: the arrows and brackets mean nothing
            spoken a step at a time. */}
        <View
          accessible
          accessibilityLabel={spokenPreview(steps)}
          style={styles.summary}
          testID="text-preview"
        >
          {steps.map((step, i) => (
            <Typography key={step.id} variant="rowLabel">
              {stepLabel(steps, i)}
              {step.par === undefined ? null : (
                <Typography variant="rowLabel" color="textSecondary">
                  {` (${formatSeconds(step.par)})`}
                </Typography>
              )}
              {i < steps.length - 1 ? (
                <Typography variant="rowLabel" color="textSecondary">
                  {'  →  '}
                </Typography>
              ) : null}
            </Typography>
          ))}
        </View>
      </View>
    </View>
  );
});

StepPreview.displayName = 'StepPreview';

type EditorUnavailableProps = {
  status: Exclude<DrillEditorStatus, 'ready'>;
  onRetry: () => void;
  onBack: () => void;
};

/** What stands in for the editor while a saved drill cannot be shown. */
const EditorUnavailable = ({
  status,
  onRetry,
  onBack,
}: EditorUnavailableProps) => {
  const styles = useThemedStyles(createStyles);

  if (status === 'loading') {
    return (
      <Card>
        <View style={styles.loading}>
          <Typography
            variant="body"
            color="textSecondary"
            testID="text-editor-loading"
          >
            Loading drill…
          </Typography>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      {/* Announced: it takes the place of the loading line on its own. */}
      <View accessibilityLiveRegion="polite">
        {status === 'missing' ? (
          <EmptyState
            mark="empty"
            title="Drill not found"
            message="It is no longer saved on this device."
            actionLabel="Back to drills"
            onActionPress={onBack}
            testID="state-editor-missing"
          />
        ) : (
          <EmptyState
            mark="error"
            title="Could not load this drill"
            message="Something went wrong reading it from this device."
            actionLabel="Try again"
            onActionPress={onRetry}
            testID="state-editor-error"
          />
        )}
      </View>
    </Card>
  );
};

type SaveStatusProps = {
  /** Whether a saved drill is being changed, not a new one created. */
  editing: boolean;
  problems: readonly DrillDraftProblem[];
  saveFailure: DrillSaveFailure | null;
};

/**
 * Why the last save failed and what the draft still needs, at the top of
 * the editor just under the header's Save, so the reason Save is grey is
 * the first thing read after it.
 */
const SaveStatus = ({ editing, problems, saveFailure }: SaveStatusProps) => {
  const styles = useThemedStyles(createStyles);

  if (saveFailure === null && problems.length === 0) {
    return null;
  }

  return (
    <View style={styles.status}>
      {saveFailure === null ? null : (
        <Typography
          variant="body"
          color="danger"
          accessibilityLiveRegion="polite"
          testID="text-drill-save-error"
        >
          {saveFailureMessage(saveFailure, editing)}
        </Typography>
      )}
      {problems.length > 0 ? (
        <Typography
          variant="body"
          color="textSecondary"
          testID="text-save-hint"
        >
          {saveHint(problems)}
        </Typography>
      ) : null}
    </View>
  );
};

/**
 * What the header's Save says aloud: what a press does, or that it is
 * busy. Each name holds the word shown, so "tap Save" works by voice.
 */
const saveAccessibilityLabel = (
  editing: boolean,
  saveState: DrillSaveState,
): string => {
  if (saveState !== 'idle') {
    return 'Saving…';
  }
  return editing ? 'Save changes' : 'Save drill';
};

type DrillEditorProps = {
  /** Id of the saved drill to edit; leave off to build a new one. */
  drillId?: string;
};

const DrillEditor = ({ drillId }: DrillEditorProps) => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<Nav>();
  const { fontScale } = useWindowDimensions();
  const { sizes } = useTheme();
  const {
    status,
    name,
    steps,
    problems,
    canSave,
    saveState,
    saveFailure,
    setName,
    addStep,
    removeStep,
    moveStep,
    changeStepType,
    setStepPar,
    reload,
    save,
  } = useDrillEditor(drillId);
  // The step whose par is being picked. An id, not a position, so it
  // still points at the same step whatever happens to the list.
  const [parStepId, setParStepId] = useState<string | null>(null);
  // The step whose type is being picked, by id for the same reason.
  const [typeStepId, setTypeStepId] = useState<string | null>(null);
  // Whether the rows show move buttons in place of their par and remove
  // controls. Only offered while there are two steps to swap.
  const [reorderRequested, setReorderRequested] = useState(false);

  const closeParPicker = useCallback(() => setParStepId(null), []);
  const closeTypePicker = useCallback(() => setTypeStepId(null), []);

  // The remove buttons and the add button, so focus can be put on one after
  // a removal took the row the reader was on.
  const removeButtons = useRef(
    new Map<string, ElementRef<typeof TouchableOpacity>>(),
  );
  const addButton = useRef<ElementRef<typeof TouchableOpacity>>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  // The header back button and a save landing both ask the navigator to go
  // back; the first request wins, so the second cannot pop the screen
  // underneath. Hardware back is left to the navigator, which ignores a
  // pop for a screen that is already leaving.
  const leaveRequested = useRef(false);
  // Read by `removeStepAndRefocus` so it keeps one identity and the memoised
  // rows are not drawn again on every edit.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const scrollRef = useRef<ScrollView>(null);

  // Save sits in the header and can be pressed from anywhere down the
  // form, but why it failed is said at the top: go there.
  useEffect(() => {
    if (saveFailure !== null) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [saveFailure]);

  const registerRemoveButton = useCallback(
    (id: string, node: ElementRef<typeof TouchableOpacity> | null) => {
      if (node === null) {
        removeButtons.current.delete(id);
      } else {
        removeButtons.current.set(id, node);
      }
    },
    [],
  );

  const leave = useCallback(() => {
    if (leaveRequested.current) {
      return;
    }
    leaveRequested.current = true;
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null) {
      return;
    }
    pendingFocus.current = null;
    // The step is still there: the removal was refused (a save is under
    // way), so leave focus alone.
    if (steps.some(step => step.id === pending.removedId)) {
      return;
    }
    const node =
      pending.target === ADD_STEP_FOCUS
        ? addButton.current
        : removeButtons.current.get(pending.target);
    const handle = node === undefined ? null : findNodeHandle(node);
    if (handle !== null) {
      AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [steps]);

  const removeStepAndRefocus = useCallback(
    (id: string) => {
      const current = stepsRef.current;
      const index = current.findIndex(step => step.id === id);
      if (index < 0) {
        return;
      }
      const neighbour = current[index + 1] ?? current[index - 1];
      pendingFocus.current = {
        target: neighbour?.id ?? ADD_STEP_FOCUS,
        removedId: id,
      };
      removeStep(id);
    },
    [removeStep],
  );

  const toggleReorder = useCallback(
    () => setReorderRequested(previous => !previous),
    [],
  );

  const addAndAnnounceStep = () => {
    // Nothing else tells a screen reader the list grew: the button keeps
    // its label and the new row appears above it.
    AccessibilityInfo.announceForAccessibility(
      `Added step ${steps.length + 1}, ${stepTypeLabel(nextStepType(steps))}`,
    );
    addStep();
  };

  const editing = drillId !== undefined;
  const title = editing ? 'Edit drill' : 'New drill';

  const saveAndLeave = async () => {
    // `save` settles a failure into `saveFailure` and resolves to
    // `null`, as it does when the editor was closed before the write
    // landed — going back then would pop the screen underneath.
    const drill = await save();
    if (drill === null) {
      return;
    }
    // The editor, and the reader's focus with it, is about to go: say
    // what happened to the drill.
    AccessibilityInfo.announceForAccessibility(
      `${editing ? 'Saved' : 'Created'} ${drill.name}`,
    );
    leave();
  };

  if (status !== 'ready') {
    return (
      <Screen
        title={title}
        onBack={leave}
        backLabel="Drills"
        scrollable
        testID="screen-drill-editor"
      >
        <EditorUnavailable status={status} onRetry={reload} onBack={leave} />
      </Screen>
    );
  }

  const parPosition = steps.findIndex(step => step.id === parStepId);
  const typePosition = steps.findIndex(step => step.id === typeStepId);
  const typeStep = steps[typePosition];
  const hasRoom = canAddStep(steps);
  const canReorder = steps.length > 1;
  const reordering = reorderRequested && canReorder;

  return (
    <Screen
      title={title}
      onBack={leave}
      backLabel="Drills"
      subtitle={
        steps.length > 0
          ? describeSteps(steps)
          : 'Name it, then add the actions in order'
      }
      action={{
        label: saveState === 'idle' ? 'Save' : 'Saving…',
        onPress: saveAndLeave,
        accessibilityLabel: saveAccessibilityLabel(editing, saveState),
        testID: 'btn-save-drill',
      }}
      actionDisabled={!canSave || saveState !== 'idle'}
      scrollable
      scrollRef={scrollRef}
      testID="screen-drill-editor"
    >
      <SaveStatus
        editing={editing}
        problems={problems}
        saveFailure={saveFailure}
      />

      <TextField
        label="Drill name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Bill Drill"
        maxLength={MAX_DRILL_NAME_LENGTH}
        editable={saveState === 'idle'}
        onPaper
        testID="input-drill-name"
      />

      <View>
        <SectionHeader
          title={steps.length > 0 ? `Steps · ${steps.length}` : 'Steps'}
          actionLabel={
            canReorder ? (reordering ? 'Done' : 'Reorder') : undefined
          }
          actionAccessibilityLabel={
            reordering ? 'Done reordering' : 'Reorder steps'
          }
          onActionPress={toggleReorder}
          actionTestID="btn-reorder-steps"
        />
        <Typography variant="label" color="textSecondary" style={styles.hint}>
          {reordering
            ? 'Use the arrows to move a step. Tap Done when the order is right.'
            : 'Tap a par to cap how long a step can take from the one before. Step 1’s par runs from the beep.'}
        </Typography>

        <Card flush>
          {steps.length === 0 ? (
            <View style={styles.emptyRow} testID="state-steps-empty">
              <Typography variant="bodyStrong" color="textSecondary">
                No steps yet
              </Typography>
              <Typography variant="caption" color="textTertiary" align="center">
                Add your first action — most strings open with a draw.
              </Typography>
            </View>
          ) : (
            // Mapped, not virtualised: a drill holds at most
            // `MAX_DRILL_STEPS` rows, and they sit inside the card.
            steps.map((step, i) => (
              <DrillStepRow
                key={step.id}
                step={step}
                position={i}
                last={i === steps.length - 1}
                label={stepLabel(steps, i)}
                reordering={reordering}
                labelMinWidth={STEP_LABEL_MIN_WIDTH * fontScale}
                onEditType={setTypeStepId}
                onEditPar={setParStepId}
                onRemove={removeStepAndRefocus}
                onMove={moveStep}
                registerRemove={registerRemoveButton}
              />
            ))
          )}

          <TouchableOpacity
            ref={addButton}
            onPress={addAndAnnounceStep}
            disabled={!hasRoom}
            accessibilityRole="button"
            accessibilityLabel="Add step"
            accessibilityState={{ disabled: !hasRoom }}
            style={styles.addRow}
            testID="btn-add-step"
          >
            <Icon
              name="plus"
              size={sizes.iconMd}
              color={hasRoom ? 'textPrimary' : 'disabled'}
            />
            <Typography
              variant="actionLabel"
              color={hasRoom ? 'textPrimary' : 'disabled'}
              style={styles.addLabel}
            >
              Add step
            </Typography>
          </TouchableOpacity>

          {hasRoom ? null : (
            <Typography
              variant="caption"
              color="textSecondary"
              accessibilityLiveRegion="polite"
              style={styles.limitNote}
              testID="text-step-limit"
            >
              {`A drill can have at most ${MAX_DRILL_STEPS} steps.`}
            </Typography>
          )}
        </Card>
      </View>

      {steps.length > 0 ? <StepPreview steps={steps} /> : null}

      <ParPickerSheet
        visible={parPosition >= 0}
        stepNumber={parPosition + 1}
        par={steps[parPosition]?.par}
        onSelect={par => {
          if (parStepId !== null) {
            setStepPar(parStepId, par);
          }
          closeParPicker();
        }}
        onClose={closeParPicker}
      />

      <SelectSheet
        visible={typeStep !== undefined}
        onClose={closeTypePicker}
        value={typeStep?.type ?? nextStepType(steps)}
        options={typeOptions(typeStep?.type)}
        onChoose={type => {
          if (typeStepId !== null) {
            changeStepType(typeStepId, type);
          }
          closeTypePicker();
        }}
        title={`Step ${typePosition + 1} type`}
        testID="select-step-type"
      />
    </Screen>
  );
};

/**
 * Create / edit a drill: its name and its ordered steps, each with a type
 * and an optional par, plus a live preview of the sequence. Opened with
 * the id of a saved drill it starts from that drill; without one it
 * starts empty. Save is the header's action, grey until the draft can be
 * saved, with the reason on the first line under the header. It stores the
 * draft through `DrillStorageService` — a new drill is created, an opened
 * one updated — and goes back; leaving any other way drops the draft.
 * While a saved drill is loading or cannot be shown there is no Save.
 */
export const SequenceEditorScreen = () => {
  const route = useRoute<EditorRoute>();
  const drillId = route.params?.id;

  // Keyed by the drill, so being pointed at another one starts a fresh
  // editor instead of showing the new drill under the old draft.
  return <DrillEditor key={drillId ?? 'new'} drillId={drillId} />;
};
