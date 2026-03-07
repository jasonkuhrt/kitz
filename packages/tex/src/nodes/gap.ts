// ────────────────────────────────────────────────────────────────────────────
// Gap - spacing between items on main/cross axes
// ────────────────────────────────────────────────────────────────────────────

/**
 * A gap value for a single axis.
 *
 * - `number` - that many spaces (e.g., `4` → `'    '`)
 * - `string` - literal string (e.g., `' | '` → `' | '`)
 * - `null` - no gap (empty string)
 */
export type GapValue = number | string | null

/**
 * Input format for Gap.
 *
 * Supports multiple syntaxes following AxisHand conventions:
 * 1. Global value: `4` → both axes get 4 spaces
 * 2. Global string: `' | '` → both axes get `' | '`
 * 3. Axis array: `[4, 2]` → main=4 spaces, cross=2 spaces
 * 4. Object syntax: `{ main: 4, cross: ' | ', intersection: '+' }`
 *
 * @example
 * ```typescript
 * Gap.parse(4)                    // { main: '    ', cross: '    ' }
 * Gap.parse(' | ')                // { main: ' | ', cross: ' | ' }
 * Gap.parse([1, 4])               // { main: ' ', cross: '    ' }
 * Gap.parse({ cross: 4 })         // { main: '', cross: '    ' }
 * Gap.parse({ main: '-', cross: ' | ', intersection: '+' })
 * ```
 */
export type GapInput =
  | GapValue // global: both axes same
  | [GapValue, GapValue] // [main, cross]
  | {
      main?: GapValue
      cross?: GapValue
      /**
       * Character to render at points where row and column separators meet.
       *
       * When tables have both row separators (`main`) and column separators (`cross`),
       * intersections occur where they would overlap. By default, the row separator
       * continues through these points unchanged. Setting `intersection` places a
       * specific character at each column boundary within the row separator.
       *
       * Only accepts strings (not numbers) - this is a literal character, not a count.
       * Only effective when both `main` and `cross` have non-empty values.
       *
       * @example
       * ```typescript
       * // Without intersection:
       * // col1  | col2
       * // ------------
       * // row1  | row2
       *
       * // With intersection: '+':
       * // col1  | col2
       * // ------+------
       * // row1  | row2
       *
       * // Box drawing:
       * // col1  │ col2
       * // ──────┼──────
       * // row1  │ row2
       * ```
       */
      intersection?: string
    }

/**
 * Resolved gap with string values for each axis.
 */
export interface Gap {
  main: string
  cross: string
  intersection: string
}

/**
 * Base interface for parameters that include gap configuration.
 *
 * @category CLI/Text Rendering
 */
export interface GapParameters {
  /**
   * Gap between items on main and cross axes.
   *
   * Follows the standard axis convention:
   * - `main` axis = vertical (between rows/items)
   * - `cross` axis = horizontal (between columns)
   *
   * Values can be:
   * - `number` - that many spaces (or newlines for main gap)
   * - `string` - literal string (for columns) or repeated character (for rows)
   * - `null` - no gap
   *
   * For main gap:
   * - String values are repeated across the width as a visual separator
   * - Number values create that many blank lines
   * - `null` means just a newline (no separator line)
   *
   * @example
   * ```typescript
   * // 4 spaces between columns, no row separator
   * { gap: { cross: 4, main: null } }
   *
   * // Custom column separator
   * { gap: { cross: ' | ' } }
   *
   * // Same gap for both axes
   * { gap: 2 }
   * ```
   */
  gap?: GapInput
}

/**
 * Convert a GapValue to its string representation.
 */
const gapValueToString = (value: GapValue | undefined): string => {
  if (value === null || value === undefined) return ``
  if (typeof value === `number`) return ` `.repeat(value)
  return value
}

/**
 * Parse GapInput into resolved Gap strings.
 *
 * @param input - Gap input in any supported format
 * @returns Resolved gap with string values for each axis
 */
export const parseGap = (input: GapInput): Gap => {
  // Primitive value (number or string) - apply to both axes
  if (typeof input === `number` || typeof input === `string` || input === null) {
    const value = gapValueToString(input)
    return { main: value, cross: value, intersection: `` }
  }

  // Array: [main, cross]
  if (Array.isArray(input)) {
    return {
      main: gapValueToString(input[0]),
      cross: gapValueToString(input[1]),
      intersection: ``,
    }
  }

  // Object: { main?, cross?, intersection? }
  return {
    main: gapValueToString(input.main),
    cross: gapValueToString(input.cross),
    intersection: input.intersection ?? ``,
  }
}
