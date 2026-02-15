import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'
import { ParseResult, Schema as S } from 'effect'

/**
 * Structured representation of an ephemeral (PR) prerelease identifier.
 *
 * Format: `pr.${prNumber}.${iteration}.${sha}`
 *
 * @example
 * ```ts
 * // Decode from string
 * const eph = S.decodeSync(EphemeralSchema)('pr.123.5.abc1234')
 * // { _tag: 'Ephemeral', prNumber: 123, iteration: 5, sha: 'abc1234' }
 *
 * // Encode to string
 * S.encodeSync(EphemeralSchema)(eph) // 'pr.123.5.abc1234'
 * ```
 */
export class Ephemeral extends S.TaggedClass<Ephemeral>()('Ephemeral', {
  prNumber: S.Number.pipe(S.positive(), S.int()),
  iteration: S.Number.pipe(S.positive(), S.int()),
  sha: Git.Sha.Sha,
}) {
  static is = S.is(Ephemeral)

  /** Compute ephemeral version: 0.0.0-pr.N.iter.sha */
  static calculateVersion(prNumber: number, iteration: number, sha: Git.Sha.Sha): Semver.Semver {
    return Semver.withPre(Semver.zero, ['pr', prNumber, iteration, sha])
  }
}

const EphemeralEncoded = S.String

const EphemeralPattern = /^pr\.(\d+)\.(\d+)\.([a-f0-9]{7,40})$/i

/**
 * Schema that transforms between string format and structured Ephemeral.
 */
export const EphemeralSchema = S.transformOrFail(
  EphemeralEncoded,
  Ephemeral,
  {
    strict: true,
    decode: (value, _, ast) => {
      const match = EphemeralPattern.exec(value)
      if (!match) {
        return ParseResult.fail(
          new ParseResult.Type(
            ast,
            value,
            `Invalid ephemeral prerelease format: expected 'pr.<number>.<number>.<sha>'`,
          ),
        )
      }
      const prNumber = parseInt(match[1]!, 10)
      const iteration = parseInt(match[2]!, 10)
      const sha = Git.Sha.make(match[3]!)
      return ParseResult.succeed(Ephemeral.make({ prNumber, iteration, sha }))
    },
    encode: (eph) => ParseResult.succeed(`pr.${eph.prNumber}.${eph.iteration}.${eph.sha}`),
  },
)

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create an Ephemeral from parts.
 */
export const makeEphemeral = (prNumber: number, iteration: number, sha: Git.Sha.Sha): Ephemeral =>
  Ephemeral.make({ prNumber, iteration, sha })

/**
 * Parse an ephemeral prerelease string.
 */
export const parseEphemeral = (value: string): Ephemeral => S.decodeSync(EphemeralSchema)(value)

/**
 * Encode an Ephemeral to string.
 */
export const encodeEphemeral = (eph: Ephemeral): string => S.encodeSync(EphemeralSchema)(eph)

/**
 * Calculate the next iteration for an ephemeral prerelease.
 */
export const nextEphemeral = (eph: Ephemeral, sha: Git.Sha.Sha): Ephemeral =>
  Ephemeral.make({ prNumber: eph.prNumber, iteration: eph.iteration + 1, sha })
