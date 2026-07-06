import { Schema as S } from 'effect'

/**
 * A single path segment — a POSIX-safe name component: non-empty, no `/` or NUL,
 * and not a `.`/`..` traversal reference (those are resolved by the analyzer into
 * the path's `ascent` count, never stored as segments).
 */
export class Segment_ extends S.asClass(
  S.String.pipe(
    S.check(
      S.makeFilter((s) => s.length > 0, { message: 'Path segment cannot be empty' }),
      S.isPattern(/^[^/\u0000]+$/, { message: 'Path segment cannot contain / or null bytes' }),
      S.makeFilter((s) => s !== '.' && s !== '..', {
        message: '"." and ".." are traversal references, not segment names',
      }),
    ),
  ),
) {}

export const Segment = Segment_
export type Segment = typeof Segment_.Type
