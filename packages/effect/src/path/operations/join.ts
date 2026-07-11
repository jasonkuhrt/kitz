import { Function as Fn, Match, Schema as S } from 'effect'
import type { FromTargetLiteral, LiteralGuard } from '../core/literal.js'
import { Any } from '../models/Any.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Ascent } from '../models/arbitrary.js'
import { Dir } from '../models/Dir.js'
import { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

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

/** Type-level variadic {@link join}: left-folds a non-empty relative path tuple. */
export type JoinMany<$Base extends Dir, $Parts extends JoinParts> = $Parts extends readonly [
  infer $Only extends Rel,
]
  ? Join<$Base, $Only>
  : $Parts extends readonly [infer $Head extends RelDir, ...infer $Tail extends JoinParts]
    ? Join<$Base, $Head> extends Dir
      ? JoinMany<Join<$Base, $Head>, $Tail>
      : never
    : never

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
 * Join one or more relative paths onto a base directory. Leading `..` steps in `rel`
 * consume trailing segments of `dir`; leftovers drop at an absolute root (the
 * POSIX `/..` clamp) or fold into the result's `ascent`. Keeps `dir`'s
 * absoluteness and `rel`'s file/dir nature. The variadic data-first form is a
 * left fold; all intermediate relative parts must be directories. The data-last
 * form stays binary only. Every path position accepts either a decoded value or
 * a statically known string literal; literals desugar through `Path.make`, while
 * dynamic strings are rejected.
 *
 * @example
 * ```ts
 * join(dir, rel)         // AbsFile /home/user/src/index.ts
 * join(dir, relDir, rel) // left fold
 * pipe(dir, join(rel))   // same, data-last
 * ```
 */
export const join: {
  <
    const $Args extends
      | readonly [Rel | string]
      | readonly [Dir | string, Rel | string, ...(Rel | string)[]],
  >(
    ...args: {
      readonly [$Index in keyof $Args]: $Args extends readonly [Rel | string]
        ? $Args[$Index] extends string
          ? LiteralGuard<$Args[$Index], Rel>
          : $Args[$Index]
        : $Index extends '0'
          ? $Args[$Index] extends string
            ? LiteralGuard<$Args[$Index], Dir>
            : $Args[$Index]
          : $Index extends keyof ($Args extends readonly [...infer $Prefix, unknown]
                ? $Prefix
                : never)
            ? $Args[$Index] extends string
              ? LiteralGuard<$Args[$Index], RelDir>
              : $Args[$Index] & RelDir
            : $Args[$Index] extends string
              ? LiteralGuard<$Args[$Index], Rel>
              : $Args[$Index]
    }
  ): $Args extends readonly [infer $Part extends Rel | string]
    ? <const $Base extends Dir | string>(
        base: $Base extends string ? LiteralGuard<$Base, Dir> : $Base,
      ) => Join<
        $Base extends string
          ? FromTargetLiteral<$Base, Dir> extends infer $NormalizedBase extends Dir
            ? $NormalizedBase
            : never
          : $Base,
        $Part extends string
          ? FromTargetLiteral<$Part, Rel> extends infer $NormalizedPart extends Rel
            ? $NormalizedPart
            : never
          : $Part
      >
    : $Args extends readonly [
          infer $Base extends Dir | string,
          ...infer $Parts extends readonly [Rel | string, ...(Rel | string)[]],
        ]
      ? JoinMany<
          $Base extends string
            ? FromTargetLiteral<$Base, Dir> extends infer $NormalizedBase extends Dir
              ? $NormalizedBase
              : never
            : $Base,
          $Parts extends readonly [
            ...infer $Initial extends readonly (Rel | string)[],
            infer $Last extends Rel | string,
          ]
            ? readonly [
                ...{
                  readonly [$Index in keyof $Initial]: $Initial[$Index] extends string
                    ? FromTargetLiteral<$Initial[$Index], RelDir>
                    : $Initial[$Index]
                },
                $Last extends string ? FromTargetLiteral<$Last, Rel> : $Last,
              ] extends infer $NormalizedParts extends JoinParts
              ? $NormalizedParts
              : never
            : never
        >
      : never
} = Fn.dual(
  (args) => args.length >= 2,
  (dir: Dir | string, ...rels: readonly (Rel | string)[]): Any => {
    const dirValue: Dir = typeof dir === 'string' ? (S.decodeSync(Dir)(dir) as any) : dir
    let result: Any = dirValue

    for (const [index, rel] of rels.entries()) {
      const isFinal = index === rels.length - 1
      const relValue: Rel =
        typeof rel === 'string'
          ? isFinal
            ? (S.decodeSync(Rel)(rel) as any)
            : (S.decodeSync(RelDir)(rel) as any)
          : rel
      result = joinBinary(result as any, relValue)
    }

    return result
  },
)
