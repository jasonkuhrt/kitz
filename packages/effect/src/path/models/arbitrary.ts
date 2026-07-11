import { Schema as S } from 'effect'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { Segment } from './segment.js'

/** Maximum modeled relative ascent, aligned with the 4096-byte POSIX PATH_MAX ceiling. */
export const maxAscent = 4096

const maxGeneratedAscent = 8

/** Generation-only bound for path segment arrays, shared by the models' `Realistic` variants. */
export const maxSegments = 6

/**
 * Relative ascent is bounded to 0..4096 inclusive. POSIX PATH_MAX is 4096
 * bytes, so a real path cannot approach this many `../` components; arbitrary
 * generation stays biased to the smaller 0..8 range for useful samples.
 */
export const Ascent = NaturalInt.pipe(
  S.check(S.isLessThanOrEqualTo(maxAscent)),
  S.annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 0, max: maxGeneratedAscent }),
  }),
)

/** Generation-only bound for path segment arrays. The model still accepts arrays of any length. */
export const Segments = S.Array(Segment).pipe(
  S.annotate({
    toArbitrary: () => (fc) => fc.array(S.toArbitrary(Segment), { maxLength: maxSegments }),
  }),
)
