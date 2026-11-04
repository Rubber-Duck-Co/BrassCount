import {
  MAX_DRILL_NAME_LENGTH,
  MAX_DRILL_STEPS,
  type DrillStep,
  type DrillStepType,
} from '@/types/drill';

import { isStepPar, roundPar } from './drill';
import { generateId as defaultGenerateId } from './id';

/**
 * The step list of a drill while it is being built in the editor. Pure
 * functions, no side effects: each takes the current steps and returns
 * the next ones, leaving the list it was given untouched, so the editor
 * can hand them straight to `setState`.
 *
 * A draft step has the stored shape (`DrillStep`). A step added here is
 * given its id up front, which is what keeps a row's identity stable as
 * the rows around it are removed, and the storage service keeps an id it
 * is handed.
 *
 * A draw can only be a drill's first step: it is timed from the beep (see
 * `planRun`). Nothing here makes a draw of any other step or moves one out
 * of first place, and only the first step's dropdown offers it. A drill
 * stored before that rule may still hold a draw further down; it is kept
 * as it is, and the storage service does not enforce the rule.
 */

/**
 * The step types the editor offers, in the order its dropdown lists them.
 *
 * `transition` is left out on purpose. It is still a type the storage
 * service accepts, so a stored drill can hold one — see
 * `stepTypeChoices`.
 */
export const EDITOR_STEP_TYPES = [
  'draw',
  'shot',
  'reload',
  'rack',
  'holster',
] as const satisfies readonly DrillStepType[];

/** Whether a step at `position` may be a draw: only the first may. */
const drawAllowedAt = (position: number): boolean => position === 0;

/**
 * The types the dropdown of the step at `position` offers: the editor's
 * list, without `draw` past the first step, plus the step's own type when
 * that is not on it. Without that, a stored `transition` step, or a draw
 * stored further down a drill, would show as a blank dropdown and silently
 * change type the first time it was opened.
 */
export const stepTypeChoices = (
  current: DrillStepType,
  position: number,
): readonly DrillStepType[] => {
  const offered = drawAllowedAt(position)
    ? EDITOR_STEP_TYPES
    : EDITOR_STEP_TYPES.filter(type => type !== 'draw');
  return offered.some(type => type === current)
    ? offered
    : [...offered, current];
};

/**
 * The type a step added to `steps` starts as: a draw to open the string,
 * a shot after that. Either can be changed from the step's dropdown.
 */
export const nextStepType = (
  steps: readonly Pick<DrillStep, 'type'>[],
): DrillStepType => (steps.length === 0 ? 'draw' : 'shot');

/** Whether `steps` has room for another step. */
export const canAddStep = (steps: readonly DrillStep[]): boolean =>
  steps.length < MAX_DRILL_STEPS;

/**
 * `steps` with a new, untimed step at the end. A list that already holds
 * `MAX_DRILL_STEPS` comes back unchanged.
 */
export const addStep = (
  steps: readonly DrillStep[],
  generateId: () => string = defaultGenerateId,
): readonly DrillStep[] =>
  canAddStep(steps)
    ? [...steps, { id: generateId(), type: nextStepType(steps) }]
    : steps;

/** `steps` without the step that has this id. */
export const removeStep = (
  steps: readonly DrillStep[],
  id: string,
): readonly DrillStep[] => steps.filter(step => step.id !== id);

/**
 * Whether `moveStep` would move the step that has this id to `toPosition`:
 * the step is in the list, the position is one the list has and is not
 * where the step already is, and the move keeps a draw in first place —
 * it neither takes the draw out of it nor puts another step above it.
 */
export const canMoveStep = (
  steps: readonly DrillStep[],
  id: string,
  toPosition: number,
): boolean => {
  const from = steps.findIndex(step => step.id === id);
  const inRange =
    Number.isInteger(toPosition) &&
    toPosition >= 0 &&
    toPosition < steps.length;
  if (from < 0 || !inRange || from === toPosition) {
    return false;
  }
  const opensWithDraw = steps[0].type === 'draw';
  return !opensWithDraw || (from !== 0 && toPosition !== 0);
};

/**
 * `steps` with the step that has this id moved to `toPosition`, counted
 * from 0, and the steps between shifted along to make room. The step
 * itself is kept as it is — id, type and par — so only the order changes.
 *
 * A move `canMoveStep` refuses — an id that is not in the list, a
 * position the list does not have, or one that would move a draw out of
 * first place — gives back `steps` unchanged.
 */
export const moveStep = (
  steps: readonly DrillStep[],
  id: string,
  toPosition: number,
): readonly DrillStep[] => {
  if (!canMoveStep(steps, id, toPosition)) {
    return steps;
  }
  const from = steps.findIndex(step => step.id === id);

  const without = steps.filter((_, i) => i !== from);
  return [
    ...without.slice(0, toPosition),
    steps[from],
    ...without.slice(toPosition),
  ];
};

/**
 * `steps` with the type of one step changed; its par is kept. Making any
 * step but the first a draw gives back `steps` unchanged.
 */
export const changeStepType = (
  steps: readonly DrillStep[],
  id: string,
  type: DrillStepType,
): readonly DrillStep[] => {
  const position = steps.findIndex(step => step.id === id);
  if (type === 'draw' && !drawAllowedAt(position)) {
    return steps;
  }
  return steps.map(step => (step.id === id ? { ...step, type } : step));
};

/**
 * `steps` with the par of one step set, or cleared when `par` is
 * `undefined`. An untimed step carries no `par` key at all, the way the
 * storage service writes one.
 *
 * Throws `RangeError` for a par the storage service would reject. Pars
 * typed by the shooter go through `parseParInput` first, so reaching
 * that is a caller bug.
 */
export const setStepPar = (
  steps: readonly DrillStep[],
  id: string,
  par: number | undefined,
): readonly DrillStep[] => {
  if (par !== undefined && !isStepPar(par)) {
    throw new RangeError('A step par must be a usable number of seconds');
  }

  return steps.map(step => {
    if (step.id !== id) {
      return step;
    }
    return par === undefined
      ? { id: step.id, type: step.type }
      : { id: step.id, type: step.type, par };
  });
};

// Plain digits with at most one decimal separator: "1", "1.", "1.25",
// ".5". A comma is accepted too, since that is what the decimal keypad
// types in a locale that writes 0,25.
const PAR_INPUT_PATTERN = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

/**
 * The par a shooter typed, in seconds rounded to the hundredth, or `null`
 * when the text is not a par the storage service would accept: not a
 * number, zero once rounded, or over `MAX_STEP_PAR_SECONDS`.
 *
 * A comma is always the decimal separator, never a thousands one:
 * "1,000" is one second.
 */
export const parseParInput = (text: string): number | null => {
  const trimmed = text.trim();
  if (!PAR_INPUT_PATTERN.test(trimmed)) {
    return null;
  }

  const seconds = roundPar(Number(trimmed.replace(',', '.')));
  return isStepPar(seconds) ? seconds : null;
};

/**
 * One reason a draft cannot be saved yet. A missing name and an empty
 * step list are what a shooter runs into building a drill; the editor's
 * own limits (the name field's length, `addStep`) keep a draft clear of
 * the other two.
 */
export type DrillDraftProblem =
  'name-missing' | 'name-too-long' | 'no-steps' | 'too-many-steps';

/**
 * Everything that stops a draft from being saved, the name's problem
 * before the steps', or an empty list when the storage service would
 * accept it. The service still enforces the same rules on save; this is
 * what lets the editor say what is missing before the shooter tries.
 *
 * The name is measured the way it is stored: trimmed. A step's type, par
 * and id are not checked here — the functions above only ever produce
 * steps the service accepts.
 */
export const drillDraftProblems = (
  name: string,
  steps: readonly DrillStep[],
): readonly DrillDraftProblem[] => {
  const problems: DrillDraftProblem[] = [];
  const storedName = name.trim();

  if (storedName.length === 0) {
    problems.push('name-missing');
  } else if (storedName.length > MAX_DRILL_NAME_LENGTH) {
    problems.push('name-too-long');
  }

  if (steps.length === 0) {
    problems.push('no-steps');
  } else if (steps.length > MAX_DRILL_STEPS) {
    problems.push('too-many-steps');
  }

  return problems;
};
