import { Schema as S } from 'effect'
import type { Abs } from '../models/Abs.js'
import type { AbsDir } from '../models/AbsDir.js'
import type { Dir } from '../models/Dir.js'
import type { Path } from '../models/Path.js'
import { Rel } from '../models/Rel.js'
import type { RelDir } from '../models/RelDir.js'

/** Runtime predicate: whether a path belongs to the relative group. */
export const isRel = S.is(Rel)

/** Constrain a second path to the same group (absolute vs relative) as the first. */
export type MatchingTypeGroup<A extends Path> = {
  AbsFile: Abs
  AbsDir: Abs
  RelFile: Rel
  RelDir: Rel
}[A['_tag']]

/** The directory type of a path's own group — the type of a shared base. */
export type SharedBase<A extends Path> = {
  AbsFile: AbsDir
  AbsDir: AbsDir
  RelFile: RelDir
  RelDir: RelDir
}[A['_tag']]

/** Map any path to the directory type of its group (for ancestor / parent params). */
export type MatchingDirGroup<A extends Path> = {
  AbsFile: AbsDir
  AbsDir: AbsDir
  RelFile: RelDir
  RelDir: RelDir
}[A['_tag']]

/** Map a directory to its matching group (for child params when the parent is a `Dir`). */
export type MatchingTypeGroupForDir<A extends Dir> = {
  AbsDir: Abs
  RelDir: Rel
}[A['_tag']]
