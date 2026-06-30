import { Schema as S } from 'effect'

/**
 * A single path segment — a POSIX-safe name component: non-empty, no `/` or NUL,
 * and not a `.`/`..` traversal reference (those are resolved by the analyzer into
 * the path's `back` count, never stored as segments).
 */
export class Segment extends S.asClass(
  S.String.pipe(
    S.check(
      S.makeFilter((s) => s.length > 0, { message: 'Path segment cannot be empty' }),
      S.isPattern(/^[^/\u0000]+$/, { message: 'Path segment cannot contain / or null bytes' }),
      S.makeFilter((s) => s !== '.' && s !== '..', {
        message: '"." and ".." are traversal references, not segment names',
      }),
    ),
  ),
) {
  /** The trailing segment name, or empty string when there are none (a path's basename). */
  static basename(segments: readonly string[]): string {
    return segments.at(-1) ?? ''
  }
}
