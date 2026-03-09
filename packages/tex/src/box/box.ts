import { Obj, Str } from '@kitz/core'
import { ParseResult, Schema as S } from 'effect'
import { extractChar, extractStyle } from './ansi.js'
import { Clockhand } from './clockhand/_.js'
import * as PropBorder from './properties/border.js'
import * as PropGap from './properties/gap.js'
import * as PropMargin from './properties/margin.js'
import * as PropOrientation from './properties/orientation.js'
import * as PropPadding from './properties/padding.js'
import * as PropSpanRange from './properties/span-range.js'
import * as PropSpan from './properties/span.js'
import { render } from './render.js'
import type { CharStyle, Style, StyledText } from './style.js'

/**
 * Get the visual width of a padding/margin value.
 *
 * - `undefined` → 0
 * - `number` → the number itself (count of spaces)
 * - `string` → visual width of the string
 * - `bigint` → 0 (percentage can't be resolved without context)
 *
 * @category Text Formatting
 */
export const getWidth = (value: number | string | bigint | undefined): number => {
  if (value === undefined) return 0
  if (typeof value === `number`) return value
  if (typeof value === `bigint`) return 0 // Percentage - can't resolve without context
  return Str.Visual.width(value)
}

/**
 * Box model utilities for text layout.
 *
 * Provides CSS-like box model operations for text using a structural approach.
 * Build up a Box structure with padding and borders, then encode to string.
 *
 * **Conventions**:
 * - Instance methods with `$` suffix mutate in place and return `this` for chaining
 * - Static methods are immutable and return new Box instances
 *
 * @category Text Formatting
 *
 * @example
 * ```typescript
 * import { Tex } from '@wollybeard/kit'
 *
 * // Mutable API (instance methods with $)
 * const box = Tex.Box.make({ content: 'Hello' })
 * box.pad$({ top: 1, left: 2 })
 * box.border$({ style: 'single' })
 * console.log(box.toString())
 *
 * // Immutable API (static methods)
 * const box2 = Tex.Box.make({ content: 'Hello' })
 * const padded = Tex.Box.pad(box2, { top: 1, left: 2 })
 * const bordered = Tex.Box.border(padded, { style: 'single' })
 * console.log(bordered.toString())
 *
 * // Reuse styling with different content
 * const styledBox = Tex.Box.make({ content: '' })
 *   .pad$({ left: 2 })
 *   .border$({ style: 'double' })
 *
 * styledBox.content$('Message 1')
 * console.log(styledBox.toString())
 *
 * styledBox.content$('Message 2')
 * console.log(styledBox.toString())
 * ```
 */

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Hook Type System
//

/**
 * Context categories available to hooks during rendering.
 * Maps rendering position categories to their available context.
 *
 * @internal
 * @category Text Formatting
 */
type HookContextMap = {
  'border-vertical': { lineIndex: number; totalLines: number; char: string }
  'border-horizontal': { colIndex: number; totalCols: number; char: string }
  'border-corner': { char: string }
  'padding-main': { lineIndex: number; totalLines: number }
  'padding-cross': Record<string, never>
  'margin-main': { lineIndex: number; totalLines: number }
  'margin-cross': Record<string, never>
}

/**
 * Maps style paths to their rendering context category.
 * Defines which context each style position receives during rendering.
 *
 * @internal
 * @category Text Formatting
 */
type StyleCategoryMap = {
  'border.edges.top': 'border-horizontal'
  'border.edges.bottom': 'border-horizontal'
  'border.edges.left': 'border-vertical'
  'border.edges.right': 'border-vertical'
  'border.corners.topLeft': 'border-corner'
  'border.corners.topRight': 'border-corner'
  'border.corners.bottomRight': 'border-corner'
  'border.corners.bottomLeft': 'border-corner'
  'padding.mainStart': 'padding-main'
  'padding.mainEnd': 'padding-main'
  'padding.crossStart': 'padding-cross'
  'padding.crossEnd': 'padding-cross'
  'margin.mainStart': 'margin-main'
  'margin.mainEnd': 'margin-main'
  'margin.crossStart': 'margin-cross'
  'margin.crossEnd': 'margin-cross'
}

/**
 * A value that can be static or computed via hook function.
 *
 * Supports two hook patterns:
 * - Generator: `(ctx) => value` - Compute value from context
 * - Transformer: `(ctx) => (value) => value` - Transform existing value with context
 *
 * @internal
 * @category Text Formatting
 */
type WithHook<$value, $category extends keyof HookContextMap> =
  | $value
  | ((ctx: HookContextMap[$category]) => $value)
  | ((ctx: HookContextMap[$category]) => (value: $value) => $value)

/**
 * Add hook support to an object type based on path prefix.
 * Each property gets hook support with the correct context category.
 *
 * @internal
 * @category Text Formatting
 */
type WithHooks<$obj, $pathPrefix extends string> = {
  [K in keyof $obj]: `${$pathPrefix}.${K & string}` extends keyof StyleCategoryMap
    ? WithHook<$obj[K], StyleCategoryMap[`${$pathPrefix}.${K & string}`]>
    : $obj[K]
}

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Schemas
//

/**
 * Padding input accepting AxisProperty notation and hook functions.
 *
 * Supports AxisProperty patterns:
 * - Single value: `2` → all sides
 * - Axis shorthands: `[2, 4]` → [main, cross]
 * - Binary axis: `[[1, 2], [3, 4]]` → [[mainStart, mainEnd], [crossStart, crossEnd]]
 * - Per-axis arrays: `[[1, 2], 4]` → asymmetric main, symmetric cross
 * - Object: `{ main: [1, 2], cross: 4 }`
 * - With hooks: `{ main: { start: (ctx) => 2 } }`
 *
 * @category Text Formatting
 */
export type PaddingInput = PropPadding.Input | WithHooks<PropPadding.Padding, 'padding'>

/**
 * Margin input accepting AxisProperty notation and hook functions.
 *
 * Supports AxisProperty patterns (same as PaddingInput).
 *
 * @category Text Formatting
 */
export type MarginInput = PropMargin.Input | WithHooks<PropMargin.Margin, 'margin'>

/**
 * Border edge input supporting Clockhand notation, CharStyle, and hook functions.
 *
 * Supports Clockhand patterns:
 * - Single value: `'─'` → all edges
 * - Single styled: `{ char: '─', color: { foreground: 'blue' } }` → all edges
 * - Array: `['─', '│', '─', '│']` → [top, right, bottom, left]
 * - Object: `{ top: '─', left: '│' }`
 * - Object with CharStyle: `{ top: { char: '─', color: { foreground: 'red' } } }`
 * - With hooks: `{ top: (ctx) => '─' }`
 *
 * @category Text Formatting
 */
export type BorderEdgesInput =
  | Clockhand.Value<string | CharStyle>
  | WithHooks<PropBorder.BorderEdges, 'border.edges'>
  | {
      [K in keyof PropBorder.BorderEdges]?:
        | string
        | CharStyle
        | WithHook<string | undefined, StyleCategoryMap[`border.edges.${K & string}`]>
    }

/**
 * Border corner input supporting Clockhand notation, CharStyle, and hook functions.
 *
 * Supports Clockhand patterns:
 * - Single value: `'+'` → all corners
 * - Single styled: `{ char: '+', color: { foreground: 'yellow' }, bold: true }` → all corners
 * - Array: `['┌', '┐', '┘', '└']` → [topLeft, topRight, bottomRight, bottomLeft] (clockwise)
 * - Object: `{ topLeft: '┌', topRight: '┐' }`
 * - Object with CharStyle: `{ topLeft: { char: '┌', color: { foreground: 'red' }, bold: true } }`
 * - With hooks: `{ topLeft: (ctx) => '┌' }`
 *
 * @category Text Formatting
 */
export type BorderCornersInput =
  | Clockhand.Value<string | CharStyle>
  | WithHooks<PropBorder.BorderCorners, 'border.corners'>
  | {
      [K in keyof PropBorder.BorderCorners]?:
        | string
        | CharStyle
        | WithHook<string | undefined, StyleCategoryMap[`border.corners.${K & string}`]>
    }

/**
 * Border character configuration input with nested edges/corners.
 *
 * @category Text Formatting
 */
export type BorderCharsInput = {
  edges?: BorderEdgesInput
  corners?: BorderCornersInput
}

/**
 * Border configuration input with hook support.
 *
 * Supports:
 * - `style`: Preset border style (provides edges and corners)
 * - `edges`: Edge characters (with Clockhand support)
 * - `corners`: Corner characters (with Clockhand support)
 *
 * Resolution order: style → edges/corners override
 *
 * @category Text Formatting
 */
export type BorderInput = {
  style?: PropBorder.BorderStyle
  edges?: BorderEdgesInput
  corners?: BorderCornersInput
}

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Box Class
//

/**
 * Content type for Box - can be a string, styled text, or array of these and boxes.
 *
 * Supports:
 * - Plain strings: `'Hello'`
 * - Styled text: `{ text: 'Hello', color: { foreground: 'red' }, bold: true }`
 * - Arrays: `['Header', { text: 'Body', color: { foreground: 'green' } }, Box.make(...)]`
 *
 * @category Text Formatting
 */
export type BoxContent = string | StyledText | readonly (string | StyledText | Box)[]

// Schema for color input (string like 'red', '#FF0000', or rgb object) - validation only, no transform
const ColorInputSchema = S.Union(S.String, S.Struct({ r: S.Number, g: S.Number, b: S.Number }))

// Schema for ColorTargets (foreground, background, underlineColor)
const ColorTargetsSchema = S.Struct({
  foreground: S.optionalWith(ColorInputSchema, { exact: true }),
  background: S.optionalWith(ColorInputSchema, { exact: true }),
  underlineColor: S.optionalWith(ColorInputSchema, { exact: true }),
})

// Schema for StyledText (text + style properties)
const StyledTextSchema = S.Struct({
  text: S.String,
  color: S.optionalWith(ColorTargetsSchema, { exact: true }),
  bold: S.optionalWith(S.Boolean, { exact: true }),
  dim: S.optionalWith(S.Boolean, { exact: true }),
  italic: S.optionalWith(S.Boolean, { exact: true }),
  underline: S.optionalWith(S.Boolean, { exact: true }),
  strikethrough: S.optionalWith(S.Boolean, { exact: true }),
  blink: S.optionalWith(S.Boolean, { exact: true }),
  inverse: S.optionalWith(S.Boolean, { exact: true }),
  hidden: S.optionalWith(S.Boolean, { exact: true }),
})

// Schema for BoxContent - uses S.suspend() for recursive Box reference
// Type annotation removed to avoid exactOptionalPropertyTypes conflicts
const BoxContentSchema = S.Union(
  S.String,
  StyledTextSchema,
  S.Array(
    S.Union(
      S.String,
      StyledTextSchema,
      S.suspend((): S.Schema<Box> => Box as any),
    ),
  ),
)

/**
 * Box structure with content and optional styling.
 *
 * @category Text Formatting
 */
export class Box extends S.Class<Box>('Box')({
  /**
   * Content of the box - can be a string, styled text, or array of strings/boxes.
   * Defaults to empty string if not provided or undefined.
   */
  content: S.optionalWith(BoxContentSchema, { default: () => '' }),

  /**
   * Flow direction of the box.
   * - `vertical`: Main axis flows top-to-bottom (default)
   * - `horizontal`: Main axis flows left-to-right
   *
   * Determines how logical properties map to physical coordinates:
   * - Vertical: mainStart→top, mainEnd→bottom, crossStart→left, crossEnd→right
   * - Horizontal: mainStart→left, mainEnd→right, crossStart→top, crossEnd→bottom
   */
  orientation: S.optional(PropOrientation.Orientation),

  /**
   * Padding around the content (inside border).
   */
  padding: S.optional(PropPadding.Padding),

  /**
   * Border around the padded content.
   */
  border: S.optional(PropBorder.Border),

  /**
   * Margin around the box (outside border).
   */
  margin: S.optional(PropMargin.Margin),

  /**
   * Exact/desired size along each axis.
   *
   * Uses logical properties (main/cross) that adapt to orientation:
   * - Vertical: main=height, cross=width
   * - Horizontal: main=width, cross=height
   *
   * Values can be absolute (number) or percentage of parent (bigint).
   */
  span: S.optional(PropSpan.Span),

  /**
   * Size constraints (min/max) along each axis.
   *
   * Applied after span resolution to enforce bounds.
   */
  spanRange: S.optional(PropSpanRange.SpanRange),

  /**
   * Space between array items (container property).
   *
   * Uses logical properties (main/cross):
   * - Vertical: main=newlines, cross=spaces
   * - Horizontal: main=spaces, cross=newlines
   */
  gap: S.optional(PropGap.Gap),
}) {
  // Hook storage (private, not part of schema)
  private paddingHooks: Partial<
    Record<keyof PropPadding.Padding, Array<(ctx: any) => number | ((v: number) => number)>>
  > = {}
  private marginHooks: Partial<
    Record<keyof PropMargin.Margin, Array<(ctx: any) => number | ((v: number) => number)>>
  > = {}
  private borderEdgeHooks: Partial<
    Record<keyof PropBorder.BorderEdges, Array<(ctx: any) => string | ((v: string) => string)>>
  > = {}
  private borderCornerHooks: Partial<
    Record<keyof PropBorder.BorderCorners, Array<(ctx: any) => string | ((v: string) => string)>>
  > = {}
  // Style storage for CharStyle (colors/modifiers for borders)
  private borderEdgeStyles: Partial<Record<keyof PropBorder.BorderEdges, Style>> = {}
  private borderCornerStyles: Partial<Record<keyof PropBorder.BorderCorners, Style>> = {}

  /**
   * Convert box to string representation.
   *
   * @returns The formatted string
   */
  override toString(): string {
    return render(this)
  }

  clone(): Box {
    const box = Box.make({
      content: Array.isArray(this.content) ? [...this.content] : this.content,
      orientation: this.orientation,
      padding: this.padding,
      border: this.border,
      margin: this.margin,
      span: this.span,
      spanRange: this.spanRange,
      gap: this.gap,
    })

    for (const key of ['mainStart', 'mainEnd', 'crossStart', 'crossEnd'] as const) {
      const paddingHooks = this.paddingHooks[key]
      if (paddingHooks !== undefined) box.paddingHooks[key] = [...paddingHooks]

      const marginHooks = this.marginHooks[key]
      if (marginHooks !== undefined) box.marginHooks[key] = [...marginHooks]
    }

    for (const key of ['top', 'right', 'bottom', 'left'] as const) {
      const edgeHooks = this.borderEdgeHooks[key]
      if (edgeHooks !== undefined) box.borderEdgeHooks[key] = [...edgeHooks]

      const edgeStyle = this.borderEdgeStyles[key]
      if (edgeStyle !== undefined) {
        box.borderEdgeStyles[key] =
          edgeStyle.color === undefined
            ? { ...edgeStyle }
            : { ...edgeStyle, color: { ...edgeStyle.color } }
      }
    }

    for (const key of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const) {
      const cornerHooks = this.borderCornerHooks[key]
      if (cornerHooks !== undefined) box.borderCornerHooks[key] = [...cornerHooks]

      const cornerStyle = this.borderCornerStyles[key]
      if (cornerStyle !== undefined) {
        box.borderCornerStyles[key] =
          cornerStyle.color === undefined
            ? { ...cornerStyle }
            : { ...cornerStyle, color: { ...cornerStyle.color } }
      }
    }

    return box
  }

  //
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Instance Methods (Mutable)
  //

  /**
   * Change the content of a box (mutates in place).
   *
   * **Mutation**: This method modifies the box and returns it for chaining.
   *
   * @param content - New content for the box (string or array of strings/boxes)
   * @returns The same box (for chaining)
   *
   * @example
   * ```typescript
   * const box = Box.make({ content: '' })
   *   .pad$({ left: 2 })
   *   .border$({ style: 'single' })
   *
   * // Reuse style with different content
   * box.content$('Hello')
   * console.log(box.toString())
   *
   * box.content$('Goodbye')
   * console.log(box.toString())
   *
   * // Use nested boxes
   * box.content$([
   *   'Header',
   *   Box.make({ content: 'Body' }).pad$([1, 2]),
   *   'Footer'
   * ])
   * console.log(box.toString())
   * ```
   */
  content$(content: string | Array<string | Box>): this {
    Obj.asWritable(this).content = content
    return this
  }

  /**
   * Add padding to a box (mutates in place).
   *
   * **Mutation**: This method modifies the box and returns it for chaining.
   *
   * Accepts AxisProperty notation or object form with logical properties:
   * - `pad$(2)` - all sides
   * - `pad$([2, 4])` - [main, cross]
   * - `pad$([[1, 2], [3, 4]])` - [[mainStart, mainEnd], [crossStart, crossEnd]]
   * - `pad$({ main: [1, 2], cross: 4 })` - object with per-axis arrays
   * - `pad$({ mainStart: 1, crossStart: 2 })` - explicit logical properties
   * - `pad$({ mainStart: (ctx) => 2 })` - with hooks
   *
   * @param padding - Padding configuration
   * @returns The same box (for chaining)
   *
   * @example
   * ```typescript
   * const box = Box.make({ content: 'Hello' })
   * box.pad$([2, 4])  // AxisProperty shorthand: [main, cross]
   * box.pad$({ mainStart: (ctx) => ctx.lineIndex + 1 })  // Dynamic
   * console.log(box.toString())
   * ```
   */
  pad$(padding: PaddingInput): this {
    // Handle AxisProperty notation (number or array)
    if (typeof padding === 'number' || Array.isArray(padding)) {
      Obj.asWritable(this).padding = PropPadding.parse(padding)
      return this
    }

    // Handle object form with possible hooks
    const staticValues: Partial<S.SimplifyMutable<PropPadding.Padding>> = {}
    for (const key of ['mainStart', 'mainEnd', 'crossStart', 'crossEnd'] as const) {
      const value = (padding as any)[key]
      if (value !== undefined) {
        if (typeof value === 'function') {
          // Store hook
          if (!this.paddingHooks[key]) this.paddingHooks[key] = []
          this.paddingHooks[key].push(value)
        } else {
          // Store static value
          staticValues[key] = value
        }
      }
    }

    Obj.asWritable(this).padding = PropPadding.Padding.make(staticValues)
    return this
  }

  /**
   * Add margin to a box (mutates in place).
   *
   * **Mutation**: This method modifies the box and returns it for chaining.
   *
   * Accepts AxisProperty notation (same patterns as pad$).
   * Also supports hook functions for dynamic values.
   *
   * @param margin - Margin configuration
   * @returns The same box (for chaining)
   *
   * @example
   * ```typescript
   * const box = Box.make({ content: 'Hello' })
   *   .border$({ style: 'single' })
   *   .margin$([2, 4])  // AxisProperty shorthand: [main, cross]
   *   .margin$({ mainStart: (ctx) => 3 })  // Dynamic margin
   * console.log(box.toString())
   * ```
   */
  margin$(margin: MarginInput): this {
    // Handle AxisProperty notation (number or array)
    if (typeof margin === 'number' || Array.isArray(margin)) {
      Obj.asWritable(this).margin = PropMargin.parse(margin)
      return this
    }

    // Handle object form with possible hooks
    const staticValues: Partial<S.SimplifyMutable<PropMargin.Margin>> = {}
    for (const key of ['mainStart', 'mainEnd', 'crossStart', 'crossEnd'] as const) {
      const value = (margin as any)[key]
      if (value !== undefined) {
        if (typeof value === 'function') {
          // Store hook
          if (!this.marginHooks[key]) this.marginHooks[key] = []
          this.marginHooks[key].push(value)
        } else {
          // Store static value
          staticValues[key] = value
        }
      }
    }

    Obj.asWritable(this).margin = PropMargin.Margin.make(staticValues)
    return this
  }

  /**
   * Add a border to a box (mutates in place).
   *
   * **Mutation**: This method modifies the box and returns it for chaining.
   *
   * @param border - Border configuration (style, edges, corners, or combination)
   * @returns The same box (for chaining)
   *
   * @example
   * ```typescript
   * const box = Box.make({ content: 'Hello' })
   *
   * // Use a preset style
   * box.border$({ style: 'single' })
   *
   * // Use custom edges and corners
   * box.border$({
   *   edges: ['─', '│', '─', '│'],      // Clockhand: [top, right, bottom, left]
   *   corners: ['┌', '┐', '┘', '└']     // Clockhand: [topLeft, topRight, bottomRight, bottomLeft]
   * })
   *
   * // Combine style with overrides
   * box.border$({
   *   style: 'single',
   *   edges: { top: '=' },               // Override just top edge
   *   corners: { topLeft: '╔' }          // Override just top-left corner
   * })
   *
   * // Use hooks for dynamic borders
   * box.border$({
   *   style: 'single',
   *   edges: {
   *     left: (ctx) => ctx.lineIndex === 0 ? '├' : '│'
   *   }
   * })
   * ```
   */
  border$(border: BorderInput): this {
    const staticBorder: S.SimplifyMutable<PropBorder.Border> = {}

    // Handle style (always static)
    if (border.style) {
      staticBorder.style = border.style
    }

    // Handle edges (can be Clockhand, object with hooks, or object)
    if (border.edges !== undefined) {
      // Handle Clockhand notation (string or array)
      if (typeof border.edges === 'string' || Array.isArray(border.edges)) {
        // Clockhand returns strings or CharStyle - need to extract
        const parsed = Clockhand.parse(border.edges)
        const staticEdges: Partial<S.SimplifyMutable<PropBorder.BorderEdges>> = {}
        for (const key of ['top', 'right', 'bottom', 'left'] as const) {
          const value = parsed[key]
          if (value !== undefined) {
            const char = extractChar(value)
            const style = extractStyle(value)
            staticEdges[key] = char
            if (style) this.borderEdgeStyles[key] = style
          }
        }
        staticBorder.edges = staticEdges
      } else {
        // Handle object form with possible hooks or CharStyle
        const staticEdges: Partial<S.SimplifyMutable<PropBorder.BorderEdges>> = {}
        for (const key of ['top', 'right', 'bottom', 'left'] as const) {
          const value = (border.edges as any)[key]
          if (value !== undefined) {
            if (typeof value === 'function') {
              // Store hook
              if (!this.borderEdgeHooks[key]) this.borderEdgeHooks[key] = []
              this.borderEdgeHooks[key].push(value)
            } else {
              // Extract char and style (handles both string and CharStyle)
              const char = extractChar(value)
              const style = extractStyle(value)
              staticEdges[key] = char
              if (style) this.borderEdgeStyles[key] = style
            }
          }
        }
        if (Object.keys(staticEdges).length > 0) {
          staticBorder.edges = staticEdges
        }
      }
    }

    // Handle corners (can be Clockhand, object with hooks, or object)
    if (border.corners !== undefined) {
      // Handle Clockhand notation (string or array)
      if (typeof border.corners === 'string' || Array.isArray(border.corners)) {
        // Parse with Clockhand (gives top/right/bottom/left), then remap to corner names
        // Clockwise corners: topLeft, topRight, bottomRight, bottomLeft
        const parsed = Clockhand.parse(border.corners)
        const staticCorners: Partial<S.SimplifyMutable<PropBorder.BorderCorners>> = {}
        const cornerMap = {
          top: 'topLeft' as const,
          right: 'topRight' as const,
          bottom: 'bottomRight' as const,
          left: 'bottomLeft' as const,
        }
        for (const [clockKey, cornerKey] of Object.entries(cornerMap)) {
          const value = (parsed as any)[clockKey]
          if (value !== undefined) {
            const char = extractChar(value)
            const style = extractStyle(value)
            staticCorners[cornerKey] = char
            if (style) this.borderCornerStyles[cornerKey] = style
          }
        }
        staticBorder.corners = staticCorners
      } else {
        // Handle object form with possible hooks or CharStyle
        const staticCorners: Partial<S.SimplifyMutable<PropBorder.BorderCorners>> = {}
        for (const key of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const) {
          const value = (border.corners as any)[key]
          if (value !== undefined) {
            if (typeof value === 'function') {
              // Store hook
              if (!this.borderCornerHooks[key]) this.borderCornerHooks[key] = []
              this.borderCornerHooks[key].push(value)
            } else {
              // Extract char and style (handles both string and CharStyle)
              const char = extractChar(value)
              const style = extractStyle(value)
              staticCorners[key] = char
              if (style) this.borderCornerStyles[key] = style
            }
          }
        }
        if (Object.keys(staticCorners).length > 0) {
          staticBorder.corners = staticCorners
        }
      }
    }

    Obj.asWritable(this).border = staticBorder
    return this
  }

  /**
   * Set box span (exact/desired size) (mutates in place).
   *
   * **Mutation**: This method modifies the box and returns it for chaining.
   *
   * Accepts AxisProperty notation with bigint support for percentages:
   * - `span$(80)` - 80 chars on both axes
   * - `span$(50n)` - 50% of parent on both axes
   * - `span$([50n, 80])` - main: 50% of parent, cross: 80 chars
   * - `span$({ main: 100, cross: 50n })` - main: 100 chars, cross: 50%
   *
   * @param span - Span configuration (number = chars, bigint = percentage)
   * @returns The same box (for chaining)
   *
   * @example
   * ```typescript
   * const box = Box.make({ content: 'Hello' })
   * box.span$([50n, 80])  // main: 50% of parent, cross: 80 chars
   * console.log(box.toString())
   * ```
   */
  span$(span: PropSpan.Input): this {
    // Parse AxisProperty notation (supports bigint)
    Obj.asWritable(this).span = PropSpan.parse(span)
    return this
  }

  /**
   * Set box span range constraints (min/max) (mutates in place).
   *
   * **Mutation**: This method modifies the box and returns it for chaining.
   *
   * @param spanRange - Span range constraints per axis
   * @returns The same box (for chaining)
   *
   * @example
   * ```typescript
   * const box = Box.make({ content: 'Hello' })
   * box.spanRange$({ main: { max: 10 }, cross: { min: 5, max: 20 } })
   * console.log(box.toString())
   * ```
   */
  spanRange$(spanRange: PropSpanRange.SpanRange): this {
    Obj.asWritable(this).spanRange = PropSpanRange.SpanRange.make(spanRange)
    return this
  }

  /**
   * Set gap between array items (mutates in place).
   *
   * **Mutation**: This method modifies the box and returns it for chaining.
   *
   * Gap is space between items in array content:
   * - Vertical: main=newlines, cross=spaces
   * - Horizontal: main=spaces, cross=newlines
   *
   * @param gap - Gap configuration (number or object)
   * @returns The same box (for chaining)
   *
   * @example
   * ```typescript
   * const box = Box.make({
   *   content: ['Item 1', 'Item 2', 'Item 3']
   * })
   * box.gap$(2)  // 2 newlines between items (vertical)
   * box.gap$({ main: 2 })  // Same as above
   * console.log(box.toString())
   * ```
   */
  gap$(gap: PropGap.Input): this {
    Obj.asWritable(this).gap = PropGap.parse(gap)
    return this
  }
}

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Pure Functions
//

/**
 * Encode a Box to a formatted string (alias for toString).
 *
 * @param box - The box to render
 * @returns The formatted string representation
 *
 * @example
 * ```typescript
 * const box = Box.make({ content: 'Hello' })
 *   .pad$({ top: 1, left: 2 })
 *   .border$({ style: 'single' })
 *
 * const result = encode(box)
 * // Same as: box.toString()
 * ```
 */
export const encode = (box: Box): string => {
  return box.toString()
}

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ String Codec
//

/**
 * Schema for encoding Box to string representation.
 *
 * This is a one-way transformation - boxes can be encoded to strings,
 * but cannot be decoded from strings.
 *
 * @example
 * ```typescript
 * const box = Box.make({ content: 'Hello' }).pad$({ left: 2 })
 *
 * // Encode to string
 * const str = S.encodeSync(String)(box)
 *
 * // Cannot decode from string (throws Forbidden error)
 * S.decodeSync(String)('...')  // Error!
 * ```
 */
export const String = S.transformOrFail(Box, S.String, {
  strict: true,
  decode: (box) => ParseResult.succeed(render(box as any)),
  encode: (_input, _options, ast) =>
    ParseResult.fail(
      new ParseResult.Forbidden(
        ast,
        _input,
        'Cannot encode string back to Box - decoding is one-way only',
      ),
    ),
})

export const makeFromEncoded = S.decodeSync(Box)

export type Encoded = typeof Box.Encoded

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Input Schema (accepts shorthands)
//

/**
 * Schema that accepts Input forms for Border properties.
 *
 * Accepts corner shorthands:
 * - `corners: 'rounded'` → preset
 * - `corners: '*'` → single char for all corners
 * - `corners: ['a', 'b', 'c', 'd']` → clockwise tuple
 */
const BorderInput = S.transform(
  S.Struct({
    style: S.optional(PropBorder.BorderStyleSchema),
    edges: S.optional(PropBorder.BorderEdges),
    corners: S.optional(PropBorder.fromCornerInput),
  }),
  PropBorder.Border,
  {
    strict: false,
    decode: (input) => input as any,
    encode: (border) => border as any,
  },
)

/**
 * Schema that accepts Input forms for Box properties.
 *
 * This wraps the Box schema to accept shorthand inputs for span, padding, margin, and gap:
 * - `span: 50n` instead of `span: { main: 50n, cross: 50n }`
 * - `padding: [10, 20]` instead of `padding: { main: 10, cross: 20 }`
 *
 * Encoding is forbidden (one-way transformation).
 */
const BoxFromInput = S.transform(
  S.Struct({
    content: S.optionalWith(BoxContentSchema, { default: () => '' }),
    orientation: S.optional(PropOrientation.Orientation),
    span: S.optional(PropSpan.fromInput),
    spanRange: S.optional(PropSpanRange.SpanRange),
    padding: S.optional(PropPadding.fromInput),
    margin: S.optional(PropMargin.fromInput),
    border: S.optional(BorderInput),
    gap: S.optional(PropGap.fromInput),
  }),
  Box,
  {
    strict: false,
    decode: (input) => input as any,
    encode: (box) => box as any,
  },
)

/**
 * Create a Box from an input object that accepts shorthand forms.
 *
 * Unlike `makeFromEncoded`, this accepts Input shorthands:
 * - `span: 50n` → both axes at 50%
 * - `span: [50n, 8]` → main: 50%, cross: 8
 * - `padding: 10` → all sides
 * - `padding: [10, 20]` → [main, cross]
 *
 * @example
 * ```typescript
 * // Create box with shorthand inputs
 * const box = Box.makeFromInput({
 *   content: 'Hello',
 *   span: 50n,        // 50% on both axes
 *   padding: [2, 4],  // main: 2, cross: 4
 * })
 * ```
 */
export const makeFromInput = S.decodeSync(BoxFromInput)

/**
 * Input type for makeFromInput - accepts shorthand forms.
 */
export type Input = Parameters<typeof makeFromInput>[0]
