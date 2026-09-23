import { Schema as S } from 'effect'
import { NaturalInt } from '../../schema/NaturalInt.js'

/** Maximum modeled relative ascent, aligned with the 4096-byte POSIX PATH_MAX ceiling. */
export const maxAscent = 4096

/**
 * Relative ascent — the count of leading `..` steps — bounded to 0..4096
 * inclusive. POSIX PATH_MAX is 4096 bytes, so a real path cannot approach this
 * many `../` components.
 */
export const Ascent = NaturalInt.pipe(S.check(S.isLessThanOrEqualTo(maxAscent)))

/**
 * The ascent reached by navigating up to `ascent` steps, saturating at
 * {@link maxAscent}: navigation past the ceiling stays at it.
 */
export const saturateAscent = (ascent: number): typeof Ascent.Type =>
  Ascent.make(Math.min(ascent, maxAscent))
