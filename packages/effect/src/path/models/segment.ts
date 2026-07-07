import { Schema as S } from 'effect'

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
) {}

export const Segment = Segment_
export type Segment = typeof Segment_.Type

/**
 * Validate a raw string as a {@link Segment} (throws on invalid input).
 * The ergonomic constructor for literal segments: `segment('lib')`.
 */
export const segment = (input: string): Segment => S.decodeSync(Segment_)(input)
