import {
  BEEP_VOLUMES,
  MAX_START_DELAY_MS,
  MIN_START_DELAY_MS,
  START_DELAY_STEP_MS,
  type BeepVolume,
  type StartDelayRange,
} from '@/types/profile';

import { isRecord } from './guards';

/**
 * Rules for the timer settings: the range the random start delay comes
 * from, and the beep volume presets. Shared by the profile service, which
 * enforces them on save and read, the Settings pickers, and the run hook
 * that turns them into start-sequence options.
 */

/**
 * The gain each beep volume plays at, on the 0 to 1 scale the beep player
 * takes. Each step is half the one above, about 6 dB, which is a clear
 * difference through a phone speaker; closer steps (an earlier 0.9 and
 * 1.0) could not be told apart on a device. `full` is the start beep's
 * `DEFAULT_BEEP` volume.
 */
export const BEEP_VOLUME_GAIN: Readonly<Record<BeepVolume, number>> =
  Object.freeze({ quiet: 0.25, medium: 0.5, full: 1 });

export const isBeepVolume = (value: unknown): value is BeepVolume =>
  BEEP_VOLUMES.some(volume => volume === value);

/** A delay that can be chosen: on a step, and within the bounds. */
export const isStartDelayMs = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_START_DELAY_MS &&
  value <= MAX_START_DELAY_MS &&
  value % START_DELAY_STEP_MS === 0;

/**
 * A range that can be stored: both ends a delay that can be chosen, and
 * the shortest no longer than the longest. Equal ends are a fixed delay.
 */
export const isStartDelayRange = (value: unknown): value is StartDelayRange =>
  isRecord(value) &&
  isStartDelayMs(value.minMs) &&
  isStartDelayMs(value.maxMs) &&
  value.minMs <= value.maxMs;

/**
 * One step longer (`+1`) or shorter (`-1`) than `ms`, held within
 * `floorMs` and `ceilingMs` (by default the bounds of any delay). The
 * pickers pass the other end of the range as a bound, so the shortest can
 * never pass the longest.
 */
export const stepStartDelay = (
  ms: number,
  direction: 1 | -1,
  floorMs: number = MIN_START_DELAY_MS,
  ceilingMs: number = MAX_START_DELAY_MS,
): number =>
  Math.min(ceilingMs, Math.max(floorMs, ms + direction * START_DELAY_STEP_MS));

/** A delay in seconds as shown: `1`, `1.5`, `10`. */
const seconds = (ms: number): string => String(ms / 1000);

/** A delay as shown on its own: `1.5 s`. */
export const formatStartDelay = (ms: number): string => `${seconds(ms)} s`;

/** A delay as a screen reader should say it: `1.5 seconds`, `1 second`. */
export const spokenStartDelay = (ms: number): string =>
  `${seconds(ms)} ${ms === 1000 ? 'second' : 'seconds'}`;

/** What a range is called in Settings: `Random, 1 to 5 s` or `Fixed, 2 s`. */
export const describeStartDelay = ({
  minMs,
  maxMs,
}: StartDelayRange): string =>
  minMs === maxMs
    ? `Fixed, ${formatStartDelay(minMs)}`
    : `Random, ${seconds(minMs)} to ${formatStartDelay(maxMs)}`;

/** `describeStartDelay` as a screen reader should say it. */
export const spokenStartDelayRange = ({
  minMs,
  maxMs,
}: StartDelayRange): string =>
  minMs === maxMs
    ? `Fixed, ${spokenStartDelay(minMs)}`
    : `Random, ${seconds(minMs)} to ${spokenStartDelay(maxMs)}`;
