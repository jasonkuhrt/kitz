import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'
import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'

/**
 * Structured representation of an ephemeral (PR) prerelease identifier.
 *
 * Format: `pr.${prNumber}.${iteration}.${sha}`
 *
 * @example
 * ```ts
 * // Decode from string
 * const eph = S.decodeSync(EphemeralSchema)('pr.123.5.gabc1234')
 * // { _tag: 'Ephemeral', prNumber: 123, iteration: 5, sha: 'abc1234' }
 *
 * // Encode to string
 * S.encodeSync(EphemeralSchema)(eph) // 'pr.123.5.gabc1234'
 * ```
 */
export class Ephemeral extends S.TaggedClass<Ephemeral>()('Ephemeral', {
  prNumber: S.Number.pipe(S.check(S.isGreaterThan(0), S.isInt())),
  iteration: S.Number.pipe(S.check(S.isGreaterThan(0), S.isInt())),
  sha: Git.Sha.Sha,
}) {
  static make = this.makeUnsafe
  static is = S.is(Ephemeral)

  /** Compute ephemeral version: 0.0.0-pr.N.iter.gSHA */
  static calculateVersion(prNumber: number, iteration: number, sha: Git.Sha.Sha): Semver.Semver {
    // Prefix SHA with 'g' (git convention) to ensure it's always a valid
    // alphanumeric semver prerelease identifier. An all-digit SHA like
    // "09796047" is neither valid numeric (leading zeros) nor alphanumeric
    // (no letters) per the semver spec.
    return Semver.withPre(Semver.zero, ['pr', prNumber, iteration, `g${sha}`])
  }
}

const EphemeralEncoded = S.String

const EphemeralPattern = /^pr\.(\d+)\.(\d+)\.g?([a-f0-9]{7,40})$/i

/**
 * Schema that transforms between string format and structured Ephemeral.
 */
export const EphemeralSchema = EphemeralEncoded.pipe(
  S.decodeTo(Ephemeral, {
    decode: SchemaGetter.transformOrFail((value) => {
      const match = EphemeralPattern.exec(value)
      if (!match) {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(value), {
            message: `Invalid ephemeral prerelease format: expected 'pr.<number>.<number>.<sha>'`,
          }),
        )
      }
      const prNumber = parseInt(match[1]!, 10)
      const iteration = parseInt(match[2]!, 10)
      const sha = Git.Sha.make(match[3]!)
      return Effect.succeed(Ephemeral.make({ prNumber, iteration, sha }))
    }),
    encode: SchemaGetter.transform((eph) => `pr.${eph.prNumber}.${eph.iteration}.g${eph.sha}`),
  }),
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
