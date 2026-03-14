import { Option, Schema as S } from 'effect'
import * as Segment from './segment.js'

/**
 * Schema for validating arrays of path segments.
 * Used by all path member types to represent directory structure.
 */
const SegmentsArray = S.Array(Segment.Segment)

/**
 * Segments field with default empty array for TaggedClass definitions.
 * Required in the Type, optional in the constructor (defaults to []).
 */
export const Segments = SegmentsArray.pipe(
  S.withConstructorDefault(() => Option.some([] as S.Schema.Type<typeof SegmentsArray>)),
)
