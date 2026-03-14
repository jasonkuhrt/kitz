import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'

/**
 * Logical properties shape for axis property classes.
 */
export type Logical<$value> = {
  mainStart?: $value
  mainEnd?: $value
  crossStart?: $value
  crossEnd?: $value
}

/**
 * Create an Effect Schema class for axis properties.
 *
 * Follows the Effect Schema.Class curried pattern for proper type inference.
 * The returned class is a full Effect Schema class with AST, fields, etc.
 *
 * @example
 * ```typescript
 * import { Schema as S } from 'effect'
 * import { Sided } from './property-factories/sided/_.js'
 *
 * // Create a Padding class with number | string values
 * const ValueSchema = S.Union([S.Number, S.String])
 * export class Padding extends Sided.Class<Padding>('Padding')(ValueSchema) {}
 * ```
 */
export const Class =
  <Self = never>(identifier: string) =>
  <$valueSchema extends S.Top>(valueSchema: $valueSchema) =>
    S.Class<Self>(identifier)({
      mainStart: S.optional(valueSchema),
      mainEnd: S.optional(valueSchema),
      crossStart: S.optional(valueSchema),
      crossEnd: S.optional(valueSchema),
    })

/**
 * Value specification for a single axis.
 *
 * Can be:
 * - A value (shorthand for both start and end)
 * - An array `[start, end]` or sparse `[start]`, `[, end]`
 * - An object with explicit `start` and `end` properties
 *
 * @typeParam $value - The value type (e.g., number, number | bigint)
 */
export type AxisValue<$value> =
  | $value // shorthand: both sides
  | [$value] // [start]
  | [$value, $value] // [start, end]
  | [$value, undefined] // [start only]
  | [undefined, $value] // [end only]
  | { start?: $value; end?: $value } // explicit object

/**
 * Input format for Sided properties.
 *
 * Supports multiple syntaxes for progressive complexity:
 * 1. Global value: `2` → all sides
 * 2. Axis shorthands: `[2, 4]` → [main, cross]
 * 3. Binary axis: `[[1, 2], [3, 4]]` → [[main], [cross]]
 * 4. Sparse binary: `[[2]]` → main only
 * 5. Object syntax: `{ main: [1, 2], cross: 4 }`
 * 6. Explicit logical: `{ mainStart: 1, mainEnd: 2, ... }`
 *
 * @typeParam $value - The value type (e.g., number, number | bigint)
 */
export type Input<$value> =
  | $value // all sides
  | [$value, $value] // [main, cross] - axis shorthands
  | [AxisValue<$value>, AxisValue<$value>] // [[main...], [cross...]] - binary axis
  | [AxisValue<$value>] // [[main...]] - main axis only
  | [undefined, AxisValue<$value>] // [, [cross...]] - cross axis only (sparse)
  | { main?: AxisValue<$value>; cross?: AxisValue<$value> } // object with axes
  | Logical<$value> // explicit logical properties

/**
 * Parse Sided input into logical properties.
 *
 * Handles all input formats and returns a partial Logical object with only the specified properties.
 *
 * @typeParam $value - The value type (e.g., number, number | bigint)
 * @param input - Sided input in any supported format
 * @returns Partial logical properties
 */
export const parse = <$value>(input: Input<$value>): Partial<Logical<$value>> => {
  // Handle primitive value (number, bigint, string)
  if (typeof input === `number` || typeof input === `bigint` || typeof input === `string`) {
    return { mainStart: input, mainEnd: input, crossStart: input, crossEnd: input }
  }

  // Handle object
  if (!Array.isArray(input)) {
    // Cast to object for property checking (we know it's an object type at this point)
    const inputObj = input as Record<string, any>
    // Object with main/cross properties
    if (`main` in inputObj || `cross` in inputObj) {
      const result: Partial<Logical<$value>> = {}
      const mainResult = parseAxis(`main`, inputObj[`main`] as AxisValue<$value> | undefined)
      const crossResult = parseAxis(`cross`, inputObj[`cross`] as AxisValue<$value> | undefined)
      if (mainResult.mainStart !== undefined) result.mainStart = mainResult.mainStart
      if (mainResult.mainEnd !== undefined) result.mainEnd = mainResult.mainEnd
      if (crossResult.crossStart !== undefined) result.crossStart = crossResult.crossStart
      if (crossResult.crossEnd !== undefined) result.crossEnd = crossResult.crossEnd
      return result
    }
    // Already logical properties
    return input as Logical<$value>
  }

  // Handle arrays
  const firstElement = input[0]
  const secondElement = input[1]

  // Detect if this is [main, cross] shorthands (both are primitive values)
  const isPrimitive = (v: unknown) =>
    typeof v === `number` || typeof v === `bigint` || typeof v === `string`
  if (input.length === 2 && isPrimitive(firstElement) && isPrimitive(secondElement)) {
    // [main, cross] shorthands
    return {
      mainStart: firstElement as $value,
      mainEnd: firstElement as $value,
      crossStart: secondElement as $value,
      crossEnd: secondElement as $value,
    }
  }

  // Binary axis: [[main...], [cross...]] or [[main...]]
  const mainAxis = firstElement as AxisValue<$value>
  const crossAxis = secondElement

  return {
    ...parseAxis(`main`, mainAxis),
    ...parseAxis(`cross`, crossAxis),
  } as Partial<Logical<$value>>
}

/**
 * Parse a single axis value into logical properties.
 *
 * @typeParam $value - The value type
 * @param axis - Which axis (main or cross)
 * @param value - The axis value specification
 * @returns Partial logical properties for this axis
 */
const parseAxis = <$value = number>(
  axis: 'main' | 'cross',
  value?: AxisValue<$value>,
): Partial<Logical<$value>> => {
  if (value === undefined) return {}

  const startKey = axis === `main` ? `mainStart` : `crossStart`
  const endKey = axis === `main` ? `mainEnd` : `crossEnd`

  // Primitive value shorthand (number, bigint, string)
  if (typeof value === `number` || typeof value === `bigint` || typeof value === `string`) {
    return { [startKey]: value, [endKey]: value } as Partial<Logical<$value>>
  }

  // Array
  if (Array.isArray(value)) {
    const [start, end] = value
    return {
      ...(start !== undefined ? { [startKey]: start } : {}),
      ...(end !== undefined ? { [endKey]: end } : {}),
    } as Partial<Logical<$value>>
  }

  // Object - cast to access properties
  const valueObj = value as { start?: $value; end?: $value }
  return {
    ...(valueObj.start !== undefined ? { [startKey]: valueObj.start } : {}),
    ...(valueObj.end !== undefined ? { [endKey]: valueObj.end } : {}),
  } as Partial<Logical<$value>>
}

/**
 * Schema for a single axis value.
 *
 * Accepts: value | [start, end] | [start] | { start?, end? }
 */
const AxisValueSchema = <$valueSchema extends S.Top>(valueSchema: $valueSchema) =>
  S.Union([
    valueSchema,
    S.Tuple([valueSchema, valueSchema]),
    S.Tuple([valueSchema]),
    S.Tuple([valueSchema, S.Undefined]),
    S.Tuple([S.Undefined, valueSchema]),
    S.Struct({ start: S.optional(valueSchema), end: S.optional(valueSchema) }),
  ])

/**
 * Schema that accepts Input forms for sided properties.
 *
 * Accepts all supported syntaxes:
 * - Single value: all sides
 * - [main, cross]: axis shorthands
 * - [[main...], [cross...]]: binary axis
 * - { main?, cross? }: object with axes
 * - { mainStart?, mainEnd?, crossStart?, crossEnd? }: explicit logical
 */
export const InputSchema = <$valueSchema extends S.Top>(valueSchema: $valueSchema) => {
  const axisSchema = AxisValueSchema(valueSchema)
  return S.Union([
    valueSchema, // Single value → all sides
    S.Tuple([valueSchema, valueSchema]), // [main, cross] primitives
    S.Tuple([axisSchema, axisSchema]), // [[main...], [cross...]]
    S.Tuple([axisSchema]), // [[main...]] only
    S.Tuple([S.Undefined, axisSchema]), // [, [cross...]] only (sparse)
    S.Struct({ main: S.optional(axisSchema), cross: S.optional(axisSchema) }), // { main?, cross? }
    S.Struct({
      mainStart: S.optional(valueSchema),
      mainEnd: S.optional(valueSchema),
      crossStart: S.optional(valueSchema),
      crossEnd: S.optional(valueSchema),
    }), // Explicit logical
  ])
}

/**
 * One-way transformation: Input → Logical form.
 *
 * Accepts shorthand inputs and normalizes to { mainStart?, mainEnd?, crossStart?, crossEnd? }.
 * Encoding is forbidden (one-way transformation).
 */
export const fromInput = <$valueSchema extends S.Top>(valueSchema: $valueSchema) =>
  InputSchema(valueSchema).pipe(
    S.decodeTo(
      S.Struct({
        mainStart: S.optional(valueSchema),
        mainEnd: S.optional(valueSchema),
        crossStart: S.optional(valueSchema),
        crossEnd: S.optional(valueSchema),
      }),
      {
        decode: SchemaGetter.transform((input) => parse(input as Input<$valueSchema['Type']>)),
        encode: SchemaGetter.transformOrFail((value) =>
          Effect.fail(
            new SchemaIssue.Forbidden(Option.some(value), { message: 'One-way transformation' }),
          ),
        ),
      },
    ),
  )
