import { Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import type { Types } from '../../types/_.js'
import { nullByte } from '../core/grammar.js'
import type { ascent, here, separator } from '../core/grammar.js'
import type { requiresLiteral } from '../core/messages.js'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { realisticSegmentPattern } from '../core/realisticText.js'

// This pattern is one of four composed checks; non-empty, well-formed Unicode,
// and traversal rules live in the full check chain. SegmentLiteralGuard mirrors
// every part representable by TypeScript's string-template type system.
const segmentPatternSource = `^[^/${nullByte}]+$`
const segmentPattern = new RegExp(segmentPatternSource)

type emptySegmentMessage = 'Path segment cannot be empty'
const emptySegmentMessage: emptySegmentMessage = 'Path segment cannot be empty'

type patternSegmentMessage = 'Path segment cannot contain / or NUL'
const patternSegmentMessage: patternSegmentMessage = 'Path segment cannot contain / or NUL'

type traversalSegmentMessage = '"." and ".." are traversal references, not segment names'
const traversalSegmentMessage: traversalSegmentMessage =
  '"." and ".." are traversal references, not segment names'

const wellFormedSegmentMessage = 'Path segment must be well-formed Unicode'

type separatorSegmentMessage = "Path segment cannot contain '/'"
export const separatorSegmentMessage: separatorSegmentMessage = "Path segment cannot contain '/'"

type nullByteSegmentMessage = 'Path segment cannot contain NUL'
export const nullByteSegmentMessage: nullByteSegmentMessage = 'Path segment cannot contain NUL'

const isSegmentText = (s: string): boolean =>
  s.length > 0 &&
  s.isWellFormed() &&
  !s.includes('/') &&
  !s.includes(nullByte) &&
  s !== '.' &&
  s !== '..'

// Canonical generation mixes four equal-weight sources so the derived
// arbitrary is domain-faithful — covering the whole valid set without
// over-biasing any sub-region (biased distributions are variant schemas,
// e.g. `Realistic` below):
//   1. the pattern-derived base generator (printable ASCII; weight pinned at 1)
//   2. fast-check dictionary text (adversarial JS names like `__proto__`)
//   3. full-codepoint unicode text (`fc.stringMatching`/`fc.string` never
//      leave printable ASCII on their own — see docs/learnings/effect-arbitrary.md)
//   4. an explicitly well-formed full-codepoint source for that runtime check
const canonicalGenerationWeight = 4

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

const wellFormedTextArbitrary = {
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
export class Segment_ extends withStatics(
  S.asClass(
    S.String.pipe(
      S.check(
        S.isNonEmpty({ message: emptySegmentMessage }),
        S.isPattern(segmentPattern, {
          message: patternSegmentMessage,
          arbitrary: unicodeTextArbitrary,
        }),
        S.makeFilter((s) => s.isWellFormed(), {
          message: wellFormedSegmentMessage,
          arbitrary: wellFormedTextArbitrary,
        }),
        S.makeFilter((s) => s !== '.' && s !== '..', {
          message: traversalSegmentMessage,
          arbitrary: dictionaryTextArbitrary,
        }),
      ),
      S.brand('Segment'),
    ),
  ),
) {
  /**
   * Construct a segment. Literals are validated statically; widened strings
   * retain the schema's runtime validation behavior.
   */
  static override make<const $Input extends string>(
    input: SegmentMakeInput<$Input>,
    options?: S.MakeOptions,
  ): Segment {
    return super.make(input as any, options)
  }

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

type SegmentMakeInput<$Input extends string> =
  Types.IsLiteral<$Input> extends true ? SegmentLiteralGuard<$Input, 'Path.Segment.make'> : $Input

type IsValidSegmentLiteral<$S extends string> = $S extends '' | here | ascent
  ? false
  : $S extends `${string}${separator}${string}` | `${string}${nullByte}${string}`
    ? false
    : true

type ErrorMalformedSegmentLiteral<$Received extends string> = $Received extends ''
  ? Types.StaticError<emptySegmentMessage>
  : $Received extends here | ascent
    ? Types.StaticError<traversalSegmentMessage>
    : $Received extends `${string}${separator}${string}`
      ? Types.StaticError<separatorSegmentMessage>
      : Types.StaticError<nullByteSegmentMessage>

/** Guard a POSIX path-segment literal against the runtime Segment grammar. */
export type SegmentLiteralGuard<$S extends string, $Subject extends string> =
  Types.IsLiteral<$S> extends true
    ? IsValidSegmentLiteral<$S> extends true
      ? $S
      : ErrorMalformedSegmentLiteral<$S>
    : Types.StaticError<
        requiresLiteral<
          $Subject,
          's',
          'Use a widened string for runtime validation through Path.Segment.'
        >
      >

/**
 * Validate a raw string as a {@link Segment} (throws on invalid input).
 * The ergonomic constructor for literal segments: `segment('lib')`.
 */
export const segment = (input: string): Segment => S.decodeSync(Segment_)(input)
