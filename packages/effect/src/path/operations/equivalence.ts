import { Schema as S } from 'effect'
import { Path as Schema } from '../models/Path.js'

/**
 * Equivalence instance for comparing Path instances.
 * Uses Effect Schema's equivalence to perform deep structural equality.
 */
export const equivalence = S.toEquivalence(Schema)
