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
 * const eph = S.decodeSync(EphemeralSchema)('pr.123.5.abc1234')
 * // { _tag: 'Ephemeral', prNumber: 123, iteration: 5, sha: 'abc1234' }
 *
 * // Encode to string
 * S.encodeSync(EphemeralSchema)(eph) // 'pr.123.5.abc1234'
 * ```
 */
export class Ephemeral extends S.TaggedClass<Ephemeral>()('Ephemeral', {
  prNumber: S.Number.pipe(S.check(S.isGreaterThan(0), S.isInt())),
  iteration: S.Number.pipe(S.check(S.isGreaterThan(0), S.isInt())),
  sha: Git.Sha.Sha,
}) {
  static is = S.is(Ephemeral as any) as (u: unknown) => u is Ephemeral

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
      return Effect.succeed(new Ephemeral({ prNumber, iteration, sha }))
    }),
    encode: SchemaGetter.transform((eph) => `pr.${eph.prNumber}.${eph.iteration}.${eph.sha}`),
  }),
)

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create an Ephemeral from parts.
 */
export const makeEphemeral = (prNumber: number, iteration: number, sha: Git.Sha.Sha): Ephemeral =>
  new Ephemeral({ prNumber, iteration, sha })

/**
 * Parse an ephemeral prerelease string.
 */
export const parseEphemeral = (value: string): Ephemeral =>
  S.decodeSync(EphemeralSchema as any)(value) as Ephemeral

/**
 * Encode an Ephemeral to string.
 */
export const encodeEphemeral = (eph: Ephemeral): string =>
  S.encodeSync(EphemeralSchema as any)(eph) as string

/**
 * Calculate the next iteration for an ephemeral prerelease.
 */
export const nextEphemeral = (eph: Ephemeral, sha: Git.Sha.Sha): Ephemeral =>
  new Ephemeral({ prNumber: eph.prNumber as number, iteration: (eph.iteration as number) + 1, sha })
