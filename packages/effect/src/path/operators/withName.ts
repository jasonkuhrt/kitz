import { Array, Function as Fn, Match, Option } from 'effect'
import type { Dir } from '../models/Dir.js'
import type { File } from '../models/File.js'
import type { FileName } from '../models/FileName.js'
import type { Segment } from '../models/segment.js'
import * as AbsDirModel from '../models/AbsDir.js'
import * as RelDirModel from '../models/RelDir.js'
import * as PathOptic from '../optic.js'

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
 * Rename the final component of a path. Files take a full `FileName` and return
 * the same file variant. Directories take a `Segment` and return `None` for
 * root or segment-less relative dirs.
 *
 * @example
 * ```ts
 * withName(file, FileName.make({ stem: 'index', extension: Option.some('.ts') }))
 * withName(dir, 'src')
 * ```
 */
export const withName: {
  <F extends File>(path: F, name: FileName): F
  <D extends Dir>(path: D, name: Segment): Option.Option<D>
  (name: FileName): <F extends File>(path: F) => F
  (name: Segment): <D extends Dir>(path: D) => Option.Option<D>
} = Fn.dual(2, (path: File | Dir, name: FileName | Segment): File | Option.Option<Dir> =>
  Match.value(path).pipe(
    Match.tagsExhaustive({
      AbsFile: (abs) => PathOptic.AbsFile.fileName.replace(name as FileName, abs),
      RelFile: (rel) => PathOptic.RelFile.fileName.replace(name as FileName, rel),
      AbsDir: (dir) => renameAbsDir(dir, name as Segment),
      RelDir: (dir) => renameRelDir(dir, name as Segment),
    }),
  ),
)
