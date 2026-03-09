import { ParseResult, Schema as S } from 'effect'

/**
 * Border style presets.
 *
 * @category Text Formatting
 */
export const BorderStyleSchema = S.Literal('single', 'double', 'rounded', 'bold', 'ascii')

/**
 * Border style preset type.
 *
 * @category Text Formatting
 */
export type BorderStyle = typeof BorderStyleSchema.Type

/**
 * Border edge characters (physical coordinates).
 *
 * @category Text Formatting
 */
export class BorderEdges extends S.Class<BorderEdges>('BorderEdges')({
  /**
   * Top edge character.
   */
  top: S.optional(S.String),

  /**
   * Right edge character.
   */
  right: S.optional(S.String),

  /**
   * Bottom edge character.
   */
  bottom: S.optional(S.String),

  /**
   * Left edge character.
   */
  left: S.optional(S.String),
}) {}

/**
 * Border corner characters (physical coordinates).
 *
 * @category Text Formatting
 */
export class BorderCorners extends S.Class<BorderCorners>('BorderCorners')({
  /**
   * Top-left corner character.
   */
  topLeft: S.optional(S.String),

  /**
   * Top-right corner character.
   */
  topRight: S.optional(S.String),

  /**
   * Bottom-right corner character.
   */
  bottomRight: S.optional(S.String),

  /**
   * Bottom-left corner character.
   */
  bottomLeft: S.optional(S.String),
}) {}

/**
 * Border configuration.
 *
 * Can specify a preset style, custom edges, custom corners, or a combination.
 * Resolution order: style → edges override → corners override.
 *
 * @category Text Formatting
 */
export class Border extends S.Class<Border>('Border')({
  /**
   * Preset border style (provides edges and corners).
   */
  style: S.optional(BorderStyleSchema),

  /**
   * Edge characters (top, right, bottom, left).
   * Overrides edges from style if both are provided.
   */
  edges: S.optional(BorderEdges),

  /**
   * Corner characters (topLeft, topRight, bottomRight, bottomLeft).
   * Overrides corners from style if both are provided.
   */
  corners: S.optional(BorderCorners),
}) {}

export const makeFromEncoded = S.decodeSync(Border)

/**
 * Predefined border character sets using physical coordinates.
 */
export const styles = {
  single: makeFromEncoded({
    edges: {
      top: '─',
      right: '│',
      bottom: '─',
      left: '│',
    },
    corners: {
      topLeft: '┌',
      topRight: '┐',
      bottomRight: '┘',
      bottomLeft: '└',
    },
  }),
  double: makeFromEncoded({
    edges: {
      top: '═',
      right: '║',
      bottom: '═',
      left: '║',
    },
    corners: {
      topLeft: '╔',
      topRight: '╗',
      bottomRight: '╝',
      bottomLeft: '╚',
    },
  }),
  rounded: makeFromEncoded({
    edges: {
      top: '─',
      right: '│',
      bottom: '─',
      left: '│',
    },
    corners: {
      topLeft: '╭',
      topRight: '╮',
      bottomRight: '╯',
      bottomLeft: '╰',
    },
  }),
  bold: makeFromEncoded({
    edges: {
      top: '━',
      right: '┃',
      bottom: '━',
      left: '┃',
    },
    corners: {
      topLeft: '┏',
      topRight: '┓',
      bottomRight: '┛',
      bottomLeft: '┗',
    },
  }),
  ascii: makeFromEncoded({
    edges: {
      top: '-',
      right: '|',
      bottom: '-',
      left: '|',
    },
    corners: {
      topLeft: '+',
      topRight: '+',
      bottomRight: '+',
      bottomLeft: '+',
    },
  }),
}

/**
 * Predefined corner character sets.
 */
export const cornerStyles = {
  single: { topLeft: '┌', topRight: '┐', bottomRight: '┘', bottomLeft: '└' },
  double: { topLeft: '╔', topRight: '╗', bottomRight: '╝', bottomLeft: '╚' },
  rounded: { topLeft: '╭', topRight: '╮', bottomRight: '╯', bottomLeft: '╰' },
  bold: { topLeft: '┏', topRight: '┓', bottomRight: '┛', bottomLeft: '┗' },
  ascii: { topLeft: '+', topRight: '+', bottomRight: '+', bottomLeft: '+' },
} satisfies Record<BorderStyle, S.SimplifyMutable<BorderCorners>>

/**
 * Input schema for corner shorthand.
 *
 * Accepts:
 * - Preset name: `'single'` | `'double'` | `'rounded'` | `'bold'` | `'ascii'`
 * - Single char for all corners: `'+'`
 * - Clockwise tuple: `['┌', '┐', '┘', '└']`
 * - Full object: `{ topLeft: '┌', topRight: '┐', bottomRight: '┘', bottomLeft: '└' }`
 */
const CornerInputSchema = S.Union(
  BorderStyleSchema,
  S.String,
  S.Tuple(S.String, S.String, S.String, S.String),
  BorderCorners,
)

const parseCornerInput = (
  input: typeof CornerInputSchema.Type,
): S.SimplifyMutable<BorderCorners> => {
  if (typeof input === 'string') {
    if (input in cornerStyles) return cornerStyles[input as BorderStyle]
    return { topLeft: input, topRight: input, bottomRight: input, bottomLeft: input }
  }
  if (Array.isArray(input)) {
    const [topLeft, topRight, bottomRight, bottomLeft] = input
    return { topLeft, topRight, bottomRight, bottomLeft }
  }
  // input is BorderCorners - extract plain object
  const corners = input as BorderCorners
  return {
    topLeft: corners.topLeft,
    topRight: corners.topRight,
    bottomRight: corners.bottomRight,
    bottomLeft: corners.bottomLeft,
  }
}

/**
 * One-way transformation: Corner Input → BorderCorners.
 *
 * Accepts shorthand inputs and normalizes to { topLeft?, topRight?, bottomRight?, bottomLeft? }.
 */
export const fromCornerInput = S.transformOrFail(CornerInputSchema, BorderCorners, {
  strict: false,
  decode: (input) => ParseResult.succeed(parseCornerInput(input)),
  encode: (value, _, ast) =>
    ParseResult.fail(new ParseResult.Forbidden(ast, value, 'One-way transformation')),
})
