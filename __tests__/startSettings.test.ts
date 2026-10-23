import { DEFAULT_BEEP } from '../src/services/beepPlayer';
import { CAPTURE_CLOCK_SETTLE_MS } from '../src/types/audio';
import {
  DEFAULT_PROFILE,
  MAX_START_DELAY_MS,
  MIN_START_DELAY_MS,
  START_DELAY_STEP_MS,
} from '../src/types/profile';
import {
  BEEP_VOLUME_GAIN,
  describeStartDelay,
  formatStartDelay,
  isBeepVolume,
  isStartDelayMs,
  isStartDelayRange,
  spokenStartDelay,
  spokenStartDelayRange,
  stepStartDelay,
} from '../src/utils/startSettings';

describe('start delay bounds', () => {
  it('never offers a delay that beeps before the microphone clock has settled', () => {
    // The Timer opens the microphone, then waits this delay. A beep any
    // sooner would be timed against readings whose clock may still change.
    expect(MIN_START_DELAY_MS).toBeGreaterThanOrEqual(CAPTURE_CLOCK_SETTLE_MS);
  });

  it('runs from 1 to 10 s in half-second steps', () => {
    expect(MIN_START_DELAY_MS).toBe(1000);
    expect(MAX_START_DELAY_MS).toBe(10_000);
    expect(START_DELAY_STEP_MS).toBe(500);
  });

  it('starts every profile on a range that can be chosen', () => {
    expect(isStartDelayRange(DEFAULT_PROFILE.startDelay)).toBe(true);
  });
});

describe('isStartDelayMs', () => {
  it.each([1000, 1500, 5000, 10_000])('accepts %i', ms => {
    expect(isStartDelayMs(ms)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['below the shortest', 500],
    ['above the longest', 10_500],
    ['off the half-second steps', 1250],
    ['a fraction of a millisecond', 1000.5],
    ['not a number', '1000'],
    ['not finite', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('rejects a delay %s', (_case, ms) => {
    expect(isStartDelayMs(ms)).toBe(false);
  });
});

describe('isStartDelayRange', () => {
  it('accepts a range with its shortest end first', () => {
    expect(isStartDelayRange({ minMs: 1000, maxMs: 5000 })).toBe(true);
  });

  it('accepts equal ends, a fixed delay', () => {
    expect(isStartDelayRange({ minMs: 3000, maxMs: 3000 })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['its shortest end past its longest', { minMs: 3000, maxMs: 2000 }],
    ['a bad end', { minMs: 1000, maxMs: 1250 }],
    ['a missing end', { minMs: 1000 }],
    ['a bare number', 2000],
    ['null', null],
    ['a list', [1000, 2000]],
  ])('rejects %s', (_case, range) => {
    expect(isStartDelayRange(range)).toBe(false);
  });
});

describe('stepStartDelay', () => {
  it('moves half a second either way', () => {
    expect(stepStartDelay(2000, 1)).toBe(2500);
    expect(stepStartDelay(2000, -1)).toBe(1500);
  });

  it('stops at the bounds of any delay', () => {
    expect(stepStartDelay(MIN_START_DELAY_MS, -1)).toBe(MIN_START_DELAY_MS);
    expect(stepStartDelay(MAX_START_DELAY_MS, 1)).toBe(MAX_START_DELAY_MS);
  });

  it('stops at the bounds it is given, such as the other end of the range', () => {
    expect(stepStartDelay(3000, 1, MIN_START_DELAY_MS, 3000)).toBe(3000);
    expect(stepStartDelay(3000, -1, 3000, MAX_START_DELAY_MS)).toBe(3000);
  });
});

describe('describing a start delay', () => {
  it.each<[number, string, string]>([
    [1000, '1 s', '1 second'],
    [1500, '1.5 s', '1.5 seconds'],
    [10_000, '10 s', '10 seconds'],
  ])('shows %i ms as %s and says it as %s', (ms, shown, spoken) => {
    expect(formatStartDelay(ms)).toBe(shown);
    expect(spokenStartDelay(ms)).toBe(spoken);
  });

  it('calls a range with two ends random', () => {
    const range = { minMs: 1000, maxMs: 5000 };

    expect(describeStartDelay(range)).toBe('Random, 1 to 5 s');
    expect(spokenStartDelayRange(range)).toBe('Random, 1 to 5 seconds');
  });

  it('calls a range with equal ends fixed', () => {
    const range = { minMs: 2500, maxMs: 2500 };

    expect(describeStartDelay(range)).toBe('Fixed, 2.5 s');
    expect(spokenStartDelayRange(range)).toBe('Fixed, 2.5 seconds');
  });
});

describe('beep volumes', () => {
  it('halves the volume at each step down from full, about 6 dB apart', () => {
    expect(BEEP_VOLUME_GAIN).toEqual({ quiet: 0.25, medium: 0.5, full: 1 });
  });

  it('plays full at the start beep default volume', () => {
    expect(BEEP_VOLUME_GAIN.full).toBe(DEFAULT_BEEP.volume);
  });

  it('knows its presets and nothing else', () => {
    expect(isBeepVolume('medium')).toBe(true);
    expect(isBeepVolume('loud')).toBe(false);
    expect(isBeepVolume('max')).toBe(false);
    expect(isBeepVolume(1)).toBe(false);
  });
});
