import { Schema as S } from 'effect'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { realisticSegmentPattern } from '../core/realisticText.js'

const nullByte = String.fromCharCode(0)
const segmentPatternSource = `^[^/${nullByte}]+$`
const segmentPattern = new RegExp(segmentPatternSource)

const isSegmentText = (s: string): boolean =>
  s.length > 0 && !s.includes('/') && !s.includes(nullByte) && s !== '.' && s !== '..'

// Canonical generation mixes three equal-weight sources so the derived
// arbitrary is domain-faithful — covering the whole valid set without
// over-biasing any sub-region (biased distributions are variant schemas,
// e.g. `Realistic` below):
//   1. the pattern-derived base generator (printable ASCII; weight pinned at 1)
//   2. fast-check dictionary text (adversarial JS names like `__proto__`)
//   3. full-codepoint unicode text (`fc.stringMatching`/`fc.string` never
//      leave printable ASCII on their own — see docs/learnings/effect-arbitrary.md)
const canonicalGenerationWeight = 3

const dictionaryTextArbitrary = {
  constraint: { minLength: 1, maxLength: 32, patterns: [segmentPatternSource] },
  candidate: {
    weight: 1,
    make: (fc: typeof import('effect/testing').FastCheck) =>
      fc.string({ minLength: 1, maxLength: 32 }).filter(isSegmentText),
  },
} satisfies S.Annotations.ToArbitrary.Filter

const unicodeTextArbitrary = {
  constraint: { patterns: [segmentPatternSource] },
  candidate: {
    weight: 1,
    make: (fc: typeof import('effect/testing').FastCheck) =>
      fc.string({ unit: 'binary', minLength: 1, maxLength: 32 }).filter(isSegmentText),
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
        arbitrary: unicodeTextArbitrary,
      }),
      S.makeFilter((s) => s !== '.' && s !== '..', {
        message: '"." and ".." are traversal references, not segment names',
        arbitrary: dictionaryTextArbitrary,
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
        // 20:1 over the canonical distribution — candidate weights compound,
        // so the ratio is against the canonical total, not against 1.
        weight: 20 * canonicalGenerationWeight,
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
