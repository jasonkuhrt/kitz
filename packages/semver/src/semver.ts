import { Schema as S } from 'effect'
import { Equivalence, Order, ParseResult } from 'effect'
import { OfficialRelease } from './official-release.js'
import { PreRelease } from './pre-release.js'

// ============================================================================
// Internal Parsing
// ============================================================================

/**
 * Semver regex: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * Allows optional leading v/= prefix (stripped)
 */
const SEMVER_RE = /^[v=]?\s*(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9a-zA-Z_.-]+))?(?:\+([0-9a-zA-Z_.-]+))?$/

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: (string | number)[] | undefined
  build: string[] | undefined
}

/** Parse a semver string. Returns undefined if invalid. */
const parse = (input: string): ParsedVersion | undefined => {
  const match = SEMVER_RE.exec(input.trim())
  if (!match) return undefined

  const [, majorStr, minorStr, patchStr, prereleaseStr, buildStr] = match
  const major = Number(majorStr)
  const minor = Number(minorStr)
  const patch = Number(patchStr)

  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return undefined
  }

  const prerelease = prereleaseStr
    ? prereleaseStr.split('.').map((id) => {
      const num = Number(id)
      return /^\d+$/.test(id) && Number.isSafeInteger(num) ? num : id
    })
    : undefined

  const build = buildStr ? buildStr.split('.') : undefined

  return { major, minor, patch, prerelease, build }
}

// ============================================================================
// Internal Comparison
// ============================================================================

/**
 * Compare prerelease identifiers per semver spec:
 * - Numeric < alphanumeric
 * - Numeric compared as integers
 * - Alphanumeric compared lexically
 * - Fewer fields < more fields (when prefixes match)
 */
const comparePrereleaseId = (a: string | number, b: string | number): -1 | 0 | 1 => {
  const aIsNum = typeof a === 'number'
  const bIsNum = typeof b === 'number'

  if (aIsNum && bIsNum) {
    return a < b ? -1 : a > b ? 1 : 0
  }
  if (aIsNum) return -1 // numeric < alphanumeric
  if (bIsNum) return 1

  // Both strings
  return a < b ? -1 : a > b ? 1 : 0
}

const comparePrerelease = (
  a: readonly (string | number)[] | undefined,
  b: readonly (string | number)[] | undefined,
): -1 | 0 | 1 => {
  // No prerelease > has prerelease (1.0.0 > 1.0.0-alpha)
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1

  // Compare element by element
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const cmp = comparePrereleaseId(a[i]!, b[i]!)
    if (cmp !== 0) return cmp
  }

  // Longer prerelease > shorter (1.0.0-alpha.1 > 1.0.0-alpha)
  return a.length < b.length ? -1 : a.length > b.length ? 1 : 0
}

// ============================================================================
// Schema
// ============================================================================

/**
 * Union schema for semantic versions (OfficialRelease | PreRelease).
 *
 * Use this when you want the structured type directly without string encoding.
 */
export const Semver = S.Union(OfficialRelease, PreRelease).annotations({
  identifier: 'Semver',
  title: 'Semantic Version',
  description: 'A semantic version following SemVer specification',
})

/**
 * String codec for semantic versions.
 *
 * Transforms `"1.0.0"` or `"1.0.0-alpha.1"` ↔ Semver
 */
export const Schema: S.Schema<OfficialRelease | PreRelease, string> = S.transformOrFail(
  S.String,
  Semver,
  {
    strict: true,
    decode: (value, _, ast) => {
      const parsed = parse(value)
      if (!parsed) {
        return ParseResult.fail(new ParseResult.Type(ast, value, 'Invalid semver format'))
      }

      const base = {
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch,
        build: parsed.build,
      }

      if (parsed.prerelease && parsed.prerelease.length > 0) {
        return ParseResult.succeed(PreRelease.make({
          ...base,
          prerelease: parsed.prerelease as [string | number, ...(string | number)[]],
        }))
      }
      return ParseResult.succeed(OfficialRelease.make(base))
    },
    encode: (semver) => ParseResult.succeed(formatSemver(semver)),
  },
)

// ============================================================================
// Type
// ============================================================================

export type Semver = typeof Semver.Type

/**
 * Encode a semver value to string via variant combinators.
 */
const formatSemver = (version: Semver): string =>
  version._tag === 'SemverPreRelease'
    ? PreRelease.toString(version)
    : OfficialRelease.toString(version)

/**
 * Encode a semver value to string via variant combinators.
 */
export const toString = (version: Semver): string => formatSemver(version)

// ============================================================================
// Constructors
// ============================================================================

// Note: No make constructor for transform schemas - use fromString or fromParts instead

// ============================================================================
// Ordering
// ============================================================================

/** Get prerelease array for comparison (undefined for official releases) */
const getPrereleaseIds = (v: Semver): readonly (string | number)[] | undefined =>
  v._tag === 'SemverPreRelease' ? v.prerelease : undefined

export const order: Order.Order<Semver> = Order.make((a, b) => {
  // Compare major/minor/patch
  if (a.major !== b.major) return Order.number(a.major, b.major)
  if (a.minor !== b.minor) return Order.number(a.minor, b.minor)
  if (a.patch !== b.patch) return Order.number(a.patch, b.patch)
  // Compare prerelease
  return comparePrerelease(getPrereleaseIds(a), getPrereleaseIds(b))
})

export const min = Order.min(order)

export const max = Order.max(order)

export const lessThan = Order.lessThan(order)

export const greaterThan = Order.greaterThan(order)

// ============================================================================
// Equivalence
// ============================================================================

export const equivalence: Equivalence.Equivalence<Semver> = Equivalence.make((a, b) => order(a, b) === 0)

// ============================================================================
// Type Guard
// ============================================================================

export const is = S.is(Semver)

// ============================================================================
// Importers
// ============================================================================

export const fromString = (value: string): Semver => S.decodeSync(Schema)(value)

/**
 * Create semver from individual parts
 */
export const make = (
  major: number,
  minor: number = 0,
  patch: number = 0,
  prerelease?: string,
  build?: string,
): Semver => {
  const prereleaseStr = prerelease ? `-${prerelease}` : ''
  const buildStr = build ? `+${build}` : ''
  const version = `${major}.${minor}.${patch}${prereleaseStr}${buildStr}`
  return fromString(version)
}

// ============================================================================
// Constants
// ============================================================================

/**
 * The zero version (0.0.0).
 *
 * Used as a base for PR releases and other ephemeral versions
 * that shouldn't affect the main version history.
 */
export const zero: Semver = make(0, 0, 0)

/**
 * The first public API version (1.0.0).
 *
 * Represents "graduation" from initial development phase (0.x.x)
 * to public API stability (1.x.x+). After this version, breaking
 * changes require major version bumps.
 */
export const one: Semver = make(1, 0, 0)

// ============================================================================
// Domain Logic
// ============================================================================

/**
 * Version bump type for stable releases.
 */
export const BumpType = S.Enums(
  {
    major: 'major',
    minor: 'minor',
    patch: 'patch',
  } as const,
)
export type BumpType = typeof BumpType.Type

/**
 * Priority ordering for bump types (major > minor > patch).
 */
const bumpTypePriority: Record<BumpType, number> = { major: 3, minor: 2, patch: 1 }

/**
 * Return the higher-priority bump type between two.
 *
 * @example
 * ```ts
 * maxBump('patch', 'minor') // 'minor'
 * maxBump('major', 'patch') // 'major'
 * ```
 */
export const maxBump = (a: BumpType, b: BumpType): BumpType => bumpTypePriority[a] >= bumpTypePriority[b] ? a : b

/**
 * Get the prerelease identifiers (only available on pre-release versions)
 */
export const getPrerelease = (version: Semver): ReadonlyArray<string | number> | undefined =>
  version._tag === 'SemverPreRelease' ? version.prerelease : undefined

/**
 * Options for converting an official release to a pre-release.
 */
export interface OfficialToPreOptions {
  /**
   * Prerelease identifiers to set (e.g. `['next', 1]`, `['pr', 42, 1, 'abc1234']`).
   */
  readonly prerelease: PreRelease['prerelease']
  /**
   * Optional build metadata override.
   * When omitted, existing build metadata from the base version is preserved.
   */
  readonly build?: PreRelease['build']
}

/**
 * Convert a release to pre-release form.
 */
export const officialToPre = (
  version: OfficialRelease,
  options: OfficialToPreOptions,
): PreRelease =>
  PreRelease.make({
    major: version.major,
    minor: version.minor,
    patch: version.patch,
    prerelease: options.prerelease,
    build: options.build ?? version.build,
  })

/**
 * Remove prerelease identifiers from a version.
 *
 * Preserves major/minor/patch and build metadata.
 */
export const stripPre = (version: Semver): OfficialRelease =>
  OfficialRelease.make({
    major: version.major,
    minor: version.minor,
    patch: version.patch,
    build: version.build,
  })

/**
 * Set prerelease identifiers on a version.
 *
 * Equivalent to `officialToPre(stripPre(version), ...)`.
 */
export const withPre = (
  version: Semver,
  prerelease: PreRelease['prerelease'],
  build?: PreRelease['build'],
): PreRelease => officialToPre(stripPre(version), { prerelease, build })

/**
 * Increment a version by bump type (major/minor/patch only).
 *
 * For prerelease versions, increments the base version and removes prerelease.
 * Use {@link next} for phase-aware bumping.
 */
export const increment = (version: Semver, bump: BumpType): Semver => {
  switch (bump) {
    case 'major':
      return OfficialRelease.make({ major: version.major + 1, minor: 0, patch: 0 })
    case 'minor':
      return OfficialRelease.make({ major: version.major, minor: version.minor + 1, patch: 0 })
    case 'patch':
      return OfficialRelease.make({ major: version.major, minor: version.minor, patch: version.patch + 1 })
  }
}

/**
 * Pattern match on Semver variants
 */
export const match = <$A>(
  onOfficialRelease: (release: OfficialRelease) => $A,
  onPreRelease: (preRelease: PreRelease) => $A,
) =>
(semver: Semver): $A => semver._tag === 'SemverOfficialRelease' ? onOfficialRelease(semver) : onPreRelease(semver)

// ============================================================================
// Phase Detection
// ============================================================================

/**
 * Check if version is in initial development phase (0.x.x).
 *
 * During initial development, breaking changes are expected and
 * bump minor instead of major. See {@link mapBumpForPhase}.
 */
export const isPhaseInitial = (version: Semver): boolean => version.major < one.major

/**
 * Check if version has public API guarantee (1.x.x+).
 *
 * Public API versions follow standard semver semantics where
 * breaking changes bump major.
 */
export const isPhasePublic = (version: Semver): boolean => version.major >= one.major

/**
 * Map a bump type to the appropriate increment for the version's phase.
 *
 * - Initial phase (0.x.x): major/minor → minor, patch → patch
 * - Public phase (1.x.x+): standard semver semantics
 */
export const mapBumpForPhase = (
  version: Semver,
  bump: BumpType,
): BumpType => {
  if (isPhasePublic(version)) {
    return bump // Standard semantics
  }
  // Initial phase: breaking/features → minor, fixes → patch
  return bump === 'patch' ? 'patch' : 'minor'
}
