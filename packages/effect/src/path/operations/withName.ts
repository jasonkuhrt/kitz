import { Array, Function as Fn, Match, Option } from 'effect'
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
 * return `None`.
 *
 * @example
 * ```ts
 * withName(dir, 'src')
 * pipe(dir, withName('src'))
 * ```
 */
export const withName: {
  <D extends Dir>(path: D, name: Segment): Option.Option<D>
  (name: Segment): <D extends Dir>(path: D) => Option.Option<D>
} = Fn.dual(
  2,
  (dir: Dir, name: Segment): Option.Option<Dir> =>
    Match.value(dir).pipe(
      Match.tagsExhaustive({
        AbsDir: (dir) => renameAbsDir(dir, name),
        RelDir: (dir) => renameRelDir(dir, name),
      }),
    ),
)
