import { Schema as S } from 'effect'
import { Schema } from '../Schema.js'

/**
 * Type guard to check if a value is any Path type.
 */
export const is = S.is(Schema)
