import { Function as Fn, Option, Schema as S } from 'effect'
import type { Types } from '../../types/_.js'
import type { ErrorPathGroupMismatch, FromTargetLiteral, LiteralGuard } from '../core/literal.js'
import { groupMismatchMessage } from '../core/messages.js'
import { relativeToAbsValue, relativeToRelValue } from '../core/relativeTo.js'
import { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Any } from '../models/Any.js'
import { Dir } from '../models/Dir.js'
import { RelDir } from '../models/RelDir.js'
import { Rel } from '../models/Rel.js'
import { RelFile } from '../models/RelFile.js'

type RelativeToLiteralGuard<$S extends string, $Target> = LiteralGuard<
  $S,
  $Target,
  'Path.relativeTo'
>

type PathValue<$Path extends Any | string> = $Path extends string
  ? FromTargetLiteral<$Path, Any>
  : $Path

type BaseValue<$Base extends Dir | string> = $Base extends string
  ? FromTargetLiteral<$Base, Dir>
  : $Base

type ErrorRelativeToGroupNotNarrowed =
  Types.StaticError<'Path.relativeTo requires a path narrowed to one group. Narrow with Path.Abs.is or Path.Rel.is first.'>

type GroupKind<$Path extends Any> = [$Path] extends [never]
  ? 'Mixed'
  : [$Path] extends [Abs]
    ? 'Abs'
    : [$Path] extends [Rel]
      ? 'Rel'
      : 'Mixed'

type BaseArgument<$Base extends Dir | string, $Path extends Any> =
  GroupKind<$Path> extends 'Abs'
    ? [$Base] extends [string]
      ? RelativeToLiteralGuard<$Base & string, AbsDir>
      : [$Base] extends [AbsDir]
        ? $Base
        : ErrorPathGroupMismatch
    : GroupKind<$Path> extends 'Rel'
      ? [$Base] extends [string]
        ? RelativeToLiteralGuard<$Base & string, RelDir>
        : [$Base] extends [RelDir]
          ? $Base
          : ErrorPathGroupMismatch
      : ErrorRelativeToGroupNotNarrowed

type CurriedBaseArgument<$Base extends Dir | string> = [$Base] extends [string]
  ? RelativeToLiteralGuard<$Base & string, Dir>
  : [$Base] extends [AbsDir]
    ? $Base
    : [$Base] extends [RelDir]
      ? $Base
      : ErrorRelativeToGroupNotNarrowed

type PathArgument<$Path extends Any | string, $Expected extends Abs | Rel> = [$Path] extends [
  string,
]
  ? RelativeToLiteralGuard<$Path & string, $Expected>
  : [$Path] extends [$Expected]
    ? $Path
    : GroupKind<$Path & Any> extends 'Mixed'
      ? ErrorRelativeToGroupNotNarrowed
      : ErrorPathGroupMismatch

type PathArgumentForBase<$Path extends Any | string, $Base extends Dir | string> =
  GroupKind<BaseValue<$Base>> extends 'Abs'
    ? PathArgument<$Path, Abs>
    : GroupKind<BaseValue<$Base>> extends 'Rel'
      ? PathArgument<$Path, Rel>
      : ErrorRelativeToGroupNotNarrowed

type RelativeToResult<$Path extends Any> = [$Path] extends [Abs]
  ? RelativeTo<$Path>
  : [$Path] extends [Rel]
    ? Option.Option<RelativeTo<$Path>>
    : never

/** Type-level {@link relativeTo}: maps a path variant to its relative counterpart. */
export type RelativeTo<$A extends Abs | Rel> = $A extends AbsFile
  ? RelFile
  : $A extends RelFile
    ? RelFile
    : $A extends AbsDir
      ? RelDir
      : $A extends RelDir
        ? RelDir
        : Rel

/**
 * Express a same-group path relative to `base`, walking up out of `base` with
 * `..` for the segments they don't share. For absolute paths this is total. For
 * relative paths this returns `None` exactly when `target.ascent < base.ascent`,
 * because joining from a relative base cannot move to a shallower unknown
 * anchor. Otherwise it satisfies `join(base, relativeTo(target, base)) ===
 * target`.
 *
 * Rel×rel case analysis:
 * - `target.ascent === base.ascent`: share the known segment prefix and walk up
 *   from the unshared base suffix.
 * - `target.ascent > base.ascent`: walk up out of every base segment, then up
 *   the ascent difference; no known segments can be shared.
 * - `target.ascent < base.ascent`: not expressible from the available relative
 *   path data, so return `None`.
 *
 * Every path position accepts either a decoded value or a statically known
 * string literal; literals decode through the schema for their proven group,
 * while dynamic strings are rejected. Dual: `relativeTo(path, base)` or
 * `relativeTo(base)` for piping.
 *
 * @example
 * ```ts
 * relativeTo(AbsFile '/home/user/src/index.ts', AbsDir '/home/user') // ./src/index.ts
 * pipe(absFile, relativeTo(base))                                    // same, data-last
 * ```
 */
export const relativeTo: {
  <const $Path extends Any | string, const $Base extends Dir | string>(
    path: $Path extends string ? RelativeToLiteralGuard<$Path, Any> : $Path,
    base: BaseArgument<$Base, PathValue<$Path>>,
  ): RelativeToResult<PathValue<$Path>>
  <const $Base extends Dir | string>(
    base: CurriedBaseArgument<$Base>,
  ): <const $Path extends Any | string>(
    path: PathArgumentForBase<$Path, $Base>,
  ) => RelativeToResult<PathValue<$Path>>
} = Fn.dual(2, (path: Any | string, base: Dir | string): Rel | Option.Option<Rel> => {
  const baseValue: Dir = typeof base === 'string' ? (S.decodeSync(Dir)(base) as any) : base

  if (baseValue._tag === 'RelDir') {
    const pathValue: Rel =
      typeof path === 'string'
        ? S.decodeSync(Rel)(path)
        : Rel.is(path)
          ? path
          : throwGroupMismatch()
    return relativeToRelValue(pathValue, baseValue)
  }

  const pathValue: Abs =
    typeof path === 'string' ? S.decodeSync(Abs)(path) : Abs.is(path) ? path : throwGroupMismatch()
  return relativeToAbsValue(pathValue, baseValue)
})

const throwGroupMismatch = (): never => {
  throw new TypeError(groupMismatchMessage)
}
