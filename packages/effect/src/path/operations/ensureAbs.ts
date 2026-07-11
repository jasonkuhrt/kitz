import { Function as Fn, Match, Schema as S } from 'effect'
import type { FromLiteral, LiteralGuard } from '../core/literal.js'
import type { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Any } from '../models/Any.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'
import { join } from './join.js'

/** Type-level {@link ensureAbs}: absolute paths pass through; relatives become absolute. */
export type EnsureAbs<$P extends Any> = $P extends Abs
  ? $P
  : $P extends RelFile
    ? AbsFile
    : $P extends RelDir
      ? AbsDir
      : never

/**
 * Ensure a path is absolute, resolving a relative path against `base`; absolute
 * inputs pass through. Every path position accepts either a decoded value or a
 * statically known string literal; literals desugar through `Path.make`, while
 * dynamic strings are rejected. Dual: `ensureAbs(path, base)` or
 * `ensureAbs(base)` for piping.
 */
export const ensureAbs: {
  <const $Path extends Any | string, const $Base extends AbsDir | string>(
    path: $Path extends string ? LiteralGuard<$Path, Any> : $Path,
    base: $Base extends string ? LiteralGuard<$Base, AbsDir> : $Base,
  ): EnsureAbs<$Path extends string ? FromLiteral<$Path> : $Path>
  <const $Base extends AbsDir | string>(
    base: $Base extends string ? LiteralGuard<$Base, AbsDir> : $Base,
  ): <const $Path extends Any | string>(
    path: $Path extends string ? LiteralGuard<$Path, Any> : $Path,
  ) => EnsureAbs<$Path extends string ? FromLiteral<$Path> : $Path>
} = Fn.dual(2, (path: Any | string, base: AbsDir | string): Abs => {
  const pathValue = typeof path === 'string' ? S.decodeSync(Any)(path) : path
  const baseValue: AbsDir = typeof base === 'string' ? (S.decodeSync(AbsDir)(base) as any) : base

  return Match.value(pathValue).pipe(
    Match.tagsExhaustive({
      AbsFile: (abs) => abs,
      AbsDir: (abs) => abs,
      RelFile: (rel) => join(baseValue, rel),
      RelDir: (rel) => join(baseValue, rel),
    }),
  )
})
