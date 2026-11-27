import type { DrillStepInput, PresetDrill } from '@/types/drill';

/**
 * The standard drills the Presets screen offers, to start a library from.
 * This is seed data, not a display fixture: nothing here is shown in place
 * of stored drills, and a preset reaches storage only when the shooter adds
 * it, as a copy of their own.
 *
 * Step lists follow each drill's description. A drill opens with a draw;
 * the shot that ends it is timed from the beep too (`timedSteps`), so its
 * par matches the draw's. A transition carries the swing to the next
 * target; a reload is the slide-lock reload heard on its own.
 *
 * The pars are starting values, there to be edited on the drill saved from
 * a preset. Shot counts and total pars are always derived from the steps
 * (`countShots`, `totalPar`), never written here.
 */

/** `count` shots in a row, each with the same par. */
const shots = (count: number, par: number): DrillStepInput[] =>
  Array.from({ length: count }, () => ({ type: 'shot', par }));

export const PRESET_DRILLS: readonly PresetDrill[] = [
  {
    id: 'bill-drill',
    description: 'Six shots on one target, straight from the holster.',
    drill: {
      name: 'Bill Drill',
      steps: [
        { type: 'draw', par: 1.2 },
        { type: 'shot', par: 1.2 },
        ...shots(5, 0.12),
      ],
    },
  },
  {
    id: 'el-presidente',
    description: 'Two on each of three targets, reload, two on each again.',
    drill: {
      name: 'El Presidente',
      steps: [
        { type: 'draw', par: 2 },
        { type: 'shot', par: 2 },
        { type: 'shot', par: 0.25 },
        { type: 'transition', par: 0.4 },
        ...shots(2, 0.25),
        { type: 'transition', par: 0.4 },
        ...shots(2, 0.25),
        { type: 'reload', par: 1.6 },
        { type: 'shot', par: 0.3 },
        { type: 'shot', par: 0.25 },
        { type: 'transition', par: 0.4 },
        ...shots(2, 0.25),
        { type: 'transition', par: 0.4 },
        ...shots(2, 0.25),
      ],
    },
  },
  {
    id: 'failure-to-stop',
    description: 'Two to the body, one to the head.',
    drill: {
      name: 'Failure to Stop',
      steps: [
        { type: 'draw', par: 1 },
        { type: 'shot', par: 1 },
        { type: 'shot', par: 0.2 },
        { type: 'shot', par: 0.3 },
      ],
    },
  },
  {
    id: 'fast',
    description: 'Two to the head, slide-lock reload, four to the body.',
    drill: {
      name: 'F.A.S.T.',
      steps: [
        { type: 'draw', par: 1.2 },
        { type: 'shot', par: 1.2 },
        { type: 'shot', par: 0.25 },
        { type: 'reload', par: 1.5 },
        { type: 'shot', par: 0.25 },
        ...shots(3, 0.2),
      ],
    },
  },
  {
    id: 'one-reload-one',
    description: 'One shot, slide-lock reload, one more shot.',
    drill: {
      name: '1-Reload-1',
      steps: [
        { type: 'draw', par: 1.2 },
        { type: 'shot', par: 1.2 },
        { type: 'reload', par: 1.3 },
        { type: 'shot', par: 0.3 },
      ],
    },
  },
];
