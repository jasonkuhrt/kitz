import { Schema as S } from 'effect'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { Segment } from './segment.js'

const maxAscent = 8

/** Generation-only bound for path segment arrays, shared by the models' `Realistic` variants. */
export const maxSegments = 6

/** Generation-only bound for relative ascent. The model still accepts any natural int. */
export const Ascent = NaturalInt.pipe(
  S.annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 0, max: maxAscent }),
  }),
)

/** Generation-only bound for path segment arrays. The model still accepts arrays of any length. */
export const Segments = S.Array(Segment).pipe(
  S.annotate({
    toArbitrary: () => (fc) => fc.array(S.toArbitrary(Segment), { maxLength: maxSegments }),
  }),
)
