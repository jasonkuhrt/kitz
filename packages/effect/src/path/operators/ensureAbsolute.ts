import { Function as Fn, Schema as S } from 'effect'
import { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { Path } from '../models/Path.js'
import { Rel } from '../models/Rel.js'
import { join } from './join.js'
import type { toAbs } from './toAbs.js'

/** Type-level {@link ensureAbsolute}: absolute paths pass through; relative become absolute. */
export type ensureAbsolute<P extends Path> = P extends Abs ? P : P extends Rel ? toAbs<P> : never

/**
 * Ensure a path is absolute, resolving a relative path against `base`. Absolute
 * inputs are returned unchanged.
 *
 * Dual: data-first `ensureAbsolute(path, base)` or data-last `ensureAbsolute(base)`
 * for piping.
 *
 * @example
 * ```ts
 * ensureAbsolute(relFile, cwd)         // AbsFile resolved against cwd
 * pipe(relFile, ensureAbsolute(cwd))   // same, data-last
 * ```
 */
export const ensureAbsolute: {
  <P extends Path>(path: P, base: AbsDir): ensureAbsolute<P>
  (base: AbsDir): <P extends Path>(path: P) => ensureAbsolute<P>
} = Fn.dual(
  2,
  (path: Path, base: AbsDir): Path => (S.is(Abs)(path) ? path : join(base, path as Rel)),
)
