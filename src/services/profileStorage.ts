import {
  APPEARANCE_PREFERENCES,
  BEEP_VOLUMES,
  DEFAULT_PROFILE,
  DETECTION_SENSITIVITIES,
  HANDLE_BODY_PATTERN,
  HANDLE_PREFIX,
  LEVEL_UNITS,
  MAX_PROFILE_HANDLE_LENGTH,
  MAX_PROFILE_NAME_LENGTH,
  MAX_START_DELAY_MS,
  MIN_START_DELAY_MS,
  START_DELAY_STEP_MS,
  type AppearancePreference,
  type DetectionSensitivity,
  type LevelUnit,
  type Profile,
  type ProfileChanges,
  type StartDelayRange,
} from '@/types/profile';
import { isRecord, isTimestamp } from '@utils/guards';
import {
  normalizeProfileName,
  profileHandleBody,
  profileNameLength,
} from '@utils/profile';
import { createSerialQueue } from '@utils/serialQueue';
import { isBeepVolume, isStartDelayRange } from '@utils/startSettings';
import { getTimestamp as defaultGetTimestamp } from '@utils/timestamp';

import { createStorageNamespace, StorageError } from './storage';

/**
 * ProfileStorageService
 * ---------------------
 * Local persistence layer for the profile: the display name and handle the
 * Profile screen shows, and the preferences Settings changes (the
 * Appearance the theme follows, the unit sound levels are shown in, and
 * the timer's start delay range and beep volume).
 * There is no account behind it — the profile lives on this device only.
 *
 * Design notes:
 *   - An install has exactly one profile, stored under one key
 *     (`@BrassCount:profile:v1:local`).
 *   - The stored value is an envelope, `{ schemaVersion, profile }`. When
 *     the `Profile` shape changes, bump `PROFILE_SCHEMA_VERSION` and
 *     upgrade older envelopes in `parseStoredProfile` — the existing
 *     profile is migrated in place rather than abandoned under an old key.
 *   - A profile always exists as far as callers are concerned: until one
 *     is saved, `loadProfile` resolves to `DEFAULT_PROFILE` (no name, no
 *     handle, Appearance following the device, levels on the 0–100
 *     scale, a 1 to 5 s start delay, the normal beep volume).
 *   - Anything read back from storage is untrusted and checked field by
 *     field. Unlike a drill or a session, a field that fails falls back to
 *     its default on its own instead of discarding the whole value, so a
 *     name that no longer passes cannot also reset the theme.
 *   - A name or handle is bounded (`MAX_PROFILE_NAME_LENGTH`,
 *     `MAX_PROFILE_HANDLE_LENGTH`) on save and on read alike, and so is
 *     the start delay range (`isStartDelayRange`). The range is one
 *     field, saved and checked as a whole, so its shortest end can never
 *     be stored past its longest.
 *   - Updates and clears run one at a time, in the order they were
 *     requested, so a name saved while Appearance is being switched cannot
 *     undo it.
 *   - Every failure surfaces as `ProfileStorageError`, which is also a
 *     `StorageError`, so UI code can catch either.
 */

export const PROFILE_NAMESPACE = 'profile';
export const PROFILE_STORAGE_VERSION = 'v1';
/** Version of the `Profile` shape written inside the stored envelope. */
export const PROFILE_SCHEMA_VERSION = 1;
/** Id the one profile of this install is stored under. */
export const PROFILE_ID = 'local';

/**
 * Why a profile operation failed: the caller passed something unusable, or
 * the device storage itself failed.
 */
export type ProfileStorageErrorCode = 'INVALID_INPUT' | 'STORAGE_FAILURE';

/**
 * Error thrown by this service. Branch on `code` to tell a rejected edit
 * from a storage failure; the underlying error, if any, is on `cause`.
 */
export class ProfileStorageError extends StorageError {
  readonly code: ProfileStorageErrorCode;

  constructor(message: string, code: ProfileStorageErrorCode, cause?: unknown) {
    super(message, cause);
    this.name = 'ProfileStorageError';
    this.code = code;
  }
}

export interface ProfileStorageOptions {
  /** Source of the ISO-8601 timestamp stamped on the profile. */
  getTimestamp?: () => string;
}

/** What is actually written under the profile's key. */
interface StoredProfile {
  schemaVersion: number;
  // Unknown values, not a `Profile`: an update keeps a stored field it was
  // not asked to change exactly as found, even one that no longer passes
  // validation.
  profile: Record<keyof Profile, unknown>;
}

// Typed `unknown` on purpose: the storage layer only promises valid JSON,
// so every read goes through `parseStoredProfile` before it is a `Profile`.
const profiles = createStorageNamespace<unknown>({
  name: PROFILE_NAMESPACE,
  version: PROFILE_STORAGE_VERSION,
});

const invalid = (message: string): ProfileStorageError =>
  new ProfileStorageError(message, 'INVALID_INPUT');

const isAppearancePreference = (
  value: unknown,
): value is AppearancePreference =>
  APPEARANCE_PREFERENCES.some(preference => preference === value);

const isLevelUnit = (value: unknown): value is LevelUnit =>
  LEVEL_UNITS.some(unit => unit === value);

const isDetectionSensitivity = (
  value: unknown,
): value is DetectionSensitivity =>
  DETECTION_SENSITIVITIES.some(sensitivity => sensitivity === value);

/** A copy of `DEFAULT_PROFILE` that a caller may change freely. */
const defaultProfile = (): Profile => ({
  ...DEFAULT_PROFILE,
  startDelay: { ...DEFAULT_PROFILE.startDelay },
});

/**
 * Check a start delay range and return a clean copy holding only its two
 * ends. Both must be whole steps within the bounds, and the shortest no
 * longer than the longest.
 */
const normalizeStartDelay = (range: unknown): StartDelayRange => {
  if (!isStartDelayRange(range)) {
    throw invalid(
      `A start delay must run from ${MIN_START_DELAY_MS} to ${MAX_START_DELAY_MS} ms in steps of ${START_DELAY_STEP_MS} ms, shortest first`,
    );
  }
  return { minMs: range.minMs, maxMs: range.maxMs };
};

/**
 * Bring a name to its stored form (see `normalizeProfileName`). `null` and
 * a blank name both mean "no name". The length limit counts characters by
 * code point, so an emoji uses one of the allowance rather than two.
 */
const normalizeName = (name: unknown): string | null => {
  if (name === null) {
    return null;
  }
  if (typeof name !== 'string') {
    throw invalid('A profile name must be text');
  }
  const trimmed = normalizeProfileName(name);
  if (trimmed === null) {
    return null;
  }
  if (profileNameLength(trimmed) > MAX_PROFILE_NAME_LENGTH) {
    throw invalid(
      `A profile name can be at most ${MAX_PROFILE_NAME_LENGTH} characters`,
    );
  }
  return trimmed;
};

/**
 * Bring a handle to its stored form: trimmed, with exactly one leading
 * `@` whether or not the caller typed it. `null`, a blank handle and a
 * lone `@` all mean "no handle".
 */
const normalizeHandle = (handle: unknown): string | null => {
  if (handle === null) {
    return null;
  }
  if (typeof handle !== 'string') {
    throw invalid('A profile handle must be text');
  }
  const body = profileHandleBody(handle);
  if (body.length === 0) {
    return null;
  }
  if (body.length > MAX_PROFILE_HANDLE_LENGTH) {
    throw invalid(
      `A profile handle can be at most ${MAX_PROFILE_HANDLE_LENGTH} characters`,
    );
  }
  if (!HANDLE_BODY_PATTERN.test(body)) {
    throw invalid(
      'A profile handle can only use letters, digits, ".", "_" and "-"',
    );
  }
  return `${HANDLE_PREFIX}${body}`;
};

/**
 * Read one stored field through the check a save applies, falling back to
 * `fallback` when it does not pass.
 */
const readField = <T>(normalize: () => T, fallback: T): T => {
  try {
    return normalize();
  } catch (err) {
    // A stored field that fails validation reads as unset, the same way
    // the storage layer treats corrupt JSON as missing, so one bad field
    // cannot take the rest of the profile with it.
    if (err instanceof ProfileStorageError) {
      return fallback;
    }
    throw err;
  }
};

/**
 * Turn a value read from storage back into a `Profile`, or `null` when
 * nothing in it can be trusted: not an envelope, or a schema version this
 * build does not know.
 */
const parseStoredProfile = (stored: unknown): Profile | null => {
  if (!isRecord(stored) || !isRecord(stored.profile)) {
    return null;
  }
  // Only one schema exists so far. When version 2 lands, upgrade older
  // envelopes here before the checks below.
  if (stored.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    return null;
  }

  // A profile saved before a field existed reads that field as its
  // default, so adding a field needs no schema bump.
  const {
    name,
    handle,
    appearance,
    levelUnit,
    startDelay,
    beepVolume,
    sensitivity,
    updatedAt,
  } = stored.profile;
  return {
    name: readField(() => normalizeName(name), DEFAULT_PROFILE.name),
    handle: readField(() => normalizeHandle(handle), DEFAULT_PROFILE.handle),
    appearance: isAppearancePreference(appearance)
      ? appearance
      : DEFAULT_PROFILE.appearance,
    levelUnit: isLevelUnit(levelUnit) ? levelUnit : DEFAULT_PROFILE.levelUnit,
    // A fresh copy of the known fields, never the stored object itself.
    startDelay: isStartDelayRange(startDelay)
      ? { minMs: startDelay.minMs, maxMs: startDelay.maxMs }
      : { ...DEFAULT_PROFILE.startDelay },
    beepVolume: isBeepVolume(beepVolume)
      ? beepVolume
      : DEFAULT_PROFILE.beepVolume,
    sensitivity: isDetectionSensitivity(sensitivity)
      ? sensitivity
      : DEFAULT_PROFILE.sensitivity,
    updatedAt: isTimestamp(updatedAt) ? updatedAt : DEFAULT_PROFILE.updatedAt,
  };
};

/** Run a storage call, rethrowing its failure as a `ProfileStorageError`. */
const withStorage = async <T>(
  action: string,
  run: () => Promise<T>,
): Promise<T> => {
  try {
    return await run();
  } catch (err) {
    throw new ProfileStorageError(
      `Failed to ${action}`,
      'STORAGE_FAILURE',
      err,
    );
  }
};

/**
 * The stored profile's fields as found, for an update to build on. Where
 * nothing readable is stored (no profile yet, corrupt, or a newer schema)
 * it is the defaults.
 */
const readStoredFields = async (): Promise<StoredProfile['profile']> => {
  const stored = await withStorage('load profile', () =>
    profiles.getItem(PROFILE_ID),
  );
  if (parseStoredProfile(stored) === null || !isRecord(stored)) {
    return defaultProfile();
  }
  // Only the known fields are carried over, never the whole stored object.
  const {
    name,
    handle,
    appearance,
    levelUnit,
    startDelay,
    beepVolume,
    sensitivity,
  } = stored.profile as Record<string, unknown>;
  return {
    name,
    handle,
    appearance,
    levelUnit,
    startDelay,
    beepVolume,
    sensitivity,
    updatedAt: null,
  };
};

// Queue of changes to the stored profile. `updateProfile` reads the
// profile and then writes it back, so two overlapping updates (a name
// being saved while Appearance is switched) could otherwise each write
// back the other's old value. Running every change one after another
// closes that gap.
const inOrder = createSerialQueue();

/**
 * Load the profile of this install.
 *
 * Always resolves to a `Profile`: `DEFAULT_PROFILE` when none has been
 * saved or the stored value is corrupt, and the default for any single
 * field that fails validation.
 */
export async function loadProfile(): Promise<Profile> {
  const stored = await withStorage('load profile', () =>
    profiles.getItem(PROFILE_ID),
  );
  return parseStoredProfile(stored) ?? defaultProfile();
}

/**
 * Change the name, handle, Appearance preference, level unit, start delay
 * range and/or beep volume.
 *
 * Fields left out of `changes` keep their stored value, and `updatedAt` is
 * set to now. The name is trimmed and its inner whitespace collapsed; the
 * handle is trimmed and stored with a leading `@` whether or not one was
 * passed. `null` or a blank string clears the name or the handle.
 *
 * A field the update leaves alone is kept exactly as stored. One that no
 * longer passes validation reads as its default from `loadProfile`, but
 * the update does not write that default over it: only a field the caller
 * sets is replaced.
 *
 * The first update creates the stored profile. One made over a value this
 * build cannot read (corrupt, or written by a newer schema) replaces it:
 * with a single profile per install, refusing would leave the shooter
 * unable to save one at all.
 *
 * Updates run one at a time, in the order they were requested, so two
 * overlapping updates both apply.
 *
 * Returns the stored `Profile` so callers can update local state without a
 * follow-up read. Rejects with `INVALID_INPUT` when the name is longer
 * than `MAX_PROFILE_NAME_LENGTH`, the handle is longer than
 * `MAX_PROFILE_HANDLE_LENGTH` or uses anything but letters, digits, `.`,
 * `_` and `-`, the appearance is not one of `APPEARANCE_PREFERENCES`, or
 * the level unit is not one of `LEVEL_UNITS`, the start delay range has
 * an end that is not a whole step of `START_DELAY_STEP_MS` between
 * `MIN_START_DELAY_MS` and `MAX_START_DELAY_MS` or a shortest end past
 * its longest, the beep volume is not one of `BEEP_VOLUMES`, or the
 * sensitivity is not one of `DETECTION_SENSITIVITIES`.
 */
export async function updateProfile(
  changes: ProfileChanges,
  options: ProfileStorageOptions = {},
): Promise<Profile> {
  const { getTimestamp = defaultGetTimestamp } = options;

  if (!isRecord(changes)) {
    throw invalid('updateProfile requires the changes to apply');
  }
  // Validate before touching storage so a bad edit fails fast.
  const name =
    changes.name === undefined ? undefined : normalizeName(changes.name);
  const handle =
    changes.handle === undefined ? undefined : normalizeHandle(changes.handle);
  const { appearance } = changes;
  if (appearance !== undefined && !isAppearancePreference(appearance)) {
    throw invalid(
      `Appearance must be one of: ${APPEARANCE_PREFERENCES.join(', ')}`,
    );
  }
  const { levelUnit } = changes;
  if (levelUnit !== undefined && !isLevelUnit(levelUnit)) {
    throw invalid(`Level unit must be one of: ${LEVEL_UNITS.join(', ')}`);
  }
  const startDelay =
    changes.startDelay === undefined
      ? undefined
      : normalizeStartDelay(changes.startDelay);
  const { beepVolume } = changes;
  if (beepVolume !== undefined && !isBeepVolume(beepVolume)) {
    throw invalid(`Beep volume must be one of: ${BEEP_VOLUMES.join(', ')}`);
  }
  const { sensitivity } = changes;
  if (sensitivity !== undefined && !isDetectionSensitivity(sensitivity)) {
    throw invalid(
      `Sensitivity must be one of: ${DETECTION_SENSITIVITIES.join(', ')}`,
    );
  }

  return inOrder(async () => {
    const updatedAt = getTimestamp();
    if (!isTimestamp(updatedAt)) {
      throw invalid('The generated timestamp is not a valid ISO-8601 date');
    }
    const existing = await readStoredFields();

    // `null` is a real value here (it clears the field), so only
    // `undefined` means "keep what is stored".
    const stored: StoredProfile = {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      profile: {
        name: name === undefined ? existing.name : name,
        handle: handle === undefined ? existing.handle : handle,
        appearance: appearance ?? existing.appearance,
        levelUnit: levelUnit ?? existing.levelUnit,
        startDelay: startDelay ?? existing.startDelay,
        beepVolume: beepVolume ?? existing.beepVolume,
        sensitivity: sensitivity ?? existing.sensitivity,
        updatedAt,
      },
    };
    await withStorage('update profile', () =>
      profiles.setItem(PROFILE_ID, stored),
    );
    // What `loadProfile` will now read back, not what was written.
    return parseStoredProfile(stored) ?? defaultProfile();
  });
}

/**
 * Remove the stored profile, so the next load resolves to
 * `DEFAULT_PROFILE`. For "reset app data" flows and tests. Idempotent.
 */
export async function clearProfile(): Promise<void> {
  await inOrder(() =>
    withStorage('clear profile', () => profiles.removeItem(PROFILE_ID)),
  );
}

/** Object-form export for callers that prefer a service handle. */
export const ProfileStorageService = {
  namespace: PROFILE_NAMESPACE,
  version: PROFILE_STORAGE_VERSION,
  schemaVersion: PROFILE_SCHEMA_VERSION,
  load: loadProfile,
  update: updateProfile,
  clear: clearProfile,
};

export type ProfileStorageServiceType = typeof ProfileStorageService;
