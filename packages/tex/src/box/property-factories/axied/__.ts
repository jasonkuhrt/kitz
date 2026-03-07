import { ParseResult, Schema as S } from 'effect'

/**
 * Logical properties shape for axied property classes.
 * Two-axis properties: main and cross.
 */
export type Logical<$value> = {
  main?: $value
  cross?: $value
}

/**
 * Create an Effect Schema class for axied properties.
 *
 * Axied properties have two values: main and cross axis.
 * Unlike Sided properties (4 edges: mainStart, mainEnd, crossStart, crossEnd),
 * Axied properties have just 2 axis values.
 *
 * @example
 * ```typescript
 * import { Schema as S } from 'effect'
 * import { Axied } from './property-factories/axied/_.js'
 *
 * // Create a Span class with number | bigint values
 * const SpanValueSchema = S.Union(S.Number, S.BigIntFromSelf)
 * export class Span extends Axied.Class<Span>('Span')(SpanValueSchema) {}
 *
 * // Create a Gap class with number values
 * export class Gap extends Axied.Class<Gap>('Gap')(S.Number) {}
 * ```
 */
export const Class =
  <Self = never>(identifier: string) =>
  <$valueSchema extends S.Schema.All>(valueSchema: $valueSchema) =>
    S.Class<Self>(identifier)({
      main: S.optional(valueSchema),
      cross: S.optional(valueSchema),
    })

/**
 * Input types for axied properties.
 *
 * Supports multiple notations:
 * - Single value: applies to both axes
 * - Tuple: [main, cross], [main], [, cross]
 * - Object: { main?, cross? }
 */
export type Input<$value> =
  | $value
  | readonly [$value, $value]
  | readonly [$value]
  | readonly [undefined, $value]
  | readonly [$value, undefined]
  | { main?: $value; cross?: $value }

/**
 * Parse axied input into logical properties.
 *
 * @param input - Axied input (value, tuple, or object)
 * @returns Logical properties with main and cross
 *
 * @example
 * ```typescript
 * parse(10)           // { main: 10, cross: 10 }
 * parse([10, 20])     // { main: 10, cross: 20 }
 * parse({ main: 10 }) // { main: 10 }
 * ```
 */
export const parse = <$value>(input: Input<$value>): Partial<Logical<$value>> => {
  // Handle primitive value (applies to both axes)
  if (typeof input === 'number' || typeof input === 'bigint' || typeof input === 'string') {
    return { main: input, cross: input }
  }

  // Handle tuple [main, cross], [main], [, cross]
  if (Array.isArray(input)) {
    const result: Partial<Logical<$value>> = {}
    if (input[0] !== undefined) result.main = input[0]
    if (input[1] !== undefined) result.cross = input[1]
    return result
  }

  // Handle object { main?, cross? }
  return input as Partial<Logical<$value>>
}

/**
 * Schema that accepts Input forms for axied properties.
 *
 * Accepts: value | [main, cross] | [main] | [, cross] | { main?, cross? }
 */
export const InputSchema = <$valueSchema extends S.Schema.Any>(valueSchema: $valueSchema) =>
  S.Union(
    valueSchema,
    S.Tuple(valueSchema, valueSchema),
    S.Tuple(valueSchema),
    S.Tuple(S.Undefined, valueSchema),
    S.Tuple(valueSchema, S.Undefined),
    S.Struct({ main: S.optional(valueSchema), cross: S.optional(valueSchema) }),
  )

/**
 * One-way transformation: Input → Logical form.
 *
 * Accepts shorthand inputs (value, tuple, or object) and normalizes to { main?, cross? }.
 * Encoding is forbidden (one-way transformation).
 */
export const fromInput = <$valueSchema extends S.Schema.Any>(valueSchema: $valueSchema) =>
  S.transformOrFail(
    InputSchema(valueSchema),
    S.Struct({ main: S.optional(valueSchema), cross: S.optional(valueSchema) }),
    {
      strict: false,
      decode: (input) => ParseResult.succeed(parse(input as Input<S.Schema.Type<$valueSchema>>)),
      encode: (value, _, ast) =>
        ParseResult.fail(new ParseResult.Forbidden(ast, value, 'One-way transformation')),
    },
  )
