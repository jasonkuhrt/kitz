import { Function as Fn, Match } from 'effect'
import type { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import type { Any } from '../models/Any.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'
import { join } from './join.js'

/** Type-level {@link ensureAbs}: absolute paths pass through; relatives become absolute. */
export type EnsureAbs<P extends Any> = P extends Abs
  ? P
  : P extends RelFile
    ? AbsFile
    : P extends RelDir
      ? AbsDir
      : never

/**
 * Ensure a path is absolute, resolving a relative path against `base`; absolute
 * inputs pass through. Dual: `ensureAbs(path, base)` or `ensureAbs(base)` for
 * piping.
 */
export const ensureAbs: {
  <P extends Any>(path: P, base: AbsDir): EnsureAbs<P>
  (base: AbsDir): <P extends Any>(path: P) => EnsureAbs<P>
} = Fn.dual(
  2,
  (path: Any, base: AbsDir): Abs =>
    Match.value(path).pipe(
      Match.tagsExhaustive({
        AbsFile: (abs) => abs,
        AbsDir: (abs) => abs,
        RelFile: (rel) => join(base, rel),
        RelDir: (rel) => join(base, rel),
      }),
    ),
)
