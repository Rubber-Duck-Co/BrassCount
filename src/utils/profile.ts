import {
  HANDLE_BODY_PATTERN,
  HANDLE_PREFIX,
  MAX_PROFILE_HANDLE_LENGTH,
  MAX_PROFILE_NAME_LENGTH,
} from '@/types/profile';

/**
 * The rules for the Profile's text fields, and the checks the editor shows
 * from them. Pure functions, no side effects. `ProfileStorageService`
 * normalizes with the same functions, so what the editor accepts is what
 * the service stores; the `...Error` checks return the message to show
 * under a field, in words written for the shooter, or `null` when the
 * service would accept what was typed.
 */

/**
 * Bring a typed display name to its stored form: trimmed, with every run of
 * whitespace (a pasted tab or line break included) reduced to one space, so
 * it always sits on a single line. A blank name is `null`: no name.
 */
export const normalizeProfileName = (name: string): string | null => {
  const stored = name.trim().replace(/\s+/g, ' ');
  return stored.length === 0 ? null : stored;
};

/**
 * How long a name is, in characters as the shooter sees them: by code
 * point, so an emoji counts once rather than as its two UTF-16 units.
 */
export const profileNameLength = (name: string): number =>
  Array.from(name).length;

/**
 * The part of a typed handle after its optional leading `@`, trimmed. An
 * empty body means "no handle".
 */
export const profileHandleBody = (handle: string): string => {
  const trimmed = handle.trim();
  return trimmed.startsWith(HANDLE_PREFIX)
    ? trimmed.slice(HANDLE_PREFIX.length)
    : trimmed;
};

/**
 * Why a typed display name cannot be saved, or `null` when it can. A blank
 * name is fine: it clears the stored one.
 */
export const profileNameError = (name: string): string | null => {
  // Measured the way the service stores it.
  const stored = normalizeProfileName(name) ?? '';
  return profileNameLength(stored) > MAX_PROFILE_NAME_LENGTH
    ? `Use ${MAX_PROFILE_NAME_LENGTH} characters or fewer`
    : null;
};

/**
 * Why a typed handle cannot be saved, or `null` when it can. The leading
 * `@` is optional, and a blank handle (or a lone `@`) is fine: it clears
 * the stored one.
 */
export const profileHandleError = (handle: string): string | null => {
  const body = profileHandleBody(handle);
  if (body.length === 0) {
    return null;
  }
  if (body.length > MAX_PROFILE_HANDLE_LENGTH) {
    return `Use ${MAX_PROFILE_HANDLE_LENGTH} characters or fewer after the ${HANDLE_PREFIX}`;
  }
  if (!HANDLE_BODY_PATTERN.test(body)) {
    return 'Use only letters, digits, ".", "_" and "-"';
  }
  return null;
};
