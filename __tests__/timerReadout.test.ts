import {
  clockCaption,
  clockMeta,
  type ClockReadout,
} from '../src/utils/timerReadout';

const base: ClockReadout = {
  phase: 'ready',
  shotCount: 6,
  plannedCount: 6,
  heardCount: 0,
  drillPar: 3.3,
  completed: false,
  totalTime: null,
  startDelay: { minMs: 2000, maxMs: 4000 },
};

describe('clockMeta', () => {
  it('gives the shots and par before a run', () => {
    expect(clockMeta(base)).toBe('6 SHOTS · PAR 3.30');
  });

  it('keeps the shots and par while waiting for the beep', () => {
    expect(clockMeta({ ...base, phase: 'pending' })).toBe('6 SHOTS · PAR 3.30');
  });

  it('leaves the par out when the drill has none', () => {
    expect(clockMeta({ ...base, shotCount: 1, drillPar: null })).toBe('1 SHOT');
  });

  it('counts the step it is listening for while running', () => {
    expect(clockMeta({ ...base, phase: 'running', heardCount: 4 })).toBe(
      'SHOT 5 OF 6',
    );
  });

  it('never counts past the last step while running', () => {
    expect(clockMeta({ ...base, phase: 'running', heardCount: 6 })).toBe(
      'SHOT 6 OF 6',
    );
  });

  it('says how far under par a completed run came in', () => {
    expect(
      clockMeta({
        ...base,
        phase: 'finished',
        heardCount: 6,
        completed: true,
        totalTime: 2.87,
      }),
    ).toBe('0.43 UNDER PAR');
  });

  it('says how far over par a completed run went', () => {
    expect(
      clockMeta({
        ...base,
        phase: 'finished',
        heardCount: 6,
        completed: true,
        totalTime: 3.35,
      }),
    ).toBe('0.05 OVER PAR');
  });

  it('calls a completed run that reads the same as its par on par', () => {
    expect(
      clockMeta({
        ...base,
        phase: 'finished',
        heardCount: 6,
        completed: true,
        totalTime: 3.302,
      }),
    ).toBe('ON PAR');
  });

  it('counts what was heard of a run stopped early', () => {
    expect(
      clockMeta({
        ...base,
        phase: 'finished',
        heardCount: 3,
        totalTime: 2.21,
      }),
    ).toBe('3 OF 6 HEARD');
  });

  it('counts what was heard of a completed run with no par', () => {
    expect(
      clockMeta({
        ...base,
        phase: 'finished',
        heardCount: 6,
        completed: true,
        totalTime: 2.5,
        drillPar: null,
      }),
    ).toBe('6 OF 6 HEARD');
  });
});

describe('clockCaption', () => {
  it('reads SECONDS before and during a run', () => {
    expect(clockCaption(base)).toBe('SECONDS');
    expect(clockCaption({ ...base, phase: 'running' })).toBe('SECONDS');
  });

  it('gives the start delay range while waiting for the beep', () => {
    expect(clockCaption({ ...base, phase: 'pending' })).toBe(
      'WAIT FOR THE BEEP · 2–4 S',
    );
  });

  it('gives a fixed start delay as one figure', () => {
    expect(
      clockCaption({
        ...base,
        phase: 'pending',
        startDelay: { minMs: 2500, maxMs: 2500 },
      }),
    ).toBe('WAIT FOR THE BEEP · 2.5 S');
  });

  it('says a finished run was stopped early', () => {
    expect(clockCaption({ ...base, phase: 'finished', totalTime: 1.4 })).toBe(
      'SECONDS · STOPPED EARLY',
    );
  });

  it('reads SECONDS for a completed run', () => {
    expect(
      clockCaption({
        ...base,
        phase: 'finished',
        completed: true,
        totalTime: 2.87,
      }),
    ).toBe('SECONDS');
  });
});
