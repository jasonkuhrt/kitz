import { Array, Option } from 'effect'
import type { Abs } from '../models/Abs.js'
import type { AbsDir } from '../models/AbsDir.js'
import { Ascent, maxAscent } from '../models/ascent.js'
import type { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'
import type { Segment } from '../models/segment.js'
import { commonSegmentPrefix } from './segments.js'

const makeRel = (path: Abs | Rel, ascent: number, segments: readonly Segment[]): Rel =>
  path._tag === 'AbsFile' || path._tag === 'RelFile'
    ? RelFile.make({
        dir: RelDir.make({ ascent: Ascent.make(ascent), segments }),
        fileName: path.fileName,
      })
    : RelDir.make({ ascent: Ascent.make(ascent), segments })

/** Express an absolute path relative to an absolute directory. */
export const relativeToAbsValue = (path: Abs, base: AbsDir): Rel => {
  const shared = commonSegmentPrefix(path.segments, base.segments).length
  const ascent = base.segments.length - shared
  const segments = Array.drop(path.segments, shared)
  return makeRel(path, ascent, segments)
}

/**
 * Express a relative path relative to a relative directory when representable:
 * the path must not sit at a shallower unknown anchor than the base, and the
 * walk up — out of every unshared base segment, then up the ascent difference —
 * must fit the ascent ceiling.
 */
export const relativeToRelValue = (path: Rel, base: RelDir): Option.Option<Rel> => {
  if (path.ascent < base.ascent) return Option.none()

  // Different ascents mean different anchors, so no known segments are shared.
  const shared =
    path.ascent === base.ascent ? commonSegmentPrefix(path.segments, base.segments).length : 0
  const ascent = base.segments.length - shared + (path.ascent - base.ascent)
  if (ascent > maxAscent) return Option.none()

  return Option.some(makeRel(path, ascent, Array.drop(path.segments, shared)))
}
