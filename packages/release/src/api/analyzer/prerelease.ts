import { Git } from '@kitz/git'
import { ParseResult, Schema as S } from 'effect'

// ============================================================================
// PR Prerelease
// ============================================================================

/**
 * Structured representation of a PR prerelease identifier.
 *
 * Format: `pr.${prNumber}.${iteration}.${sha}`
 *
 * @example
 * ```ts
 * // Decode from string
 * const pr = S.decodeSync(PrPrerelease)('pr.123.5.abc1234')
 * // { _tag: 'PrPrerelease', prNumber: 123, iteration: 5, sha: 'abc1234' }
 *
 * // Encode to string
 * S.encodeSync(PrPrerelease)(pr) // 'pr.123.5.abc1234'
 * ```
 */
export class PrPrerelease extends S.Class<PrPrerelease>('PrPrerelease')({
  prNumber: S.Number.pipe(S.positive(), S.int()),
  iteration: S.Number.pipe(S.positive(), S.int()),
  sha: Git.Sha.Sha,
}) {
  static is = S.is(PrPrerelease)
}

const PrPrereleaseEncoded = S.String

const PrPrereleasePattern = /^pr\.(\d+)\.(\d+)\.([a-f0-9]{7,40})$/i

/**
 * Schema that transforms between string format and structured PrPrerelease.
 */
export const PrPrereleaseSchema = S.transformOrFail(
  PrPrereleaseEncoded,
  PrPrerelease,
  {
    strict: true,
    decode: (value, _, ast) => {
      const match = PrPrereleasePattern.exec(value)
      if (!match) {
        return ParseResult.fail(
          new ParseResult.Type(ast, value, `Invalid PR prerelease format: expected 'pr.<number>.<number>.<sha>'`),
        )
      }
      const prNumber = parseInt(match[1]!, 10)
      const iteration = parseInt(match[2]!, 10)
      const sha = Git.Sha.make(match[3]!)
      return ParseResult.succeed(new PrPrerelease({ prNumber, iteration, sha }))
    },
    encode: (pr) => ParseResult.succeed(`pr.${pr.prNumber}.${pr.iteration}.${pr.sha}`),
  },
)

// ============================================================================
// PR Prerelease Constructors
// ============================================================================

/**
 * Create a PrPrerelease from parts.
 */
export const makePrPrerelease = (prNumber: number, iteration: number, sha: Git.Sha.Sha): PrPrerelease =>
  new PrPrerelease({ prNumber, iteration, sha })

/**
 * Parse a PR prerelease string.
 */
export const parsePrPrerelease = (value: string): PrPrerelease => S.decodeSync(PrPrereleaseSchema)(value)

/**
 * Encode a PrPrerelease to string.
 */
export const encodePrPrerelease = (pr: PrPrerelease): string => S.encodeSync(PrPrereleaseSchema)(pr)

/**
 * Calculate the next iteration for a PR prerelease.
 */
export const nextPrPrerelease = (pr: PrPrerelease, sha: Git.Sha.Sha): PrPrerelease =>
  new PrPrerelease({ prNumber: pr.prNumber, iteration: pr.iteration + 1, sha })

// ============================================================================
// Preview Prerelease
// ============================================================================

/**
 * Structured representation of a preview prerelease identifier.
 *
 * Format: `next.${iteration}`
 *
 * @example
 * ```ts
 * // Decode from string
 * const preview = S.decodeSync(PreviewPrerelease)('next.5')
 * // { _tag: 'PreviewPrerelease', iteration: 5 }
 *
 * // Encode to string
 * S.encodeSync(PreviewPrerelease)(preview) // 'next.5'
 * ```
 */
export class PreviewPrerelease extends S.Class<PreviewPrerelease>('PreviewPrerelease')({
  iteration: S.Number.pipe(S.positive(), S.int()),
}) {
  static is = S.is(PreviewPrerelease)
}

const PreviewPrereleaseEncoded = S.String

const PreviewPrereleasePattern = /^next\.(\d+)$/

/**
 * Schema that transforms between string format and structured PreviewPrerelease.
 */
export const PreviewPrereleaseSchema = S.transformOrFail(
  PreviewPrereleaseEncoded,
  PreviewPrerelease,
  {
    strict: true,
    decode: (value, _, ast) => {
      const match = PreviewPrereleasePattern.exec(value)
      if (!match) {
        return ParseResult.fail(
          new ParseResult.Type(ast, value, `Invalid preview prerelease format: expected 'next.<number>'`),
        )
      }
      const iteration = parseInt(match[1]!, 10)
      return ParseResult.succeed(new PreviewPrerelease({ iteration }))
    },
    encode: (preview) => ParseResult.succeed(`next.${preview.iteration}`),
  },
)

// ============================================================================
// Preview Prerelease Constructors
// ============================================================================

/**
 * Create a PreviewPrerelease from iteration number.
 */
export const makePreviewPrerelease = (iteration: number): PreviewPrerelease => new PreviewPrerelease({ iteration })

/**
 * Parse a preview prerelease string.
 */
export const parsePreviewPrerelease = (value: string): PreviewPrerelease => S.decodeSync(PreviewPrereleaseSchema)(value)

/**
 * Encode a PreviewPrerelease to string.
 */
export const encodePreviewPrerelease = (preview: PreviewPrerelease): string =>
  S.encodeSync(PreviewPrereleaseSchema)(preview)

/**
 * Calculate the next iteration for a preview prerelease.
 */
export const nextPreviewPrerelease = (preview: PreviewPrerelease): PreviewPrerelease =>
  new PreviewPrerelease({ iteration: preview.iteration + 1 })
