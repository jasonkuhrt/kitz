import { Schema as S } from 'effect'
import { Path as Schema } from '../models/Path.js'

/**
 * Type guard to check if a value is any Path type.
 */
export const is = S.is(Schema)
