import { Schema as S } from 'effect'

/**
 * A single path segment — a POSIX-safe name component: non-empty, no `/` or NUL,
 * and not a `.`/`..` traversal reference (those are resolved by the analyzer into
 * the path's `back` count, never stored as segments).
 */
export const Segment = S.String.pipe(
  S.check(
    S.makeFilter((s) => s.length > 0, { message: 'Path segment cannot be empty' }),
    // oxlint-disable-next-line no-control-regex -- matching NUL is intentional: POSIX segments may not contain it.
    S.isPattern(/^[^/\u0000]+$/, { message: 'Path segment cannot contain / or null bytes' }),
    S.makeFilter((s) => s !== '.' && s !== '..', {
      message: '"." and ".." are traversal references, not segment names',
    }),
  ),
)
export type Segment = typeof Segment.Type
