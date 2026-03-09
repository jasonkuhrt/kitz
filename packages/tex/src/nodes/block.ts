import { Str } from '@kitz/core'
import { Box } from '../box/_.js'
import type { RenderContext } from './helpers.js'
import { Leaf } from './leaf.js'
import { Node } from './node.js'

/**
 * Block layout and styling parameters using logical properties.
 * Logical properties adapt to the orientation (flow direction) of the block.
 *
 * @category CLI/Text Rendering
 */
export interface BlockParameters {
  /**
   * How child blocks are arranged (orientation of the main axis).
   * - `'vertical'` - Stack children top to bottom (default) - main axis is vertical
   * - `'horizontal'` - Place children side by side - main axis is horizontal
   */
  orientation?: 'vertical' | 'horizontal'

  /**
   * Size constraints along main and cross axes.
   * Use AxisProperty notation for flow-relative sizing.
   *
   * Values can be:
   * - `number` - Absolute size in characters
   * - `bigint` - Percentage of parent (e.g., `50n` = 50%)
   *
   * @example
   * ```typescript
   * // 50% of parent's cross span (width in vertical orientation)
   * span: { cross: 50n }
   *
   * // Exact main span (height in vertical orientation)
   * span: { main: 10 }
   *
   * // Both axes
   * span: { main: 10, cross: 50n }
   * ```
   */
  span?: Box.Span.Input

  /**
   * Min/max size constraints along main and cross axes.
   *
   * @example
   * ```typescript
   * // Max width constraint (cross axis in vertical orientation)
   * spanRange: { cross: { max: 80 } }
   *
   * // Min and max for main axis
   * spanRange: { main: { min: 5, max: 20 } }
   * ```
   */
  spanRange?: Box.SpanRange

  /**
   * Space between child blocks (container property).
   * Applied between items in array content.
   *
   * @example
   * ```typescript
   * // 1 character/line gap between items
   * gap: 1
   *
   * // Different gaps for main and cross axes
   * gap: { main: 2, cross: 1 }
   * ```
   */
  gap?: Box.Gap.Input

  /**
   * Style applied to the entire rendered block.
   *
   * Accepts either:
   * - A declarative Style object: `{ color: { foreground: 'red' }, bold: true }`
   * - A direct ansis chain: `ansis.red`, `ansis.bold.red.underline`
   *
   * Nested blocks restore parent styles automatically via ansis.
   *
   * @example
   * ```typescript
   * block({ style: ansis.red }, 'text')
   * block({ style: { color: { foreground: 'red' }, bold: true } }, 'text')
   * ```
   */
  style?: Box.Style | Box.Ansi.AnsiStyle

  /**
   * Border configuration using Box's border system.
   * Supports colors, styles, and dynamic hook functions.
   *
   * @example
   * ```typescript
   * // Simple string borders
   * border: { edges: { top: '-', left: '|' } }
   *
   * // Preset styles
   * border: { style: 'single' }
   *
   * // Colored borders
   * border: {
   *   edges: {
   *     top: { char: '─', color: { foreground: 'blue' }, bold: true }
   *   }
   * }
   *
   * // Dynamic borders with hooks (context has colIndex/lineIndex, totalCols/totalLines, char)
   * border: {
   *   edges: {
   *     top: (ctx) => ctx.colIndex % 2 ? '=' : '-'
   *   }
   * }
   * ```
   */
  border?: Box.BorderInput

  /**
   * Padding space inside the block borders using logical properties.
   * Use AxisProperty notation for flow-relative padding.
   *
   * @example
   * ```typescript
   * // Shorthand: [main, cross] - same value for start/end
   * padding: [1, 2]  // 1 on main axis, 2 on cross axis
   *
   * // Binary axis: [[mainStart, mainEnd], [crossStart, crossEnd]]
   * padding: [[1, 2], [3, 4]]
   *
   * // Explicit logical properties
   * padding: { mainStart: 1, crossEnd: 2 }
   *
   * // All sides equal
   * padding: 2
   * ```
   */
  padding?: Box.Padding.Input

  /**
   * Margin space outside the block borders using logical properties.
   * Use AxisProperty notation for flow-relative margins.
   *
   * Follows CSS box model: margin → border → padding → content
   * Note: Unlike CSS, margins are additive (don't collapse).
   *
   * @example
   * ```typescript
   * // Indent entire bordered box (cross-axis start)
   * Tex.Tex().block({
   *   border: { left: '|', right: '|' },
   *   margin: { crossStart: 4 }
   * }, 'Content')
   *
   * // Space between sections (main-axis end)
   * Tex.Tex()
   *   .block({ margin: { mainEnd: 2 } }, 'Section 1')
   *   .block('Section 2')
   * ```
   */
  margin?: Box.Margin.Input
}

export class Block extends Node {
  children: Node[]
  parameters: BlockParameters
  private box: Box.Box | null = null

  constructor(parameters: BlockParameters, node: Node)
  constructor(parameters: BlockParameters, nodes: Node[])
  constructor(parameters: BlockParameters, text: string)
  constructor(nodes: Node[])
  constructor(node: Node)
  constructor(text: string)
  constructor()
  constructor(...args: [] | [string | Node | Node[]] | [BlockParameters, string | Node | Node[]]) {
    super()
    const parameters = args.length === 1 || args.length === 0 ? {} : args[0]
    const children = args.length === 0 ? [] : args.length === 1 ? args[0] : args[1]

    this.parameters = parameters

    if (typeof children === `string`) {
      this.children = [new Leaf(children)]
    } else if (Array.isArray(children)) {
      this.children = children
    } else {
      this.children = [children]
    }
  }

  addChild(node: Node) {
    this.children.push(node)
    return this
  }

  setParameters(parameters: BlockParameters) {
    this.parameters = parameters
    return this
  }

  render(context: RenderContext) {
    const orientation = this.parameters.orientation ?? `vertical`

    // Extract spanRange constraint and merge with parent maxWidth
    const ownMaxWidth = this.parameters.spanRange?.cross?.max
    const effectiveMaxWidth =
      ownMaxWidth !== undefined && context.maxWidth !== undefined
        ? Math.min(ownMaxWidth, context.maxWidth)
        : (ownMaxWidth ?? context.maxWidth)

    // Calculate horizontal overhead to subtract from child maxWidth
    // Padding and margin are applied AFTER children render, so children must account for them
    const padding = this.parameters.padding ? Box.Padding.parse(this.parameters.padding) : null
    const margin = this.parameters.margin ? Box.Margin.parse(this.parameters.margin) : null
    const horizontalPadding = padding
      ? Box.getWidth(padding.crossStart) + Box.getWidth(padding.crossEnd)
      : 0
    const horizontalMargin = margin
      ? Box.getWidth(margin.crossStart) + Box.getWidth(margin.crossEnd)
      : 0
    const childMaxWidth =
      effectiveMaxWidth !== undefined
        ? effectiveMaxWidth - horizontalPadding - horizontalMargin
        : undefined

    // Render all children first
    const renderedChildren: string[] = []
    for (let index = 0; index < this.children.length; index++) {
      const child = this.children[index]!
      const rendered = child.render({
        maxWidth: childMaxWidth,
        height: context.height,
        index: {
          total: this.children.length,
          isFirst: index === 0,
          isLast: index === this.children.length - 1,
          position: index,
        },
      })
      renderedChildren.push(rendered.value)
    }

    // Create Box with rendered children
    this.box = Box.Box.make({
      content:
        renderedChildren.length === 0
          ? ``
          : renderedChildren.length === 1
            ? renderedChildren[0]!
            : renderedChildren,
      orientation,
    })

    // Apply parameters to Box using static methods
    if (this.parameters.padding) {
      this.box = Box.pad(this.box, this.parameters.padding)
    }

    if (this.parameters.margin) {
      this.box = Box.margin(this.box, this.parameters.margin)
    }

    if (this.parameters.span) {
      this.box = Box.span(this.box, this.parameters.span)
    }

    // Apply spanRange but exclude cross.max since we already used it for wrapping via effectiveMaxWidth
    if (this.parameters.spanRange) {
      const spanRangeForBox = {
        main: this.parameters.spanRange.main,
        cross: this.parameters.spanRange.cross
          ? { min: this.parameters.spanRange.cross.min }
          : undefined,
      }
      // Only apply if there are constraints besides cross.max
      if (spanRangeForBox.main || spanRangeForBox.cross?.min) {
        this.box = Box.spanRange(this.box, spanRangeForBox as any)
      }
    }

    if (this.parameters.gap) {
      this.box = Box.gap(this.box, this.parameters.gap)
    }

    // Apply border using Box's border system (supports colors and dynamic hooks)
    if (this.parameters.border) {
      this.box = Box.border(this.box, this.parameters.border)
    }

    // Get Box rendering
    let value = Box.render(this.box)

    // Apply style using ansis chain (handles nested color restoration automatically)
    if (this.parameters.style) {
      const ansiChain = Box.Ansi.isAnsiStyle(this.parameters.style)
        ? this.parameters.style
        : Box.Ansi.buildAnsiChain(this.parameters.style)
      value = ansiChain(value)
    }

    const { maxWidth: intrinsicWidth, height: intrinsicHeight } = Str.Visual.size(value)

    return {
      shape: {
        intrinsicWidth,
        intrinsicHeight,
        desiredWidth: 0,
      },
      value,
    }
  }
}
