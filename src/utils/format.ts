/** Presentation-layer formatters. Pure functions, no side effects. */

import type { LevelUnit } from '@/types/profile';

import { MIN_SAMPLE_DBFS } from './calibration';

/**
 * Seconds → `M:SS.hh` while a drill runs, or `S.hh` under a minute so the
 * timer stays readable at a glance.
 */
export const formatElapsed = (totalSeconds: number): string => {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe - minutes * 60;

  if (minutes === 0) {
    return seconds.toFixed(2);
  }

  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
};

/** Seconds → `1.24s`, for split and result rows. */
export const formatSeconds = (seconds: number): string =>
  `${seconds.toFixed(2)}s`;

/**
 * A duration as a screen reader should say it: `0.25 seconds`, `1 second`.
 * A bare `0.25s` is read as a number and a stray letter.
 */
export const spokenSeconds = (seconds: number): string =>
  `${seconds} second${seconds === 1 ? '' : 's'}`;

/** Highest value on the 0–100 level scale: a full-scale (0 dBFS) sound. */
const LEVEL_SCALE_MAX = 100;

/**
 * A dBFS reading → the 0–100 level scale: `MIN_SAMPLE_DBFS` (the quietest
 * sound calibration counts) is 0 and full scale is 100, linear in dB
 * between them. Clamped to the scale and rounded to a whole number.
 */
export const dbfsToLevel = (dbfs: number): number => {
  const ratio = (dbfs - MIN_SAMPLE_DBFS) / -MIN_SAMPLE_DBFS;
  const clamped = Math.min(1, Math.max(0, ratio));
  // `+ 0` turns any -0 from rounding into a plain 0.
  return Math.round(clamped * LEVEL_SCALE_MAX) + 0;
};

/** A dBFS reading rounded to a whole decibel, never -0. */
const wholeDbfs = (dbfs: number): number => Math.round(dbfs) + 0;

/**
 * A dBFS reading in the shooter's chosen unit: `72` on the level scale or
 * `-12 dBFS`. `—` when there is none.
 */
export const formatLevel = (dbfs: number | null, unit: LevelUnit): string => {
  if (dbfs === null) {
    return '—';
  }
  return unit === 'level' ? `${dbfsToLevel(dbfs)}` : `${wholeDbfs(dbfs)} dBFS`;
};

/**
 * The same level as a screen reader should say it: `level 72`, or
 * `minus 12 decibels full scale`. A bare `-12 dBFS` is announced
 * inconsistently, and `—` not at all.
 */
export const spokenLevel = (dbfs: number | null, unit: LevelUnit): string => {
  if (dbfs === null) {
    return 'not set';
  }
  if (unit === 'level') {
    return `level ${dbfsToLevel(dbfs)}`;
  }
  const rounded = wholeDbfs(dbfs);
  return `${rounded < 0 ? 'minus ' : ''}${Math.abs(rounded)} decibels full scale`;
};

/** ISO-8601 → `15 Aug 2026`. */
export const formatDate = (iso: string): string => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * A difference in seconds with its sign: `+0.12s`, `-0.08s`. One that
 * rounds to nothing reads `0.00s`, never `-0.00s`.
 */
export const formatSignedSeconds = (seconds: number): string => {
  const shown = seconds.toFixed(2);
  const value = Number(shown);

  if (value === 0) {
    return '0.00s';
  }
  return `${value > 0 ? '+' : ''}${shown}s`;
};

/** A true minus sign, so signed figures line up in a column and read as one. */
const MINUS = '−';

/**
 * A difference in seconds as a table figure, with no unit: `+0.11`,
 * `−0.01` with a true minus. One that rounds to nothing reads `0.00`.
 */
export const formatSignedFigure = (seconds: number): string => {
  const shown = Math.abs(seconds).toFixed(2);

  if (Number(shown) === 0) {
    return shown;
  }
  return `${seconds > 0 ? '+' : MINUS}${shown}`;
};

/** The time of day of a valid date, in the device's own 12 or 24 hour form. */
const timeOfDay = (date: Date): string =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** ISO-8601 → `15 Aug 2026 · 14:32`. `—` when the text is not a time. */
export const formatDateTime = (iso: string): string => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return `${formatDate(iso)} · ${timeOfDay(date)}`;
};

/**
 * The same as a screen reader should say it: `15 August 2026 at 14:32`. The
 * short month and the dot between the two halves are not read out well.
 */
export const spokenDateTime = (iso: string): string => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return 'an unknown date';
  }

  const day = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${day} at ${timeOfDay(date)}`;
};

/** `3` → `3 drills`, `1` → `1 drill`. */
export const pluralize = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * The units a time ago is counted in, largest first. A month is 30 days
 * and a year 365: close enough for "about how long ago".
 */
const TIME_AGO_UNITS = [
  { name: 'year', short: 'y', ms: 365 * MS_PER_DAY },
  { name: 'month', short: 'mo', ms: 30 * MS_PER_DAY },
  { name: 'week', short: 'w', ms: 7 * MS_PER_DAY },
  { name: 'day', short: 'd', ms: MS_PER_DAY },
  { name: 'hour', short: 'h', ms: MS_PER_HOUR },
  { name: 'minute', short: 'm', ms: MS_PER_MINUTE },
] as const;

type TimeAgo =
  /** Under a minute ago, or stamped by a clock that was ahead of this one. */
  { unit: null } | { unit: (typeof TIME_AGO_UNITS)[number]; count: number };

/**
 * How long before `now` an ISO-8601 time was, in whole counts of the
 * largest unit that fits. `null` when the text is not a time.
 */
const timeAgo = (iso: string, now: number): TimeAgo | null => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return null;
  }

  const elapsed = now - then;
  const unit = TIME_AGO_UNITS.find(candidate => elapsed >= candidate.ms);
  return unit === undefined
    ? { unit: null }
    : { unit, count: Math.floor(elapsed / unit.ms) };
};

/**
 * ISO-8601 → how long ago that was: `just now`, `5m ago`, `3h ago`,
 * `2d ago`, `3w ago`, `4mo ago`, `2y ago`. `—` when the text is not a time.
 */
export const formatTimeAgo = (
  iso: string,
  now: number = Date.now(),
): string => {
  const ago = timeAgo(iso, now);
  if (ago === null) {
    return '—';
  }
  return ago.unit === null ? 'just now' : `${ago.count}${ago.unit.short} ago`;
};

/**
 * The same as a screen reader should say it: `2 days ago`, `just now`. A
 * bare `2d ago` is read as a number and a stray letter.
 */
export const spokenTimeAgo = (
  iso: string,
  now: number = Date.now(),
): string => {
  const ago = timeAgo(iso, now);
  if (ago === null) {
    return 'at an unknown time';
  }
  return ago.unit === null
    ? 'just now'
    : `${pluralize(ago.count, ago.unit.name)} ago`;
};
