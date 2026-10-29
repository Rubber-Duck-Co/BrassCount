/**
 * Domain model for the local profile: who Setup's profile box says the
 * shooter is, and the preferences Setup changes (display, and the
 * timer's start delay and beep volume). There is one
 * profile per install and no account behind it. Persistence is handled by
 * `ProfileStorageService`, which also normalises the name and handle and
 * stamps `updatedAt` — callers hand it a `ProfileChanges`.
 */

/**
 * Every Appearance choice, in the order a picker lists them. `system`
 * follows the device's light / dark setting; the other two pin the theme.
 */
export const APPEARANCE_PREFERENCES = ['system', 'light', 'dark'] as const;

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];

/**
 * Every way a sound level can be shown, in the order a picker lists them.
 * `level` is a 0–100 scale (-60 dBFS → 0, full scale → 100); `dbfs` is the
 * raw reading. Display only: every level is measured, compared and kept
 * in dBFS whichever is chosen.
 */
export const LEVEL_UNITS = ['level', 'dbfs'] as const;

export type LevelUnit = (typeof LEVEL_UNITS)[number];

/**
 * The range the random delay before the start beep is drawn from, in
 * milliseconds. `minMs` equal to `maxMs` is a fixed delay.
 */
export interface StartDelayRange {
  minMs: number;
  maxMs: number;
}

/**
 * Shortest start delay that can be chosen, in milliseconds. Not lower: the
 * delay is what lets the microphone's timestamps settle
 * (`CAPTURE_CLOCK_SETTLE_MS`, 750 ms) before the beep, and the next step
 * down is 0.5 s.
 */
export const MIN_START_DELAY_MS = 1000;
/** Longest start delay that can be chosen, in milliseconds. */
export const MAX_START_DELAY_MS = 10_000;
/** Start delays are chosen in steps of this many milliseconds. */
export const START_DELAY_STEP_MS = 500;

/**
 * Every beep volume, quietest first, in the order a picker lists them.
 * Presets rather than a free value: there is no slider component, and
 * three large choices are easy to hit with gloves on. App volume only:
 * the phone's own media volume is never changed, so `full` is the
 * loudest the app can play and the others step down from it.
 */
export const BEEP_VOLUMES = ['quiet', 'medium', 'full'] as const;

export type BeepVolume = (typeof BEEP_VOLUMES)[number];

/**
 * Every detection sensitivity, least sensitive first, in the order a
 * picker lists them. It sets how far below a calibrated sample the
 * threshold sits: `low` hears fewer false shots, `high` misses fewer
 * quiet ones. See `SENSITIVITY_MARGIN_DB`.
 */
export const DETECTION_SENSITIVITIES = ['low', 'normal', 'high'] as const;

export type DetectionSensitivity = (typeof DETECTION_SENSITIVITIES)[number];

/** Character every stored handle starts with. */
export const HANDLE_PREFIX = '@';

/**
 * What may follow the `@` of a handle. Shared by the storage service,
 * which rejects anything else, and the Profile editor, which says so
 * before a save is attempted.
 */
export const HANDLE_BODY_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Upper bounds on what a profile may hold. The storage service enforces
 * them on every save and read, so a name or handle always fits the Profile
 * header; an editor should offer no more than these allow.
 *
 * Raising a limit is safe. Lowering one makes every stored value over the
 * new limit read back as unset, so it needs a migration, not just a
 * smaller number here.
 */
/**
 * Longest a display name may be once trimmed and its inner whitespace
 * collapsed, in characters.
 */
export const MAX_PROFILE_NAME_LENGTH = 40;
/**
 * Most characters the name field accepts while typing. Well above
 * `MAX_PROFILE_NAME_LENGTH` so spaces that will collapse on save (a padded
 * paste) do not cut the name short; the editor shows an error for a name
 * that is too long once they are collapsed.
 */
export const MAX_PROFILE_NAME_INPUT_LENGTH = 200;
/** Longest a handle may be, in characters, not counting the `@`. */
export const MAX_PROFILE_HANDLE_LENGTH = 30;

export interface Profile {
  /** Display name, e.g. `Marty McFly`. `null` until the shooter sets one. */
  name: string | null;
  /**
   * Handle, always with its leading `@`, e.g. `@martymcfly`: letters,
   * digits, `.`, `_` and `-` after the `@`. `null` until the shooter sets
   * one.
   */
  handle: string | null;
  /** Which theme the app should use. */
  appearance: AppearancePreference;
  /** How sound levels are shown. */
  levelUnit: LevelUnit;
  /** The range the random delay before each run's start beep comes from. */
  startDelay: StartDelayRange;
  /** How loud the start beep is. */
  beepVolume: BeepVolume;
  /** How far below a calibrated sample the detection threshold sits. */
  sensitivity: DetectionSensitivity;
  /**
   * ISO-8601 timestamp of the last change to the profile. `null` when the
   * profile has never been saved.
   */
  updatedAt: string | null;
}

/** The profile of an install that has not saved one yet. */
export const DEFAULT_PROFILE: Readonly<Profile> = Object.freeze({
  name: null,
  handle: null,
  appearance: 'system',
  levelUnit: 'level',
  // The 1 to 5 s the start sequence has always used.
  startDelay: Object.freeze({ minMs: 1000, maxMs: 5000 }),
  beepVolume: 'full',
  sensitivity: 'normal',
  updatedAt: null,
});

/**
 * Fields that can be changed on the profile; omitted ones are kept. Pass
 * `null` — or a blank string, which is what an emptied text field holds —
 * to clear the name or the handle. The handle may be given with or
 * without its `@`.
 */
export interface ProfileChanges {
  name?: string | null;
  handle?: string | null;
  appearance?: AppearancePreference;
  levelUnit?: LevelUnit;
  /** Both ends together, so the range is checked as a whole. */
  startDelay?: StartDelayRange;
  beepVolume?: BeepVolume;
  sensitivity?: DetectionSensitivity;
}
