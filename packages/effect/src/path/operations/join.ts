import { Function as Fn, Match, Schema as S } from 'effect'
import type { FromTargetLiteral, LiteralGuard } from '../core/literal.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Any } from '../models/Any.js'
import { Ascent } from '../models/arbitrary.js'
import { Dir } from '../models/Dir.js'
import { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

type JoinLiteralGuard<$S extends string, $Target> = LiteralGuard<$S, $Target, 'Path.join'>

type JoinAllLiteralGuard<$S extends string, $Target> = LiteralGuard<$S, $Target, 'Path.joinAll'>

/**
 * Type-level {@link join}: the result keeps the base's absoluteness and the
 * relative path's file/dir nature.
 */
export type Join<$Base extends Dir, $P extends Rel> = $Base extends AbsDir
  ? $P extends RelFile
    ? AbsFile
    : $P extends RelDir
      ? AbsDir
      : never
  : $Base extends RelDir
    ? $P extends RelFile
      ? RelFile
      : $P extends RelDir
        ? RelDir
        : never
    : never

type JoinParts = readonly [...RelDir[], Rel]
type JoinPartsInput = readonly [Rel | string, ...(Rel | string)[]]

/** Type-level {@link joinAll}: left-folds a non-empty relative path tuple. */
export type JoinAll<$Base extends Dir, $Parts extends JoinParts> = $Parts extends readonly [
  infer $Only extends Rel,
]
  ? Join<$Base, $Only>
  : $Parts extends readonly [infer $Head extends RelDir, ...infer $Tail extends JoinParts]
    ? Join<$Base, $Head> extends Dir
      ? JoinAll<Join<$Base, $Head>, $Tail>
      : never
    : never

type NormalizeDir<$Base extends Dir | string> = $Base extends string
  ? FromTargetLiteral<$Base, Dir> extends infer $Normalized extends Dir
    ? $Normalized
    : never
  : $Base

type NormalizeRel<$Part extends Rel | string> = $Part extends string
  ? FromTargetLiteral<$Part, Rel> extends infer $Normalized extends Rel
    ? $Normalized
    : never
  : $Part

type NormalizeJoinParts<$Parts extends JoinPartsInput> = $Parts extends readonly [
  ...infer $Initial extends readonly (Rel | string)[],
  infer $Last extends Rel | string,
]
  ? readonly [
      ...{
        readonly [$Index in keyof $Initial]: $Initial[$Index] extends string
          ? FromTargetLiteral<$Initial[$Index], RelDir>
          : $Initial[$Index]
      },
      NormalizeRel<$Last>,
    ] extends infer $Normalized extends JoinParts
    ? $Normalized
    : never
  : never

type GuardJoinParts<$Parts extends JoinPartsInput> = {
  readonly [$Index in keyof $Parts]: $Index extends keyof ($Parts extends readonly [
    ...infer $Initial,
    unknown,
  ]
    ? $Initial
    : never)
    ? $Parts[$Index] extends string
      ? JoinAllLiteralGuard<$Parts[$Index], RelDir>
      : $Parts[$Index] & RelDir
    : $Parts[$Index] extends string
      ? JoinAllLiteralGuard<$Parts[$Index], Rel>
      : $Parts[$Index]
}

const joinBinary: {
  <$Base extends Dir, $P extends Rel>(dir: $Base, rel: $P): Join<$Base, $P>
  <$P extends Rel>(rel: $P): <$Base extends Dir>(dir: $Base) => Join<$Base, $P>
} = Fn.dual(2, (dir: Dir, rel: Rel): Any => {
  const baseSegments = [...dir.segments]
  let remainingAscent = rel.ascent
  while (remainingAscent > 0 && baseSegments.length > 0) {
    baseSegments.pop()
    remainingAscent--
  }
  const segments = [...baseSegments, ...rel.segments]

  return Match.value(dir).pipe(
    Match.tagsExhaustive({
      AbsDir: () =>
        rel._tag === 'RelFile'
          ? AbsFile.make({ dir: AbsDir.make({ segments }), fileName: rel.fileName })
          : AbsDir.make({ segments }),
      RelDir: (relDir) => {
        const ascent = relDir.ascent + remainingAscent
        const checkedAscent = Ascent.make(ascent)
        return rel._tag === 'RelFile'
          ? RelFile.make({
              dir: RelDir.make({ ascent: checkedAscent, segments }),
              fileName: rel.fileName,
            })
          : RelDir.make({ ascent: checkedAscent, segments })
      },
    }),
  )
})

/**
 * Join one relative path onto a base directory. Leading `..` steps consume
 * trailing base segments; leftovers clamp at an absolute root or fold into a
 * relative result's ascent. The result keeps the base's group and the part's
 * file/dir nature. Dual: `join(base, part)` or `join(part)(base)`. Both
 * positions accept decoded values or statically known literals.
 */
export const join: {
  <const $Base extends Dir | string, const $Part extends Rel | string>(
    base: $Base extends string ? JoinLiteralGuard<$Base, Dir> : $Base,
    part: $Part extends string ? JoinLiteralGuard<$Part, Rel> : $Part,
  ): Join<NormalizeDir<$Base>, NormalizeRel<$Part>>
  <const $Part extends Rel | string>(
    part: $Part extends string ? JoinLiteralGuard<$Part, Rel> : $Part,
  ): <const $Base extends Dir | string>(
    base: $Base extends string ? JoinLiteralGuard<$Base, Dir> : $Base,
  ) => Join<NormalizeDir<$Base>, NormalizeRel<$Part>>
} = Fn.dual(2, (base: Dir | string, part: Rel | string): Any => {
  const baseValue: Dir = typeof base === 'string' ? (S.decodeSync(Dir)(base) as any) : base
  const partValue: Rel = typeof part === 'string' ? (S.decodeSync(Rel)(part) as any) : part
  return joinBinary(baseValue, partValue)
})

/**
 * Join a non-empty tuple of relative parts onto a base directory as a left
 * fold. Every part before the final one must be a directory. Dual:
 * `joinAll(base, parts)` or `joinAll(parts)(base)`. The base and tuple members
 * accept decoded values or statically known literals.
 */
export const joinAll: {
  <const $Base extends Dir | string, const $Parts extends JoinPartsInput>(
    base: $Base extends string ? JoinAllLiteralGuard<$Base, Dir> : $Base,
    parts: GuardJoinParts<$Parts>,
  ): JoinAll<NormalizeDir<$Base>, NormalizeJoinParts<$Parts>>
  <const $Parts extends JoinPartsInput>(
    parts: GuardJoinParts<$Parts>,
  ): <const $Base extends Dir | string>(
    base: $Base extends string ? JoinAllLiteralGuard<$Base, Dir> : $Base,
  ) => JoinAll<NormalizeDir<$Base>, NormalizeJoinParts<$Parts>>
} = Fn.dual(2, (base: Dir | string, parts: JoinPartsInput): Any => {
  const baseValue: Dir = typeof base === 'string' ? (S.decodeSync(Dir)(base) as any) : base
  let result: Any = baseValue

  for (const [index, part] of parts.entries()) {
    const isFinal = index === parts.length - 1
    const partValue: Rel =
      typeof part === 'string'
        ? isFinal
          ? (S.decodeSync(Rel)(part) as any)
          : (S.decodeSync(RelDir)(part) as any)
        : part
    result = joinBinary(result as any, partValue)
  }

  return result
}) as any
