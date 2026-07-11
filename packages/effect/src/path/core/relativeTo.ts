import { Array, Option } from 'effect'
import type { Abs } from '../models/Abs.js'
import type { AbsDir } from '../models/AbsDir.js'
import type { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'
import type { Segment } from '../models/segment.js'
import { commonSegmentPrefix } from './segments.js'

const makeRel = (path: Abs | Rel, ascent: number, segments: readonly Segment[]): Rel =>
  path._tag === 'AbsFile' || path._tag === 'RelFile'
    ? RelFile.make({ dir: RelDir.make({ ascent, segments }), fileName: path.fileName })
    : RelDir.make({ ascent, segments })

/** Express an absolute path relative to an absolute directory. */
export const relativeToAbsValue = (path: Abs, base: AbsDir): Rel => {
  const shared = commonSegmentPrefix(path.segments, base.segments).length
  const ascent = base.segments.length - shared
  const segments = Array.drop(path.segments, shared)
  return makeRel(path, ascent, segments)
}

/** Express a relative path relative to a relative directory when representable. */
export const relativeToRelValue = (path: Rel, base: RelDir): Option.Option<Rel> => {
  if (path.ascent < base.ascent) return Option.none()

  if (path.ascent > base.ascent) {
    return Option.some(
      makeRel(path, base.segments.length + (path.ascent - base.ascent), path.segments),
    )
  }

  const shared = commonSegmentPrefix(path.segments, base.segments).length
  const ascent = base.segments.length - shared
  const segments = Array.drop(path.segments, shared)
  return Option.some(makeRel(path, ascent, segments))
}
