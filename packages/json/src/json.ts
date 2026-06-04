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

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Canonicalization
//
//

/** Compare two strings by UTF-16 code unit (RFC 8785 member ordering). */
const compareCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Serialize one value, or return `undefined` when it has no JSON
 * representation (matching `JSON.stringify`: `undefined`, functions, and
 * symbols are absent). Throws for values that JSON cannot represent but that
 * must not silently degrade in a digest (`NaN`/`Infinity`/`bigint`).
 */
const serialize = (input: unknown): string | undefined => {
  // Honor `toJSON` (Date, Effect Inspectable, …) exactly like `JSON.stringify`.
  const value =
    input !== null &&
    typeof input === 'object' &&
    typeof (input as { toJSON?: unknown }).toJSON === 'function'
      ? (input as { toJSON: (key: string) => unknown }).toJSON('')
      : input

  if (value === null) return 'null'

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false'
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`Cannot canonicalize the non-finite number ${String(value)}`)
      }
      // ECMAScript `Number::toString` is exactly RFC 8785 number serialization.
      return JSON.stringify(value)
    case 'string':
      // `JSON.stringify` string escaping is exactly RFC 8785 string
      // serialization: short escapes (\b \t \n \f \r), lowercase `\u` for
      // other control characters, and no escaping of `/` or non-ASCII.
      return JSON.stringify(value)
    case 'bigint':
      throw new TypeError('Cannot canonicalize a bigint')
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item) => serialize(item) ?? 'null').join(',')}]`
      }
      const record = value as Record<string, unknown>
      const members: string[] = []
      for (const key of Object.keys(record).sort(compareCodeUnits)) {
        const serialized = serialize(record[key])
        if (serialized === undefined) continue
        members.push(`${JSON.stringify(key)}:${serialized}`)
      }
      return `{${members.join(',')}}`
    }
    default:
      return undefined
  }
}

/**
 * Canonicalize a JSON value to its RFC 8785 (JSON Canonicalization Scheme)
 * serialization — a deterministic, byte-stable string suitable for hashing and
 * signing.
 *
 * Object members are emitted sorted by UTF-16 code unit (NOT locale-sensitive
 * collation, and keys are NOT Unicode-normalized). Numbers use the ECMAScript
 * `Number::toString` form and strings use minimal JSON escaping, so the output
 * is identical across machines and locales.
 *
 * `toJSON` is honored, so `Date` (and other inspectable values) serialize as
 * under `JSON.stringify`. `undefined`-valued members are dropped and
 * `undefined`/function/symbol array elements become `null`, also matching
 * `JSON.stringify`. Throws on values with no JSON representation: a non-finite
 * number, a `bigint`, or a bare `undefined`/function/symbol.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8785
 *
 * @example
 * ```ts
 * Json.canonicalize({ b: 2, a: 1 }) // '{"a":1,"b":2}'
 * ```
 *
 * @category Serialization
 */
export const canonicalize = (value: unknown): string => {
  const serialized = serialize(value)
  if (serialized === undefined) {
    throw new TypeError(`Cannot canonicalize a value of type ${typeof value}`)
  }
  return serialized
}
