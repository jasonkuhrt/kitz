import { Array, Function as Fn, Match, Option, Schema as S } from 'effect'
import type { FromTargetLiteral, LiteralGuard } from '../core/literal.js'
import { Dir } from '../models/Dir.js'
import { segment, type Segment, type SegmentLiteralGuard } from '../models/segment.js'
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
 * path literal; the name accepts a decoded `Segment` or validated segment literal.
 *
 * @example
 * ```ts
 * withName(dir, segment('src'))
 * pipe(dir, withName(segment('src')))
 * ```
 */
export const withName: {
  <const $D extends Dir | string, const $Name extends Segment | string>(
    path: $D extends string ? LiteralGuard<$D, Dir> : $D,
    name: $Name extends Segment ? $Name : $Name extends string ? SegmentLiteralGuard<$Name> : never,
  ): Option.Option<
    ($D extends string ? FromTargetLiteral<$D, Dir> : $D) extends infer $DirValue extends Dir
      ? $DirValue
      : never
  >
  <const $Name extends Segment | string>(
    name: $Name extends Segment ? $Name : $Name extends string ? SegmentLiteralGuard<$Name> : never,
  ): <const $D extends Dir | string>(
    path: $D extends string ? LiteralGuard<$D, Dir> : $D,
  ) => Option.Option<
    ($D extends string ? FromTargetLiteral<$D, Dir> : $D) extends infer $DirValue extends Dir
      ? $DirValue
      : never
  >
} = Fn.dual(2, (dir: Dir | string, name: Segment | string): Option.Option<Dir> => {
  const dirValue: Dir = typeof dir === 'string' ? (S.decodeSync(Dir)(dir) as any) : dir
  const nameValue: Segment = typeof name === 'string' ? segment(name) : name

  return Match.value(dirValue).pipe(
    Match.tagsExhaustive({
      AbsDir: (dir) => renameAbsDir(dir, nameValue),
      RelDir: (dir) => renameRelDir(dir, nameValue),
    }),
  )
})
