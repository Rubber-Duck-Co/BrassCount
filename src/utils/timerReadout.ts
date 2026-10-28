/**
 * The words around the Timer's clock: the line at its top right and the
 * caption under the figure. Pure, so each state's wording is tested here
 * rather than through a whole run.
 *
 * Over par is not decided here: the clock box judges it on every tick
 * against the time it is showing, and its `OVER PAR` replaces the caption.
 */

import type { StartDelayRange } from '@/types/profile';

import { pluralize } from './format';
import { shownDeltaSign } from './history';

/** Where the run is, as far as the clock's wording goes. */
export type ClockPhase = 'ready' | 'pending' | 'running' | 'finished';

export type ClockReadout = {
  phase: ClockPhase;
  /** The drill's shot steps. */
  shotCount: number;
  /** The steps the run listens for: shots, reloads and racks. */
  plannedCount: number;
  /** How many of those have been heard. */
  heardCount: number;
  /** The drill's total par; `null` when a step has none. */
  drillPar: number | null;
  /** The finished run heard every step it listened for. */
  completed: boolean;
  /** The finished run's time; `null` until there is one. */
  totalTime: number | null;
  startDelay: StartDelayRange;
};

const MS_PER_SECOND = 1000;

/** `2000` → `2`, `2500` → `2.5`. */
const delaySeconds = (ms: number): string => `${ms / MS_PER_SECOND}`;

const shotsAndPar = ({ shotCount, drillPar }: ClockReadout): string => {
  const shots = pluralize(shotCount, 'shot').toUpperCase();
  return drillPar === null ? shots : `${shots} · PAR ${drillPar.toFixed(2)}`;
};

/** A completed run against its par, as it reads to the hundredth. */
const againstPar = (totalTime: number, drillPar: number): string => {
  const delta = totalTime - drillPar;
  const sign = shownDeltaSign(delta);
  if (sign === 0) {
    return 'ON PAR';
  }
  return `${Math.abs(delta).toFixed(2)} ${sign < 0 ? 'UNDER' : 'OVER'} PAR`;
};

/**
 * The line at the clock's top right: the drill's shots and par before a
 * run, the step being listened for during one (detection is level-only,
 * so a reload or rack counts as a step like a shot), and how it went after.
 */
export const clockMeta = (readout: ClockReadout): string => {
  const { phase, plannedCount, heardCount, drillPar, completed, totalTime } =
    readout;
  switch (phase) {
    case 'ready':
    case 'pending':
      return shotsAndPar(readout);
    case 'running':
      return plannedCount === 0
        ? shotsAndPar(readout)
        : `SHOT ${Math.min(heardCount + 1, plannedCount)} OF ${plannedCount}`;
    case 'finished':
      return completed && drillPar !== null && totalTime !== null
        ? againstPar(totalTime, drillPar)
        : `${heardCount} OF ${plannedCount} HEARD`;
  }
};

/** The caption under the clock's figure, unless the run is over par. */
export const clockCaption = ({
  phase,
  completed,
  startDelay,
}: ClockReadout): string => {
  if (phase === 'pending') {
    const { minMs, maxMs } = startDelay;
    const range =
      minMs === maxMs
        ? delaySeconds(minMs)
        : `${delaySeconds(minMs)}–${delaySeconds(maxMs)}`;
    return `WAIT FOR THE BEEP · ${range} S`;
  }
  if (phase === 'finished' && !completed) {
    return 'SECONDS · STOPPED EARLY';
  }
  return 'SECONDS';
};
