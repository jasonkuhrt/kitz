import { Semver } from '@kitz/semver'
import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'

/**
 * Structured representation of a candidate prerelease identifier.
 *
 * Format: `next.${iteration}`
 *
 * @example
 * ```ts
 * // Decode from string
 * const candidate = S.decodeSync(CandidateSchema)('next.5')
 * // { _tag: 'Candidate', iteration: 5 }
 *
 * // Encode to string
 * S.encodeSync(CandidateSchema)(candidate) // 'next.5'
 * ```
 */
export class Candidate extends S.TaggedClass<Candidate>()('Candidate', {
  iteration: S.Number.pipe(S.check(S.isGreaterThan(0), S.isInt())),
}) {
  static make = this.makeUnsafe
  static is = S.is(Candidate)

  /** Compute candidate version: baseVersion-next.N */
  static calculateVersion(base: Semver.Semver, iteration: number): Semver.Semver {
    return Semver.withPre(base, ['next', iteration])
  }
}

const CandidateEncoded = S.String

const CandidatePattern = /^next\.(\d+)$/

/**
 * Schema that transforms between string format and structured Candidate.
 */
export const CandidateSchema = CandidateEncoded.pipe(
  S.decodeTo(Candidate, {
    decode: SchemaGetter.transformOrFail((value) => {
      const match = CandidatePattern.exec(value)
      if (!match) {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(value), {
            message: `Invalid candidate prerelease format: expected 'next.<number>'`,
          }),
        )
      }
      const iteration = parseInt(match[1]!, 10)
      return Effect.succeed(Candidate.make({ iteration }))
    }),
    encode: SchemaGetter.transform((candidate) => `next.${candidate.iteration}`),
  }),
)

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a Candidate from iteration number.
 */
export const makeCandidate = (iteration: number): Candidate => Candidate.make({ iteration })

/**
 * Parse a candidate prerelease string.
 */
export const parseCandidate = (value: string): Candidate => S.decodeSync(CandidateSchema)(value)

/**
 * Encode a Candidate to string.
 */
export const encodeCandidate = (candidate: Candidate): string =>
  S.encodeSync(CandidateSchema)(candidate)

/**
 * Calculate the next iteration for a candidate prerelease.
 */
export const nextCandidate = (candidate: Candidate): Candidate =>
  Candidate.make({ iteration: candidate.iteration + 1 })
