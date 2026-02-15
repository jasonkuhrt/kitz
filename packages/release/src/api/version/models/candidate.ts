import { Semver } from '@kitz/semver'
import { ParseResult, Schema as S } from 'effect'

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
  iteration: S.Number.pipe(S.positive(), S.int()),
}) {
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
export const CandidateSchema = S.transformOrFail(
  CandidateEncoded,
  Candidate,
  {
    strict: true,
    decode: (value, _, ast) => {
      const match = CandidatePattern.exec(value)
      if (!match) {
        return ParseResult.fail(
          new ParseResult.Type(ast, value, `Invalid candidate prerelease format: expected 'next.<number>'`),
        )
      }
      const iteration = parseInt(match[1]!, 10)
      return ParseResult.succeed(Candidate.make({ iteration }))
    },
    encode: (candidate) => ParseResult.succeed(`next.${candidate.iteration}`),
  },
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
export const encodeCandidate = (candidate: Candidate): string => S.encodeSync(CandidateSchema)(candidate)

/**
 * Calculate the next iteration for a candidate prerelease.
 */
export const nextCandidate = (candidate: Candidate): Candidate => Candidate.make({ iteration: candidate.iteration + 1 })
