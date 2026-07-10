import { Array, Function as Fn, Match, Option, Schema as S } from 'effect'
import type { ErrorPathValidation, FromLiteral, LiteralInput } from '../core/literal.js'
import { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'
import type { Segment } from '../models/segment.js'
import * as AbsDirModel from '../models/AbsDir.js'
import * as RelDirModel from '../models/RelDir.js'

const renameAbsDir = (dir: AbsDirModel.AbsDir, name: Segment): Option.Option<AbsDirModel.AbsDir> =>
  dir.segments.length === 0
    ? Option.none()
    : Option.some(
        AbsDirModel.AbsDir.make({ segments: [...Array.dropRight(dir.segments, 1), name] }),
      )

const renameRelDir = (dir: RelDirModel.RelDir, name: Segment): Option.Option<RelDirModel.RelDir> =>
  dir.segments.length === 0
    ? Option.none()
    : Option.some(
        RelDirModel.RelDir.make({
          ascent: dir.ascent,
          segments: [...Array.dropRight(dir.segments, 1), name],
        }),
      )

/**
 * Rename the final directory segment. Root and segment-less relative dirs
 * return `None`. The directory accepts a decoded value or statically known
 * path literal; the name remains a decoded `Segment` value.
 *
 * @example
 * ```ts
 * withName(dir, segment('src'))
 * pipe(dir, withName(segment('src')))
 * ```
 */
export const withName: {
  <const $D extends Dir | string>(
    path: $D extends string
      ? string extends $D
        ? LiteralInput<$D>
        : [FromLiteral<$D>] extends [never]
          ? ErrorPathValidation<Dir, $D>
          : FromLiteral<$D> extends Dir
            ? $D
            : ErrorPathValidation<Dir, $D>
      : $D,
    name: Segment,
  ): Option.Option<
    ($D extends string ? FromLiteral<$D> : $D) extends infer $DirValue extends Dir
      ? $DirValue
      : never
  >
  (
    name: Segment,
  ): <const $D extends Dir | string>(
    path: $D extends string
      ? string extends $D
        ? LiteralInput<$D>
        : [FromLiteral<$D>] extends [never]
          ? ErrorPathValidation<Dir, $D>
          : FromLiteral<$D> extends Dir
            ? $D
            : ErrorPathValidation<Dir, $D>
      : $D,
  ) => Option.Option<
    ($D extends string ? FromLiteral<$D> : $D) extends infer $DirValue extends Dir
      ? $DirValue
      : never
  >
} = Fn.dual(2, (dir: Dir | string, name: Segment): Option.Option<Dir> => {
  const dirValue: Dir = typeof dir === 'string' ? (S.decodeSync(Any)(dir) as any) : dir

  return Match.value(dirValue).pipe(
    Match.tagsExhaustive({
      AbsDir: (dir) => renameAbsDir(dir, name),
      RelDir: (dir) => renameRelDir(dir, name),
    }),
  )
})
