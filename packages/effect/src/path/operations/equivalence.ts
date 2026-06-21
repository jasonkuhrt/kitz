import { Schema as S } from 'effect'
import { Schema } from '../Schema.js'

/**
 * Equivalence instance for comparing Path instances.
 * Uses Effect Schema's equivalence to perform deep structural equality.
 */
export const equivalence = S.toEquivalence(Schema)
