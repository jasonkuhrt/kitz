/**
 * SHA-keyed changelog-text overlay — the analyzer half of commit-body overrides.
 *
 * The config layer ({@link ../config.js}) owns the `commitOverrides` schema and
 * its read-time breaking-change guard; this module owns *applying* a validated
 * override to a commit's rendered description. Resolution uses the same SHA-prefix
 * semantics (`hash.startsWith(prefix)`) the analyzer already uses for commit
 * boundaries, so an override key behaves like every other commit reference here.
 */

import type { CommitOverride, CommitOverrides } from '../config.js'

/**
 * Resolve the changelog-text override (if any) for a commit hash.
 *
 * A configured key matches when it is a prefix of the commit hash, mirroring
 * git's short-SHA references. The first configured key that matches wins;
 * unambiguous, non-overlapping prefixes are expected (a stale override that
 * matches nothing is surfaced separately as a doctor warning).
 */
export const resolveOverride = (
  overrides: CommitOverrides | undefined,
  hash: string,
): CommitOverride | undefined => {
  if (!overrides) return undefined
  for (const [sha, override] of Object.entries(overrides)) {
    if (hash.startsWith(sha)) return override
  }
  return undefined
}
