import { Schema as S } from 'effect'

// ============================================================================
// Prerelease Identifiers
// ============================================================================

/**
 * Alphanumeric prerelease identifier.
 *
 * Per semver spec: ASCII alphanumerics and hyphens [0-9A-Za-z-], non-empty.
 * Note: Purely numeric strings are handled by NumericPrereleaseId.
 */
export const AlphanumericPrereleaseId = S.String.pipe(
  S.pattern(/^[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*$/), // Must have at least one non-digit
  S.minLength(1),
).annotations({
  identifier: 'AlphanumericPrereleaseId',
  description: 'Alphanumeric prerelease identifier (contains at least one letter or hyphen)',
})

/**
 * Numeric prerelease identifier.
 *
 * Per semver spec: Non-negative integer without leading zeros.
 */
export const NumericPrereleaseId = S.Number.pipe(
  S.int(),
  S.nonNegative(),
).annotations({
  identifier: 'NumericPrereleaseId',
  description: 'Numeric prerelease identifier (non-negative integer)',
})

/**
 * A single prerelease identifier (numeric or alphanumeric).
 */
export const PrereleaseId = S.Union(NumericPrereleaseId, AlphanumericPrereleaseId).annotations({
  identifier: 'PrereleaseId',
  description: 'A prerelease identifier per semver spec',
})

export type PrereleaseId = typeof PrereleaseId.Type

/**
 * Non-empty array of prerelease identifiers.
 */
export const PrereleaseIds = S.NonEmptyArray(PrereleaseId).annotations({
  identifier: 'PrereleaseIds',
  description: 'Non-empty array of prerelease identifiers',
})

export type PrereleaseIds = typeof PrereleaseIds.Type

// ============================================================================
// Build Identifiers
// ============================================================================

/**
 * A single build identifier.
 *
 * Per semver spec: ASCII alphanumerics and hyphens [0-9A-Za-z-], non-empty.
 * Unlike prerelease, build identifiers are always strings (no special numeric handling).
 */
export const BuildId = S.String.pipe(
  S.pattern(/^[0-9A-Za-z-]+$/),
  S.minLength(1),
).annotations({
  identifier: 'BuildId',
  description: 'Build metadata identifier per semver spec',
})

export type BuildId = typeof BuildId.Type

/**
 * Array of build identifiers (can be empty).
 */
export const BuildIds = S.Array(BuildId).annotations({
  identifier: 'BuildIds',
  description: 'Array of build metadata identifiers',
})

export type BuildIds = typeof BuildIds.Type
