/**
 * 5.1: Validation for the @handle URL slug used in /u/:handle.
 *
 * The DB CHECK constraint enforces the regex format. App-level validation
 * lives here so we can:
 *   - Surface user-friendly error messages before round-tripping to the DB
 *   - Reject reserved names (admin, api, etc.) without a migration
 *
 * Keep the regex in sync with the DB CHECK in
 * supabase/migrations/20260428_add_public_profile_fields.sql.
 */

export const HANDLE_REGEX = /^[a-z0-9_-]{3,30}$/;
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

/**
 * Reserved paths and admin/system words. Anything that overlaps with an app
 * route — current or plausibly future — must be in this list so we never
 * end up with /u/admin colliding with /admin, /u/api colliding with /api,
 * etc. Lowercase only; check happens after the value is lowercased.
 */
const RESERVED_HANDLES = new Set<string>([
  'admin',
  'api',
  'app',
  'auth',
  'login',
  'signup',
  'signin',
  'logout',
  'settings',
  'profile',
  'profiles',
  'me',
  'user',
  'users',
  'u',
  'home',
  'help',
  'support',
  'about',
  'terms',
  'guidelines',
  'privacy',
  'legal',
  'static',
  'public',
  'assets',
  'images',
  'img',
  'css',
  'js',
  'feed',
  'notifications',
  'follow',
  'followers',
  'following',
  'search',
  'explore',
  'map',
  'maps',
  'pin',
  'pins',
  'itinerary',
  'itineraries',
  'backpack',
  'backpackmap',
  'official',
  'staff',
  'moderator',
  'mod',
  'system',
  'null',
  'undefined',
  'true',
  'false',
]);

export type HandleValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

/**
 * Normalize + validate a handle. Returns the normalized (lowercased,
 * trimmed) value on success, or a user-facing error message on failure.
 *
 * Note: this does NOT check uniqueness — that's a DB round-trip and lives
 * in `isHandleAvailable` in publicProfileApi.ts.
 */
export function validateHandle(raw: string): HandleValidationResult {
  const trimmed = raw.trim().toLowerCase();

  if (!trimmed) {
    return { ok: false, error: 'Handle is required.' };
  }

  if (trimmed.length < HANDLE_MIN_LENGTH) {
    return {
      ok: false,
      error: `Handle must be at least ${HANDLE_MIN_LENGTH} characters.`,
    };
  }

  if (trimmed.length > HANDLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Handle must be ${HANDLE_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (!HANDLE_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: 'Use lowercase letters, numbers, underscores, or hyphens.',
    };
  }

  if (RESERVED_HANDLES.has(trimmed)) {
    return { ok: false, error: 'That handle is reserved.' };
  }

  return { ok: true, normalized: trimmed };
}
