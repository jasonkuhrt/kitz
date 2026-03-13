import { Schema } from 'effect'

/**
 * Extract string type or never from a type parameter.
 */
export type StringOrNever<$Type> = $Type extends string ? $Type : never

/**
 * Re-export Schema from Effect for convenience.
 */
export { Schema, Schema as S } from 'effect'

/**
 * Any schema type alias for convenience.
 */
export type AnySchema = Schema.Top
