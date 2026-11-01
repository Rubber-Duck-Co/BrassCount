import type { DrillStep } from '../src/types/drill';
import type { StepResult } from '../src/types/run';
import type { SessionSplit } from '../src/types/session';
import { planRun } from '../src/utils/runDetection';
import {
  describeSavedSplits,
  describeSplits,
  type SplitStage,
} from '../src/utils/splitRows';

/** A draw, two shots with pars, and a holster with nothing heard after it. */
const STEPS: DrillStep[] = [
  { id: 'draw', type: 'draw', par: 1.5 },
  { id: 'shot-1', type: 'shot', par: 0.25 },
  { id: 'shot-2', type: 'shot', par: 0.2 },
  { id: 'holster', type: 'holster' },
];

const rowsAt = (
  stage: SplitStage,
  results: StepResult[] = [],
  steps: DrillStep[] = STEPS,
) => describeSplits({ steps, plan: planRun(steps), results, stage });

describe('describeSplits', () => {
  it('shows a silent step with a par as counted with the next step', () => {
    const [draw] = rowsAt('before');

    expect(draw).toEqual({
      stepId: 'draw',
      label: 'Draw',
      par: '1.50',
      time: '—',
      delta: 'with next',
      deltaTone: 'note',
      spoken:
        'Draw, not timed. Its par of 1.5 seconds counts towards the next step',
    });
  });

  it('judges a heard step against its own par plus the silent steps before it', () => {
    const [, shot] = rowsAt('before');

    expect(shot).toEqual({
      stepId: 'shot-1',
      label: 'Shot 1',
      par: '1.75',
      time: '—',
      delta: '',
      deltaTone: 'note',
      spoken: 'Shot 1, par 1.75 seconds, not heard yet',
    });
  });

  it('shows a silent step with nothing heard after it as not timed', () => {
    const holster = rowsAt('before')[3];

    expect(holster).toMatchObject({
      label: 'Holster',
      par: '—',
      delta: 'not timed',
      deltaTone: 'note',
      spoken: 'Holster, not timed',
    });
  });

  it('marks only the step being listened for during a run', () => {
    const rows = rowsAt('listening', [
      { stepId: 'shot-1', par: 1.75, actual: 1.4, delta: -0.35 },
    ]);

    expect(rows[2]).toMatchObject({
      delta: 'listening',
      deltaTone: 'note',
      spoken: 'Shot 2, par 0.2 seconds, listening',
    });
    expect(rows.filter(row => row.delta === 'listening')).toHaveLength(1);
  });

  it('marks nothing as listening before the run has started', () => {
    expect(rowsAt('before').some(row => row.delta === 'listening')).toBe(false);
  });

  it('says a step the finished run never heard was not heard', () => {
    const rows = rowsAt('finished', [
      { stepId: 'shot-1', par: 1.75, actual: 1.4, delta: -0.35 },
    ]);

    expect(rows[2]).toMatchObject({
      time: '—',
      delta: 'not heard',
      spoken: 'Shot 2, par 0.2 seconds, not heard',
    });
  });

  it('shows a step under par with a true minus sign and in plain figures', () => {
    const [, shot] = rowsAt('listening', [
      { stepId: 'shot-1', par: 1.75, actual: 1.4, delta: -0.35 },
    ]);

    expect(shot).toMatchObject({
      time: '1.40',
      delta: '−0.35',
      deltaTone: 'figure',
      spoken:
        'Shot 1, par 1.75 seconds, took 1.4 seconds, 0.35 seconds under par',
    });
  });

  it('shows a step over par with a plus sign, toned as over', () => {
    const rows = rowsAt('listening', [
      { stepId: 'shot-1', par: 1.75, actual: 1.4, delta: -0.35 },
      { stepId: 'shot-2', par: 0.2, actual: 0.3, delta: 0.1 },
    ]);

    expect(rows[2]).toMatchObject({
      time: '0.30',
      delta: '+0.10',
      deltaTone: 'over',
      spoken: 'Shot 2, par 0.2 seconds, took 0.3 seconds, 0.1 seconds over par',
    });
  });

  it('shows a step on par as no difference, not as over', () => {
    const [, shot] = rowsAt('listening', [
      // Two thousandths over still reads as the par itself.
      { stepId: 'shot-1', par: 1.75, actual: 1.752, delta: 0.002 },
    ]);

    expect(shot).toMatchObject({
      time: '1.75',
      delta: '0.00',
      deltaTone: 'figure',
      spoken: 'Shot 1, par 1.75 seconds, took 1.75 seconds, on par',
    });
  });

  it('leaves the difference blank for a heard step with no par', () => {
    const steps: DrillStep[] = [
      { id: 'shot-1', type: 'shot' },
      { id: 'rack', type: 'rack' },
    ];

    const rows = rowsAt(
      'finished',
      [
        { stepId: 'shot-1', actual: 0.9, delta: null },
        { stepId: 'rack', actual: 1.2, delta: null },
      ],
      steps,
    );

    expect(rows[1]).toEqual({
      stepId: 'rack',
      label: 'Rack',
      par: '—',
      time: '1.20',
      delta: '',
      deltaTone: 'note',
      spoken: 'Rack, no par, took 1.2 seconds',
    });
  });

  it('numbers each step among the steps of its type', () => {
    const labels = rowsAt('before').map(row => row.label);

    expect(labels).toEqual(['Draw', 'Shot 1', 'Shot 2', 'Holster']);
  });
});

describe('describeSavedSplits', () => {
  const split = (
    par: number | undefined,
    actual: number,
    delta: number | null,
  ): SessionSplit => ({ stepId: 'step', label: 'Shot 1', par, actual, delta });

  it('shows a step under par in plain figures with a true minus sign', () => {
    const [row] = describeSavedSplits([split(1.5, 1.32, -0.18)]);

    expect(row).toEqual({
      stepId: 'step',
      label: 'Shot 1',
      par: '1.50',
      time: '1.32',
      delta: '−0.18',
      deltaTone: 'figure',
      spoken:
        'Shot 1, par 1.5 seconds, took 1.32 seconds, 0.18 seconds under par',
    });
  });

  it('shows a step over par with a plus sign, toned as over', () => {
    const [row] = describeSavedSplits([split(0.25, 0.31, 0.06)]);

    expect(row.delta).toBe('+0.06');
    expect(row.deltaTone).toBe('over');
    expect(row.spoken).toBe(
      'Shot 1, par 0.25 seconds, took 0.31 seconds, 0.06 seconds over par',
    );
  });

  it('shows a step on par as no difference, not as over', () => {
    const [row] = describeSavedSplits([split(0.5, 0.504, 0.004)]);

    expect(row.delta).toBe('0.00');
    expect(row.deltaTone).toBe('figure');
    expect(row.spoken).toBe(
      'Shot 1, par 0.5 seconds, took 0.5 seconds, on par',
    );
  });

  it('shows a dash for the par and the difference of a step with no par', () => {
    const [row] = describeSavedSplits([split(undefined, 1.5, null)]);

    expect(row).toMatchObject({
      par: '—',
      time: '1.50',
      delta: '—',
      deltaTone: 'note',
      spoken: 'Shot 1, no par, took 1.5 seconds',
    });
  });

  it('keeps the steps in the order they were run', () => {
    const rows = describeSavedSplits([
      { stepId: 'a', label: 'Draw', par: 1.5, actual: 1.4, delta: -0.1 },
      { stepId: 'b', label: 'Shot 1', actual: 0.3, delta: null },
    ]);

    expect(rows.map(row => row.label)).toEqual(['Draw', 'Shot 1']);
  });
});
