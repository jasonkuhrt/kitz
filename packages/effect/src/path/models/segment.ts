import { Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import type { Types } from '../../types/_.js'
import { nullByte } from '../core/grammar.js'
import type { ascent, here, separator } from '../core/grammar.js'
import type { requiresLiteral } from '../core/messages.js'

// This pattern is one of four composed checks; non-empty, well-formed Unicode,
// and traversal rules live in the full check chain. SegmentLiteralGuard mirrors
// every part representable by TypeScript's string-template type system. The `u`
// flag makes the class range over code points, so pattern-derived generation
// also emits astral characters; validation is the same either way.
const segmentPattern = new RegExp(`^[^/${nullByte}]+$`, 'u')

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

/**
 * A single path segment — a POSIX-safe name component: non-empty, no `/` or NUL,
 * and not a `.`/`..` traversal reference (those are resolved by the analyzer into
 * the path's `ascent` count, never stored as segments).
 */
export class Segment_ extends withStatics(
  S.String.pipe(
    S.check(
      S.isNonEmpty({ message: emptySegmentMessage }),
      S.isPattern(segmentPattern, { message: patternSegmentMessage }),
      S.makeFilter((s) => s.isWellFormed(), { message: wellFormedSegmentMessage }),
      S.makeFilter((s) => s !== '.' && s !== '..', { message: traversalSegmentMessage }),
    ),
    S.brand('Segment'),
  ),
) {
  /**
   * Construct a segment. Literals are validated statically; widened strings
   * retain the schema's runtime validation behavior.
   */
  static override make<const $Input extends string>(
    input: SegmentMakeInput<$Input>,
    options: S.MakeOptions | undefined,
  ): Segment
  static override make<const $Input extends string>(input: SegmentMakeInput<$Input>): Segment
  static override make<const $Input extends string>(
    input: SegmentMakeInput<$Input>,
    options?: S.MakeOptions,
  ): Segment {
    return super.make(input as any, options)
  }
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
