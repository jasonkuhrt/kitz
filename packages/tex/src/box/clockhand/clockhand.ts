/**
 * CSS-style clockhand notation for 4-sided properties.
 *
 * Provides type-safe parsing of CSS shorthand patterns (clockwise from top):
 * - 1 value: all sides
 * - 2 values: [vertical, horizontal]
 * - 3 values: [top, horizontal, bottom]
 * - 4 values: [top, right, bottom, left]
 *
 * The 4-value form accepts undefined for sparse/selective values.
 *
 * Property names are fixed to match CSS conventions: top, right, bottom, left.
 *
 * @category Text Formatting
 * @internal
 */

/**
 * CSS shorthand input forms.
 *
 * @category Text Formatting
 */
export type Input<$value> =
  | $value // Single value for all sides
  | readonly [$value, $value] // [vertical, horizontal]
  | readonly [$value, $value, $value] // [top, horizontal, bottom]
  | readonly [$value | undefined, $value | undefined, $value | undefined, $value | undefined] // [top, right, bottom, left] (can be sparse)

/**
 * Normalized 4-sided object with CSS property names.
 *
 * @category Text Formatting
 */
export type Object<$value> = {
  top?: $value
  right?: $value
  bottom?: $value
  left?: $value
}

/**
 * Complete input type accepting both tuple and object forms.
 *
 * @category Text Formatting
 */
export type Value<$value> = Input<$value> | Object<$value>

/**
 * Parse clockhand notation to normalized object form.
 *
 * Handles CSS shorthand patterns and sparse tuples.
 * Property names follow CSS conventions (clockwise from top).
 *
 * @example
 * ```typescript
 * parse(2)              // → { top: 2, right: 2, bottom: 2, left: 2 }
 * parse([2, 4])         // → { top: 2, right: 4, bottom: 2, left: 4 }
 * parse([1, 2, 3])      // → { top: 1, right: 2, bottom: 3, left: 2 }
 * parse([1, 2, 3, 4])   // → { top: 1, right: 2, bottom: 3, left: 4 }
 * parse([2,,,6])        // → { top: 2, left: 6 }
 * parse({ top: 2 })     // → { top: 2 }
 * ```
 *
 * @category Text Formatting
 */
export const parse = <$value>(input: Value<$value>): Object<$value> => {
  // Already in object form
  if (!Array.isArray(input) && typeof input === `object`) {
    return input as Object<$value>
  }

  // Single value (not array)
  if (!Array.isArray(input)) {
    const value = input as $value
    return { top: value, right: value, bottom: value, left: value }
  }

  // Array form
  switch (input.length) {
    case 2: {
      const [vertical, horizontal] = input
      return {
        top: vertical,
        right: horizontal,
        bottom: vertical,
        left: horizontal,
      }
    }
    case 3: {
      const [top, horizontal, bottom] = input
      return {
        top,
        right: horizontal,
        bottom,
        left: horizontal,
      }
    }
    case 4: {
      const [top, right, bottom, left] = input
      return {
        top: top ?? undefined,
        right: right ?? undefined,
        bottom: bottom ?? undefined,
        left: left ?? undefined,
      }
    }
    default:
      throw new Error(`Invalid clockhand array length: ${input.length}`)
  }
}
