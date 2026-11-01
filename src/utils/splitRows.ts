/**
 * The rows of the Timer's splits table: STEP / PAR / TIME / Δ, one per
 * drill step. Pure, so each row's wording is tested here rather than
 * through a whole run.
 *
 * A step the timer listens for (a shot, reload or rack) is judged against
 * its planned par: its own plus that of every silent step before it (see
 * `planRun`). A silent step (draw, transition, holster) is never timed; its
 * Δ column says whether its par is carried into the next heard step.
 *
 * Under, on or over par is decided as the figure reads to the hundredth
 * (`shownDeltaSign`), so a row is never toned over par while it shows 0.00.
 *
 * The Log's run cards use the same table for a saved run
 * (`describeSavedSplits`), so a run reads the same before and after it is
 * saved.
 */

import type { DrillStep } from '@/types/drill';
import type { RunStep, StepResult } from '@/types/run';
import type { SessionSplit } from '@/types/session';

import { stepLabel } from './drill';
import { spokenSeconds } from './format';
import { shownDeltaSign } from './history';

/**
 * Where the run is. `before`: nothing is being listened for yet, as while
 * waiting for the beep. `listening`: the run is on, and the next step not
 * yet heard is marked. `finished`: a step not heard by now never was.
 */
export type SplitStage = 'before' | 'listening' | 'finished';

/**
 * How the Δ column is drawn: `figure` a difference in plain figures,
 * `over` a difference over par (in Signal), `note` a small grey caption.
 */
export type SplitDeltaTone = 'figure' | 'over' | 'note';

export type SplitRow = {
  stepId: string;
  /** `Shot 2`, numbered among the steps of its type. */
  label: string;
  par: string;
  time: string;
  delta: string;
  deltaTone: SplitDeltaTone;
  /** The row as a screen reader should say it. */
  spoken: string;
};

type DescribeSplitsInput = {
  steps: readonly DrillStep[];
  /** The steps the run listens for, from `planRun(steps)`. */
  plan: readonly RunStep[];
  /** The steps heard so far. */
  results: readonly StepResult[];
  stage: SplitStage;
};

/** What a column shows when it has no figure. */
export const NO_FIGURE = '—';

export const WITH_NEXT = 'with next';
export const LISTENING = 'listening';
export const NOT_HEARD = 'not heard';
export const NOT_TIMED = 'not timed';

/** A true minus sign, so the column's figures line up and read as one. */
const MINUS = '−';

const figure = (seconds: number): string => seconds.toFixed(2);

/** A length of time said to the hundredth, the figure the table shows. */
const speak = (seconds: number): string =>
  spokenSeconds(Number(Math.abs(seconds).toFixed(2)));

/** A step the timer cannot hear: a draw, a transition, a holster. */
const silentRow = (
  label: string,
  step: DrillStep,
  countsTowardsNext: boolean,
): SplitRow => {
  const par = step.par === undefined ? NO_FIGURE : figure(step.par);
  if (step.par === undefined || !countsTowardsNext) {
    return {
      stepId: step.id,
      label,
      par,
      time: NO_FIGURE,
      delta: NOT_TIMED,
      deltaTone: 'note',
      spoken: `${label}, not timed`,
    };
  }
  return {
    stepId: step.id,
    label,
    par,
    time: NO_FIGURE,
    delta: WITH_NEXT,
    deltaTone: 'note',
    spoken: `${label}, not timed. Its par of ${speak(step.par)} counts towards the next step`,
  };
};

/** Δ and its wording for a step that was heard. */
const againstPar = (
  delta: number | null,
): Pick<SplitRow, 'delta' | 'deltaTone'> & { spoken: string | null } => {
  if (delta === null) {
    return { delta: '', deltaTone: 'note', spoken: null };
  }
  const sign = shownDeltaSign(delta);
  if (sign === 0) {
    return { delta: figure(0), deltaTone: 'figure', spoken: 'on par' };
  }
  const size = figure(Math.abs(delta));
  return sign < 0
    ? {
        delta: `${MINUS}${size}`,
        deltaTone: 'figure',
        spoken: `${speak(delta)} under par`,
      }
    : {
        delta: `+${size}`,
        deltaTone: 'over',
        spoken: `${speak(delta)} over par`,
      };
};

/** Δ and its wording for a step the run listens for but has not heard. */
const unheard = (
  stage: SplitStage,
  isNext: boolean,
): { delta: string; spoken: string } => {
  if (stage === 'finished') {
    return { delta: NOT_HEARD, spoken: 'not heard' };
  }
  if (stage === 'listening' && isNext) {
    return { delta: LISTENING, spoken: 'listening' };
  }
  return { delta: '', spoken: 'not heard yet' };
};

/** A step the timer listens for, before or after it has been heard. */
const heardRow = (
  label: string,
  planned: RunStep,
  result: StepResult | undefined,
  stage: SplitStage,
  isNext: boolean,
): SplitRow => {
  const par = planned.par === undefined ? NO_FIGURE : figure(planned.par);
  const spokenPar =
    planned.par === undefined ? 'no par' : `par ${speak(planned.par)}`;

  if (result === undefined) {
    const { delta, spoken } = unheard(stage, isNext);
    return {
      stepId: planned.stepId,
      label,
      par,
      time: NO_FIGURE,
      delta,
      deltaTone: 'note',
      spoken: `${label}, ${spokenPar}, ${spoken}`,
    };
  }

  const judged = againstPar(result.delta);
  const took = `took ${speak(result.actual)}`;
  return {
    stepId: planned.stepId,
    label,
    par,
    time: figure(result.actual),
    delta: judged.delta,
    deltaTone: judged.deltaTone,
    spoken: [label, spokenPar, took, judged.spoken]
      .filter(part => part !== null)
      .join(', '),
  };
};

/**
 * The rows of a saved run, as the Log shows it: one per split, in the
 * order they were run. A split carries its own label, par and difference,
 * so nothing is worked out again; a step with no par shows a dash for
 * both the par and the difference.
 */
export const describeSavedSplits = (
  splits: readonly SessionSplit[],
): SplitRow[] =>
  splits.map(({ stepId, label, par, actual, delta }) => {
    const took = `took ${speak(actual)}`;
    const time = figure(actual);
    if (par === undefined || delta === null) {
      return {
        stepId,
        label,
        par: par === undefined ? NO_FIGURE : figure(par),
        time,
        delta: NO_FIGURE,
        deltaTone: 'note',
        spoken: `${label}, no par, ${took}`,
      };
    }
    const judged = againstPar(delta);
    return {
      stepId,
      label,
      par: figure(par),
      time,
      delta: judged.delta,
      deltaTone: judged.deltaTone,
      spoken: `${label}, par ${speak(par)}, ${took}, ${judged.spoken}`,
    };
  });

/** One row per step of the drill, in order. */
export const describeSplits = ({
  steps,
  plan,
  results,
  stage,
}: DescribeSplitsInput): SplitRow[] => {
  const heardIds = new Set(results.map(item => item.stepId));
  // The first planned step not yet heard is the one being listened for.
  const nextId = plan.find(item => !heardIds.has(item.stepId))?.stepId;

  return steps.map((step, i) => {
    const label = stepLabel(steps, i);
    const planned = plan.find(item => item.stepId === step.id);
    if (planned === undefined) {
      const countsTowardsNext = steps
        .slice(i + 1)
        .some(later => plan.some(item => item.stepId === later.id));
      return silentRow(label, step, countsTowardsNext);
    }
    return heardRow(
      label,
      planned,
      results.find(item => item.stepId === step.id),
      stage,
      step.id === nextId,
    );
  });
};
