/**
 * Type-level parser for color strings.
 *
 * Provides compile-time format detection and type-level validation of color strings.
 * These types enable IDE autocomplete and catch format errors at compile time.
 *
 * Note: Type-level validation is structural only (checks format patterns, not specific values).
 * For full runtime validation with value checking, use {@link Color.String} schema instead.
 *
 * @example
 * ```typescript
 * // Type-level format detection
 * type Format1 = DetectFormat<'#FF5733'>     // 'hex'
 * type Format2 = DetectFormat<'red'>         // 'named'
 * type Format3 = DetectFormat<'invalid'>     // 'unknown'
 *
 * // Type-level validation
 * type Valid1 = IsValidColorFormat<'#FF5733'>   // true
 * type Valid2 = IsValidColorFormat<'invalid'>   // false
 * ```
 *
 * @see https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html - Template literal types
 * @category Color
 */

import type { namedColors } from './named-colors.js'

/**
 * Extract keys from named colors for type-level validation.
 */
type NamedColor = keyof typeof namedColors

/**
 * Check if a string looks like a hex color pattern.
 * Accepts strings starting with # or exactly 6 characters without #.
 * Note: Type-level validation is structural only - full validation happens at runtime.
 */
type IsHexFormat<$str extends string> =
  // With # prefix
  $str extends `#${string}`
    ? true
    : // Without # prefix - check for exactly 6 characters
      $str extends `${infer __c1__}${infer __c2__}${infer __c3__}${infer __c4__}${infer __c5__}${infer __c6__}${infer __rest__}`
      ? __rest__ extends ``
        ? true
        : false
      : false

/**
 * Check if a string is an RGB space-separated format.
 * Example: 'rgb 255 87 51'
 */
type IsRgbSpaceFormat<$str extends string> = $str extends `rgb ${number} ${number} ${number}`
  ? true
  : false

/**
 * Check if a string is an RGB CSS function format.
 * Example: 'rgb(255, 87, 51)'
 */
type IsRgbFuncFormat<$str extends string> = $str extends `rgb(${number}, ${number}, ${number})`
  ? true
  : false

/**
 * Check if a string is an HSL space-separated format.
 * Example: 'hsl 120 100 50'
 */
type IsHslSpaceFormat<$str extends string> = $str extends `hsl ${number} ${number} ${number}`
  ? true
  : false

/**
 * Check if a string is an HSL CSS function format.
 * Example: 'hsl(120, 100, 50)'
 */
type IsHslFuncFormat<$str extends string> = $str extends `hsl(${number}, ${number}, ${number})`
  ? true
  : false

/**
 * Check if a string is a named color.
 */
type IsNamedColor<$str extends string> = Lowercase<$str> extends NamedColor ? true : false

/**
 * Detected color format type.
 *
 * Represents all possible color format detection results at the type level.
 * Used by {@link DetectFormat} to indicate what format a color string matches.
 */
export type ColorFormat =
  | 'hex'
  | 'rgb-space'
  | 'rgb-func'
  | 'hsl-space'
  | 'hsl-func'
  | 'named'
  | 'object'
  | 'unknown'

/**
 * Detect the format of a color input at the type level.
 *
 * @example
 * ```typescript
 * type T1 = DetectFormat<'#FF5733'>          // 'hex'
 * type T2 = DetectFormat<'rgb 255 87 51'>    // 'rgb-space'
 * type T3 = DetectFormat<'rgb(255, 87, 51)'> // 'rgb-func'
 * type T4 = DetectFormat<'hsl 120 100 50'>   // 'hsl-space'
 * type T5 = DetectFormat<'hsl(120, 100, 50)'> // 'hsl-func'
 * type T6 = DetectFormat<'red'>              // 'named'
 * type T7 = DetectFormat<'invalid'>          // 'unknown'
 * ```
 */
export type DetectFormat<$input> = $input extends string
  ? // oxfmt-ignore
    IsHexFormat<$input> extends true      ? 'hex'
    : IsRgbSpaceFormat<$input> extends true ? 'rgb-space'
    : IsRgbFuncFormat<$input> extends true  ? 'rgb-func'
    : IsHslSpaceFormat<$input> extends true ? 'hsl-space'
    : IsHslFuncFormat<$input> extends true  ? 'hsl-func'
    : IsNamedColor<$input> extends true     ? 'named'
    : 'unknown'
  : $input extends { r: number; g: number; b: number }
    ? 'object'
    : 'unknown'

/**
 * Check if a color input is valid at the type level.
 * Provides basic format validation - use runtime schemas for full validation.
 *
 * @example
 * ```typescript
 * type T1 = IsValidColorFormat<'#FF5733'>      // true
 * type T2 = IsValidColorFormat<'red'>          // true
 * type T3 = IsValidColorFormat<'invalid'>      // false
 * type T4 = IsValidColorFormat<{ r: 255, g: 87, b: 51 }> // true
 * ```
 */
export type IsValidColorFormat<$input> = DetectFormat<$input> extends 'unknown' ? false : true

/**
 * Parse a color input to infer its format at compile-time.
 * This is a type-level mirror of the runtime parse function.
 *
 * @example
 * ```typescript
 * type T1 = ParseColor<'#FF5733'>
 * // { format: 'hex', valid: true }
 *
 * type T2 = ParseColor<'red'>
 * // { format: 'named', valid: true }
 *
 * type T3 = ParseColor<'invalid'>
 * // { format: 'unknown', valid: false }
 * ```
 */
export type ParseColor<$input> = {
  format: DetectFormat<$input>
  valid: IsValidColorFormat<$input>
}
