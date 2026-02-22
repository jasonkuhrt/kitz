import { Semver } from '@kitz/semver'
import { Range as VltRange, Version as VltVersion } from '@vltpkg/semver'
import { Effect, ParseResult, Schema as S } from 'effect'
import { Comparator } from './comparator.js'
import type { Operator } from './operator.js'

export { Comparator } from './comparator.js'
export { Operator } from './operator.js'

// ============================================================================
// Range
// ============================================================================

/**
 * npm-style semver range expression.
 *
 * Supports all npm range syntax:
 * - Exact: `1.0.0`
 * - Ranges: `>=1.0.0 <2.0.0`
 * - Caret: `^1.0.0` (compatible with version)
 * - Tilde: `~1.0.0` (approximately equivalent)
 * - Wildcards: `*`, `x`, `1.x`, `1.0.x`
 * - Hyphen: `1.0.0 - 2.0.0`
 * - OR: `^1.0.0 || ^2.0.0`
 *
 * **Note**: This is NOT part of semver.org spec - it's an npm/node-semver invention
 * for package dependency resolution.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies | npm dependencies}
 * @see {@link https://github.com/npm/node-semver#ranges | node-semver ranges}
 */
export const Range = S.NonEmptyArray(S.NonEmptyArray(Comparator))
export type Range = typeof Range.Type

export const is = S.is(Range)

/**
 * Construct a Range from comparator sets.
 *
 * Use {@link fromString} for parsing range expressions like `^1.0.0`.
 */
export const make = (sets: Range): Range => sets

/**
 * String codec: parses range strings into structured Range.
 *
 * Uses @vltpkg/semver internally for battle-tested parsing,
 * then converts to clean Effect Schema types.
 */
export const Schema: S.Schema<Range, string> = S.transformOrFail(
  S.String,
  Range,
  {
    strict: true,
    decode: (value, _, ast) =>
      Effect.try({
        try: () => convertVltRange(new VltRange(value)),
        catch: (error) => new ParseResult.Type(ast, value, `Invalid semver range: ${error}`),
      }),
    encode: (range) =>
      Effect.succeed(
        range
          .map((set) => set.map((c) => Comparator.toString(c)).join(' '))
          .join(' || '),
      ),
  },
)

export const fromString = S.decodeSync(Schema)
export const toString = S.encodeSync(Schema)

/**
 * Check if a semver version satisfies a range.
 *
 * @example
 * ```ts
 * const range = Range.fromString('^1.0.0')
 * satisfies(Semver.fromString('1.2.3'), range) // true
 * satisfies(Semver.fromString('2.0.0'), range) // false
 * ```
 */
export const satisfies = (version: Semver.Semver, range: Range): boolean => {
  const vltRange = new VltRange(toString(range))
  const vltVersion = VltVersion.parse(version.toString())
  return vltRange.test(vltVersion)
}

// ============================================================================
// Internal: vlt → Schema Conversion
// ============================================================================

const convertVltRange = (vltRange: VltRange): Range => {
  const sets: Comparator[][] = []

  for (const vltComparator of vltRange.set) {
    const comparators: Comparator[] = []

    for (const tuple of vltComparator.tuples) {
      if (!Array.isArray(tuple)) continue

      const [op, version] = tuple
      comparators.push(Comparator.make({
        operator: op as Operator,
        version: Semver.fromString(version.toString()),
      }))
    }

    // Handle empty comparators (e.g., from "*" range)
    if (comparators.length === 0) {
      comparators.push(Comparator.make({
        operator: '>=',
        version: Semver.fromString('0.0.0'),
      }))
    }

    sets.push(comparators)
  }

  // Handle empty sets (shouldn't happen, but defensive)
  if (sets.length === 0) {
    sets.push([Comparator.make({
      operator: '>=',
      version: Semver.fromString('0.0.0'),
    })])
  }

  return sets as unknown as Range
}
