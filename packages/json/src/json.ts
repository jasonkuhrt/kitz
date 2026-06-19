import { Schema as S } from 'effect'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Types
//
//

/**
 * JSON primitive type.
 * Matches: string, number, boolean, or null.
 *
 * @category Types
 */
export type Primitive = string | number | boolean | null

/**
 * JSON object type.
 *
 * @category Types
 */
export type Obj = { [key in string]?: Value }

/**
 * JSON value type.
 * Matches any valid JSON value: primitives, objects, or arrays (recursively).
 *
 * @category Types
 */
export type Value = Primitive | Obj | Value[]

// Export object type with alias
export { type Obj as Object }

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Schemas
//
//

/**
 * JSON primitive value schema.
 * Matches: string, number, boolean, or null.
 *
 * @category Schemas
 */
export const PrimitiveSchema = S.Union([S.String, S.Number, S.Boolean, S.Null])

/**
 * JSON value schema.
 * Matches any valid JSON value: primitives, objects, or arrays (recursively).
 *
 * @category Schemas
 */
// @ts-expect-error - Recursive type inference limitation
export const ValueSchema: S.Codec<Value, Value> = S.suspend(() =>
  S.Union([PrimitiveSchema, S.Array(ValueSchema), S.Record(S.String, ValueSchema)]),
)

/**
 * JSON object schema.
 * Matches objects with string keys and JSON values.
 *
 * @category Schemas
 */
export const ObjectSchema = S.Record(S.String, ValueSchema)

/**
 * Primary schema for JSON string parsing/serialization.
 * Transforms between string representation and typed JSON values.
 * Uses 2-space indentation for pretty-printing.
 *
 * @example
 * ```ts
 * // Decode from string
 * const value = S.decodeSync(Json.Schema)('{"foo": 1}')
 *
 * // Encode to string
 * const str = S.encodeSync(Json.Schema)(value)
 * ```
 *
 * @category Schemas
 */
export const Schema = S.fromJsonString(ValueSchema).annotate({
  identifier: 'Json',
  title: 'JSON Value',
  description: 'A valid JSON value parsed from/serialized to a string',
})

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type Guards
//
//

/**
 * Type guard to check if a value is a valid JSON value.
 *
 * @category Type Guards
 */
export const is = S.is(ValueSchema)

/**
 * Type guard to check if a value is a JSON primitive.
 *
 * @category Type Guards
 */
export const isPrimitive = S.is(PrimitiveSchema)

/**
 * Type guard to check if a value is a JSON object.
 *
 * @category Type Guards
 */
export const isObject = S.is(ObjectSchema)

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Convenience
//
//

/**
 * Parse a JSON string to a typed value.
 * Throws on invalid JSON.
 *
 * @category Parsing
 */
export const fromString = S.decodeSync(Schema)

/**
 * Serialize a JSON value to a pretty-printed string.
 *
 * @category Serialization
 */
export const toString = S.encodeSync(Schema)
