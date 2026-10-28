import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';

import {
  AccessibilityInfo,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  useIsFocused,
  useNavigation,
  type CompositeNavigationProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { SemanticColors, Theme } from '@/theme/theme';
import type { Drill, DrillStep } from '@/types/drill';
import type { MainTabParamList, RootStackParamList } from '@/types/navigation';
import type { RunResult, RunStep, StepResult } from '@/types/run';
import type { SessionInput } from '@/types/session';
import { Button } from '@components/Button';
import { Card } from '@components/Card';
import { ClockBox } from '@components/ClockBox';
import { DrillPicker } from '@components/DrillPicker';
import { ListRow } from '@components/ListRow';
import { SaveRunPrompt } from '@components/SaveRunPrompt';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { Typography } from '@components/Typography';
import {
  useDrillRun,
  type DrillRunFailure,
  type DrillRunPhase,
} from '@hooks/useDrillRun';
import { useDrills } from '@hooks/useDrills';
import {
  useRunSave,
  type RunSaveFailure,
  type RunSaveStatus,
} from '@hooks/useRunSave';
import { useThemedStyles } from '@hooks/useTheme';
import { useTimerSettings } from '@hooks/useTimerSettings';
import { countShots, stepLabel, stepTypeLabel, totalPar } from '@utils/drill';
import { formatSeconds, pluralize, spokenSeconds } from '@utils/format';
import { shownDeltaSign } from '@utils/history';
import { planRun } from '@utils/runDetection';
import { clockCaption, clockMeta, type ClockPhase } from '@utils/timerReadout';

const NO_VALUE = '—';

/** The Timer tab, which also jumps into the Drills and Setup tabs. */
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Timer'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** What the picker offers until the drills have been read. */
const NO_DRILLS: Drill[] = [];
/** The steps on show while there is no drill. */
const NO_STEPS: DrillStep[] = [];

/** A length of time said to the hundredth, the figure the screen shows. */
const speak = (seconds: number): string =>
  spokenSeconds(Number(Math.abs(seconds).toFixed(2)));

/** `["shot", "rack"]` → `Shot and Rack`. */
const nameSounds = (sounds: readonly DrillStep['type'][]): string => {
  const names = sounds.map(stepTypeLabel);
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const failureMessage = (failure: DrillRunFailure): string => {
  switch (failure.kind) {
    case 'not-calibrated':
      return `Calibrate ${nameSounds(failure.sounds)} first`;
    case 'no-steps':
      return 'This drill has no shot, reload or rack to listen for';
    case 'permission-denied':
      return 'Microphone access is needed to time a run';
    case 'permission-blocked':
      return 'Microphone access is turned off. Allow it in Settings.';
    case 'interrupted':
      return 'The run stopped because the app was left';
    case 'microphone':
      return 'The microphone could not be used';
    case 'beep':
      return 'Could not play the start beep';
    case 'audio-unavailable':
      return 'Audio unavailable';
  }
};

const openAppSettings = (): void => {
  // Nothing more to offer if the settings screen will not open: the
  // header already says where the permission lives.
  Linking.openSettings().catch(() => {});
};

const phaseMessage = (phase: DrillRunPhase, result: RunResult | null) => {
  switch (phase) {
    case 'idle':
      return 'Ready when you are';
    case 'arming':
    case 'waiting':
      return 'Stand by…';
    case 'running':
      return 'Listening…';
    case 'finished':
      return result?.completed === true ? 'Run complete' : 'Run stopped early';
  }
};

/**
 * How a finished run was timed: where its zero point came from and which
 * clock stamped its sounds. Shown so the timing can be judged on a phone,
 * where there is no log to read.
 */
const timingNote = (result: RunResult): string => {
  const zero =
    result.zeroSource === 'beep' && result.beepDelayMs !== null
      ? `Timed from the start beep as it was heard, ${Math.round(result.beepDelayMs)} ms after it was requested.`
      : 'The start beep was not heard, so the run is timed from when it was requested and its first step may read long.';
  const clock =
    result.clockSource === 'frame'
      ? "Steps timed by the microphone hardware's own clock."
      : 'This device gives no hardware microphone clock, so a step may be up to 20 ms off.';
  return `${zero} ${clock}`;
};

/**
 * A finished run as a screen reader should say it, with what can be done
 * with it: the prompt to save it appears under the timer.
 */
const speakResult = (result: RunResult): string => {
  if (result.results.length === 0) {
    return 'Run stopped early, nothing heard';
  }
  const run = result.completed
    ? `Run complete, ${speak(result.totalTime)}`
    : `Run stopped early, ${pluralize(result.results.length, 'step')} heard`;
  return `${run}. Save it or discard it`;
};

type Tone = 'success' | 'danger' | 'neutral';

const toneColor: Record<Tone, keyof SemanticColors> = {
  success: 'success',
  danger: 'danger',
  neutral: 'textSecondary',
};

type SplitRow = {
  subtitle?: string;
  value: string;
  tone: Tone;
  /** The row as a screen reader should say it. */
  spoken: string;
};

/** A step the timer cannot hear: a draw, a transition, a holster. */
const describeSilentStep = (
  title: string,
  step: DrillStep,
  countsTowardsNext: boolean,
): SplitRow => {
  if (step.par === undefined || !countsTowardsNext) {
    return {
      subtitle: 'not timed',
      value: NO_VALUE,
      tone: 'neutral',
      spoken: `${title}, not timed`,
    };
  }
  return {
    subtitle: `par ${formatSeconds(step.par)}, counted with the next step`,
    value: NO_VALUE,
    tone: 'neutral',
    spoken: `${title}, not timed. Its par of ${speak(step.par)} counts towards the next step`,
  };
};

/** A step the timer listens for, before or after it has been heard. */
const describeHeardStep = (
  title: string,
  planned: RunStep,
  result: StepResult | undefined,
): SplitRow => {
  const par =
    planned.par === undefined ? undefined : `par ${formatSeconds(planned.par)}`;
  const spokenPar =
    planned.par === undefined ? 'no par' : `par ${speak(planned.par)}`;

  if (result === undefined) {
    return {
      subtitle: par,
      value: NO_VALUE,
      tone: 'neutral',
      spoken: `${title}, ${spokenPar}, not heard yet`,
    };
  }

  const value = formatSeconds(result.actual);
  const took = `took ${speak(result.actual)}`;
  if (result.delta === null) {
    return {
      value,
      tone: 'neutral',
      spoken: `${title}, ${spokenPar}, ${took}`,
    };
  }

  const sign = shownDeltaSign(result.delta);
  const size = formatSeconds(Math.abs(result.delta));
  const againstPar =
    sign === 0 ? 'on par' : `${size} ${sign < 0 ? 'under' : 'over'}`;
  const spokenAgainstPar =
    sign === 0
      ? 'on par'
      : `${speak(result.delta)} ${sign < 0 ? 'under' : 'over'} par`;
  return {
    subtitle: `${par} · ${againstPar}`,
    value,
    tone: sign === 0 ? 'neutral' : sign < 0 ? 'success' : 'danger',
    spoken: `${title}, ${spokenPar}, ${took}, ${spokenAgainstPar}`,
  };
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Not padded itself: the scrolling content and the main action under
    // it each take the gutter, so the content scrolls edge to edge.
    content: { padding: theme.spacing.none, gap: theme.spacing.none },
    scroll: { flex: 1 },
    // No bottom padding: the main action's own gap separates the two.
    scrollContent: {
      flexGrow: 1,
      paddingTop: theme.spacing.gutter,
      paddingHorizontal: theme.spacing.gutter,
      gap: theme.spacing.gutter,
    },
    // Pinned under the scrolling content, so it never moves between states.
    mainAction: { padding: theme.spacing.gutter },
    stopGlyph: {
      width: theme.sizes.iconLg,
      height: theme.sizes.iconLg,
      backgroundColor: theme.colors.textOnInverse,
    },
    timingNote: {
      paddingHorizontal: theme.spacing.xs,
    },
  });

type FailureActionProps = {
  failure: DrillRunFailure | null;
  onCalibrate: () => void;
};

/**
 * The way out of a failure the header names, when there is one the
 * shooter can take from here: the app's settings for a microphone that has
 * been turned off, Calibration in Setup for a sound that has no threshold.
 */
const FailureAction = ({ failure, onCalibrate }: FailureActionProps) => {
  switch (failure?.kind) {
    case 'permission-blocked':
      return (
        <Button
          label="Open settings"
          variant="secondary"
          onPress={openAppSettings}
          testID="btn-open-settings"
        />
      );
    case 'not-calibrated':
      return (
        <Button
          label="Go to Calibration"
          variant="secondary"
          onPress={onCalibrate}
          testID="btn-go-calibration"
        />
      );
    default:
      return null;
  }
};

type RunOutcomeProps = {
  /** A run has finished and its times are on show. */
  show: boolean;
  /** What the run would save as; `null` when nothing was heard. */
  session: SessionInput | null;
  /** How many steps the run listened for. */
  plannedCount: number;
  saveStatus: RunSaveStatus;
  saveFailure: RunSaveFailure | null;
  onSave: () => void;
  onDiscard: () => void;
};

/**
 * Under the timer once a run has finished: the prompt to save or discard
 * it, or why there is nothing to save.
 */
const RunOutcome = ({
  show,
  session,
  plannedCount,
  saveStatus,
  saveFailure,
  onSave,
  onDiscard,
}: RunOutcomeProps) => {
  const styles = useThemedStyles(createStyles);

  if (!show) {
    return null;
  }
  if (session === null) {
    return (
      <Typography
        variant="caption"
        color="textSecondary"
        style={styles.timingNote}
        testID="text-nothing-to-save"
      >
        Nothing was heard, so there is nothing to save.
      </Typography>
    );
  }
  return (
    <SaveRunPrompt
      completed={session.completed}
      totalTime={session.totalTime}
      heardCount={session.splits.length}
      plannedCount={plannedCount}
      status={saveStatus}
      failure={saveFailure}
      onSave={onSave}
      onDiscard={onDiscard}
    />
  );
};

/**
 * The shot timer. Times a run of a stored drill from the microphone, then
 * asks whether the run goes into History: nothing is saved until the
 * shooter says so, and a run that is not wanted is simply discarded.
 */
export const TimerScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<Nav>();
  const { startDelay } = useTimerSettings();

  const { state: drillsState, reload: reloadDrills } = useDrills();
  const drills =
    drillsState.status === 'ready' ? drillsState.drills : NO_DRILLS;
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null);
  // Until one is picked, the drill changed most recently.
  const selectedDrill =
    drills.find(item => item.id === selectedDrillId) ?? drills[0] ?? null;

  const { phase, results, result, failure, readElapsed, start, stop, reset } =
    useDrillRun();
  // The drill as it was when the run started. The run's rows, and the
  // session it saves as, come from it, so an edit made in the editor while
  // the run is on show cannot change either. It is left in place after a
  // reset: once idle the screen shows the selected drill instead.
  const [runDrill, setRunDrill] = useState<Drill | null>(null);
  const drill =
    phase !== 'idle' && runDrill !== null ? runDrill : selectedDrill;
  const steps = drill?.steps ?? NO_STEPS;
  // The steps the run listens for, with the pars they are judged against.
  const plan = useMemo(() => planRun(steps), [steps]);

  const {
    session,
    status: saveStatus,
    failure: saveFailure,
    save,
  } = useRunSave(runDrill, result);
  const saving = saveStatus === 'saving';

  const running = phase === 'running';
  // The microphone is opening or the delay is running: Start can be undone.
  const pending = phase === 'arming' || phase === 'waiting';
  const failureText = failure === null ? null : failureMessage(failure);

  // A finished run whose drill was deleted on another tab, and that was not
  // saved, has nothing left to be saved against, so it goes. A run already
  // saved keeps its confirmation, and nothing else can be on show: leaving
  // the tab ends a run in progress.
  const unsavedRunDrillGone =
    phase === 'finished' &&
    saveStatus === 'unsaved' &&
    runDrill !== null &&
    drillsState.status === 'ready' &&
    !drills.some(item => item.id === runDrill.id);
  useEffect(() => {
    if (unsavedRunDrillGone) {
      reset();
      setRunDrill(null);
      AccessibilityInfo.announceForAccessibility(
        'Run discarded: its drill was deleted',
      );
    }
  }, [reset, unsavedRunDrillGone]);

  // What a screen reader has already been told, so each failure and each
  // finished run is said once.
  const isFocused = useIsFocused();
  const said = useRef<{ failure: string | null; result: RunResult | null }>({
    failure: null,
    result: null,
  });
  useEffect(() => {
    // A run that ends because the tab was left is not announced over the
    // screen the shooter went to; it is said when they come back.
    if (!isFocused) {
      return;
    }
    const news: string[] = [];
    if (failureText !== null && failureText !== said.current.failure) {
      news.push(failureText);
    }
    if (result !== null && result !== said.current.result) {
      news.push(speakResult(result));
    }
    said.current = { failure: failureText, result };
    if (news.length > 0) {
      // One announcement, so the second half cannot cut the first off.
      AccessibilityInfo.announceForAccessibility(news.join('. '));
    }
  }, [failureText, isFocused, result]);

  const onPressStart = useCallback(() => {
    if (running || pending) {
      stop();
      return;
    }
    if (selectedDrill === null || saving) {
      return;
    }
    // A finished run that was not saved is dropped by starting the next:
    // nothing of it was stored. The run takes the drill as it is now.
    setRunDrill(selectedDrill);
    setSelectedDrillId(selectedDrill.id);
    start(selectedDrill.steps);
  }, [pending, running, saving, selectedDrill, start, stop]);

  const selectDrill = useCallback(
    (id: string) => {
      if (id !== selectedDrill?.id) {
        // The times on show belong to the drill being left.
        reset();
        setSelectedDrillId(id);
      }
    },
    [reset, selectedDrill],
  );

  // Each jump opens the screen over its tab's own first screen, not in
  // place of it, so going back lands on the Drills list or on Setup.
  const createDrill = useCallback(
    () =>
      navigation.navigate('Drills', {
        screen: 'SequenceEditor',
        params: {},
        initial: false,
      }),
    [navigation],
  );

  const goToCalibration = useCallback(
    () =>
      navigation.navigate('Setup', { screen: 'Calibration', initial: false }),
    [navigation],
  );

  // The prompt's buttons go once it is answered, and a screen reader's
  // focus with them: it is put on the Start button, where the next run
  // begins, rather than back at the top of the screen.
  const startButtonRef = useRef<ComponentRef<typeof View>>(null);
  const focusStartButton = useCallback(() => {
    const button = startButtonRef.current;
    if (button !== null) {
      AccessibilityInfo.sendAccessibilityEvent(button, 'focus');
    }
  }, []);

  const saveRun = useCallback(async () => {
    // `save` settles a failure into the prompt and never rejects.
    const stored = await save();
    if (stored !== null) {
      AccessibilityInfo.announceForAccessibility(
        stored.completed
          ? 'Run saved to History'
          : 'Run saved to History as incomplete',
      );
      focusStartButton();
    }
  }, [focusStartButton, save]);

  const discardRun = useCallback(() => {
    reset();
    // The prompt, and the reader's focus with it, is gone: say what happened.
    AccessibilityInfo.announceForAccessibility('Run discarded');
    focusStartButton();
  }, [focusStartButton, reset]);

  const noDrill = drillsState.status === 'ready' && drill === null;
  // Reset is the header's action: while a run is on it would throw the run
  // away at a stray touch, and Stop already ends it. Nor while a run is
  // being saved, which it would replace.
  const resetLocked = running || pending || saving;

  const drillPar = totalPar(plan);
  const finished = phase === 'finished' && result !== null;
  const clockPhase: ClockPhase = pending
    ? 'pending'
    : running
      ? 'running'
      : finished
        ? 'finished'
        : 'ready';
  const readout = {
    phase: clockPhase,
    shotCount: countShots(steps),
    plannedCount: plan.length,
    heardCount: results.length,
    drillPar,
    completed: result?.completed === true,
    totalTime: result?.totalTime ?? null,
    startDelay,
  };

  return (
    <Screen
      title="Timer"
      subtitle={
        failureText ??
        (noDrill ? 'Create a drill to start' : phaseMessage(phase, result))
      }
      action={{ label: 'Reset', onPress: reset, testID: 'btn-reset' }}
      actionDisabled={resetLocked}
      contentStyle={styles.content}
      testID="screen-timer"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="scroll-timer-content"
      >
        <DrillPicker
          state={drillsState}
          drill={drill}
          locked={resetLocked}
          onSelect={selectDrill}
          onCreate={createDrill}
          onRetry={reloadDrills}
        />

        <FailureAction failure={failure} onCalibrate={goToCalibration} />

        {drill === null ? null : (
          <>
            <ClockBox
              running={running}
              finalSeconds={result === null ? null : result.totalTime}
              parSeconds={drillPar}
              readElapsed={readElapsed}
              meta={clockMeta(readout)}
              caption={clockCaption(readout)}
              dimmed={pending}
            />

            <RunOutcome
              show={finished}
              session={session}
              plannedCount={plan.length}
              saveStatus={saveStatus}
              saveFailure={saveFailure}
              onSave={saveRun}
              onDiscard={discardRun}
            />

            <View>
              <SectionHeader title="Splits" />
              <Card flush>
                {steps.map((step, i) => {
                  const title = stepLabel(steps, i);
                  const planned = plan.find(item => item.stepId === step.id);
                  const row =
                    planned === undefined
                      ? describeSilentStep(
                          title,
                          step,
                          steps
                            .slice(i + 1)
                            .some(later =>
                              plan.some(item => item.stepId === later.id),
                            ),
                        )
                      : describeHeardStep(
                          title,
                          planned,
                          results.find(item => item.stepId === step.id),
                        );
                  return (
                    <ListRow
                      key={step.id}
                      index={i + 1}
                      title={title}
                      subtitle={row.subtitle}
                      value={row.value}
                      valueColor={toneColor[row.tone]}
                      accessibilityLabel={row.spoken}
                      divided={i < steps.length - 1}
                      testID={`row-split-${i}`}
                    />
                  );
                })}
              </Card>
            </View>

            {/* A run in which nothing was heard has no timing to describe. */}
            {result !== null && result.results.length > 0 ? (
              <Typography
                variant="caption"
                color="textTertiary"
                style={styles.timingNote}
                testID="text-run-timing"
              >
                {timingNote(result)}
              </Typography>
            ) : null}
          </>
        )}
      </ScrollView>

      {drill === null ? null : (
        <View style={styles.mainAction}>
          <Button
            ref={startButtonRef}
            label={pending ? 'Cancel' : running ? 'Stop' : 'Start'}
            accessibilityLabel={
              pending ? 'Cancel start' : running ? 'Stop timer' : 'Start timer'
            }
            variant={pending ? 'secondary' : running ? 'stop' : 'primary'}
            size="main"
            leading={running ? <View style={styles.stopGlyph} /> : undefined}
            onPress={onPressStart}
            // Not while a run is being saved: it would replace the run.
            disabled={saving}
            testID="btn-start"
          />
        </View>
      )}
    </Screen>
  );
};
