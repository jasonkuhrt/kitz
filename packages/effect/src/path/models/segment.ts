import { Schema as S } from 'effect'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { realisticSegmentPattern } from '../core/realisticText.js'

const nullByte = String.fromCharCode(0)
const segmentPatternSource = `^[^/${nullByte}]+$`
const segmentPattern = new RegExp(segmentPatternSource)

const segmentTextArbitrary = {
  constraint: { minLength: 1, maxLength: 32, patterns: [segmentPatternSource] },
  candidate: {
    weight: 8,
    make: (fc: typeof import('effect/testing').FastCheck) =>
      fc
        .string({ minLength: 1, maxLength: 32 })
        .filter((s) => !s.includes('/') && !s.includes(nullByte) && s !== '.' && s !== '..'),
  },
} satisfies S.Annotations.ToArbitrary.Filter

/**
 * A single path segment — a POSIX-safe name component: non-empty, no `/` or NUL,
 * and not a `.`/`..` traversal reference (those are resolved by the analyzer into
 * the path's `ascent` count, never stored as segments).
 */
export class Segment_ extends S.asClass(
  S.String.pipe(
    S.check(
      S.makeFilter((s) => s.length > 0, {
        message: 'Path segment cannot be empty',
        arbitrary: { constraint: { minLength: 1 } },
      }),
      S.isPattern(segmentPattern, {
        message: 'Path segment cannot contain / or null bytes',
        arbitrary: {
          constraint: { patterns: [segmentPatternSource] },
        },
      }),
      S.makeFilter((s) => s !== '.' && s !== '..', {
        message: '"." and ".." are traversal references, not segment names',
        arbitrary: segmentTextArbitrary,
      }),
    ),
    S.brand('Segment'),
  ),
) {
  /**
   * Variant schema carrying a realistic generation bias — same set as
   * {@link Segment} (candidate output is validated by its filters); only
   * `Schema.toArbitrary` output differs, mixing realistic names 20:1 over
   * the full valid space. Compose it into container schemas and derivation
   * picks up the bias.
   */
  static readonly Realistic = Segment_.pipe(
    withArbitraryHints({
      candidate: {
        // 20:1 over the canonical distribution, whose own generation weight is
        // 9 — base (1) + the segmentTextArbitrary candidate (8) above.
        weight: 20 * 9,
        make: (fc) => fc.stringMatching(realisticSegmentPattern),
      },
    }),
  )
}

export const Segment = Segment_
export type Segment = typeof Segment_.Type

/**
 * Validate a raw string as a {@link Segment} (throws on invalid input).
 * The ergonomic constructor for literal segments: `segment('lib')`.
 */
export const segment = (input: string): Segment => S.decodeSync(Segment_)(input)
