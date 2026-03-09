/**
 * Effect schemas for color validation with branded types.
 *
 * Provides runtime validation and type safety for color values using Effect Schema.
 * Colors are represented as branded types to ensure they've been validated.
 *
 * @see https://effect.website/docs/guides/schema/introduction - Effect Schema documentation
 * @see https://effect.website/docs/guides/schema/branded-types - Branded types in Effect Schema
 * @category Color
 */

import { ParseResult, Schema as S } from 'effect'
import type { ColorRgb } from './named-colors.js'
import { parse } from './parser.js'

/**
 * RGB color branded type.
 *
 * Represents a validated color in RGB format with values guaranteed to be
 * integers between 0-255. This is a branded type, meaning once created,
 * you can be certain it passed validation.
 *
 * The RGB color model represents colors as combinations of Red, Green, and Blue
 * light intensities, matching how computer displays produce colors.
 *
 * @example
 * ```typescript
 * const colorSchema = S.Struct({
 *   foreground: Color,
 *   background: Color
 * })
 *
 * // Use Color.String for string inputs
 * const configSchema = S.Struct({
 *   primaryColor: Color.String
 * })
 * ```
 *
 * @see https://en.wikipedia.org/wiki/RGB_color_model - RGB color model explanation
 * @see https://effect.website/docs/guides/schema/branded-types - Effect Schema branded types
 */
export class Color extends S.TaggedClass<Color>()('Color', {
  r: S.Number.pipe(S.int(), S.between(0, 255)),
  g: S.Number.pipe(S.int(), S.between(0, 255)),
  b: S.Number.pipe(S.int(), S.between(0, 255)),
}) {
  static is = S.is(Color)

  override toString() {
    return S.encodeSync(Color.String)(this)
  }

  /**
   * Get hex string representation.
   *
   * @returns Hex color string with # prefix
   *
   * @example
   * ```typescript
   * const color = Color.fromString('red')
   * color.toHex()  // '#FF0000'
   * ```
   */
  toHex(): string {
    const r = this.r.toString(16).padStart(2, '0')
    const g = this.g.toString(16).padStart(2, '0')
    const b = this.b.toString(16).padStart(2, '0')
    return `#${r}${g}${b}`.toUpperCase()
  }

  /**
   * Schema for parsing from/encoding to string representation.
   *
   * Use this when you need to accept string color values (e.g., from config files, user input).
   * This schema validates the input format and converts it to a validated Color instance.
   * When encoding, colors are converted back to uppercase hex format (e.g., '#FF5733').
   *
   * Supports multiple formats:
   * - Hex: `#FF5733` or `FF5733` (6 hex digits, with or without # prefix)
   * - RGB space-separated: `rgb 255 87 51` (values 0-255)
   * - RGB CSS function: `rgb(255, 87, 51)` (CSS-style syntax)
   * - HSL space-separated: `hsl 120 100 50` (hue 0-360, saturation/lightness 0-100)
   * - HSL CSS function: `hsl(120, 100, 50)` (CSS-style syntax)
   * - Named colors: `red`, `blue`, etc. (147 CSS Level 4 colors)
   *
   * @example
   * ```typescript
   * const ConfigSchema = S.Struct({
   *   primaryColor: Color.String,
   *   secondaryColor: Color.String
   * })
   *
   * const decoded = S.decodeSync(ConfigSchema)({
   *   primaryColor: '#FF5733',
   *   secondaryColor: 'rgb(0, 128, 255)'
   * })
   * ```
   *
   * @see https://www.w3.org/TR/css-color-4/#color-syntax - CSS Color syntax specification
   */
  static String = S.transformOrFail(S.String, Color, {
    strict: true,
    encode: (decoded) => {
      // Encode to hex format
      const r = decoded.r.toString(16).padStart(2, '0')
      const g = decoded.g.toString(16).padStart(2, '0')
      const b = decoded.b.toString(16).padStart(2, '0')
      return ParseResult.succeed(`#${r}${g}${b}`.toUpperCase())
    },
    decode: (input, _options, ast) => {
      const result = parse(input)
      if (result === null) {
        return ParseResult.fail(
          new ParseResult.Type(
            ast,
            input,
            `Invalid color format. Expected hex (#FF5733), RGB (rgb 255 87 51 or rgb(255, 87, 51)), HSL (hsl 120 100 50 or hsl(120, 100, 50)), or named color (red, blue, etc.)`,
          ),
        )
      }
      return ParseResult.succeed(new Color(result))
    },
  })

  /**
   * Parse a color string to a Color instance.
   *
   * @param input - Color string in any supported format
   * @returns Color instance
   * @throws If the color string is invalid
   *
   * @example
   * ```typescript
   * const color1 = Color.fromString('#FF5733')
   * const color2 = Color.fromString('rgb 255 87 51')
   * const color3 = Color.fromString('red')
   * ```
   */
  static fromString = <const input extends string>(input: input) => {
    return S.decodeSync(Color.String)(input)
  }

  /**
   * Create a Color instance from RGB values.
   *
   * @param rgb - RGB color object
   * @returns Color instance
   *
   * @example
   * ```typescript
   * const color = Color.fromRgb({ r: 255, g: 87, b: 51 })
   * ```
   */
  static fromRgb = (rgb: ColorRgb): Color => {
    return new Color(rgb)
  }
}

/**
 * Union schema for all color input formats.
 *
 * Accepts either a string (in any supported format) or an RGB object.
 * This is the most flexible schema, accepting any color representation
 * and normalizing it to a validated Color instance.
 *
 * Use this when you want to accept colors in any format from users or config files.
 *
 * @example
 * ```typescript
 * const schema = S.Struct({
 *   color: ColorInput
 * })
 *
 * // All valid:
 * { color: '#FF5733' }
 * { color: 'rgb 255 87 51' }
 * { color: 'red' }
 * { color: { r: 255, g: 87, b: 51 } }
 * ```
 *
 * @see https://effect.website/docs/guides/schema/data-types#union - Effect Schema unions
 */
export const ColorInput = S.Union(
  Color.String,
  S.Struct({
    r: S.Number.pipe(S.int(), S.between(0, 255)),
    g: S.Number.pipe(S.int(), S.between(0, 255)),
    b: S.Number.pipe(S.int(), S.between(0, 255)),
  }).pipe(
    S.transform(Color, { decode: Color.fromRgb, encode: (c) => ({ r: c.r, g: c.g, b: c.b }) }),
  ),
)
