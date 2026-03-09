import { Str } from '@kitz/core'
import { Schema as S } from 'effect'
import { applyStyle } from './ansi.js'
import type { Box } from './box.js'
import * as PropBorder from './properties/border.js'
import * as PropGap from './properties/gap.js'
import * as PropMargin from './properties/margin.js'
import * as PropOrientation from './properties/orientation.js'
import * as PropPadding from './properties/padding.js'
import type { StyledText } from './style.js'

/**
 * Rendering context passed from parent to child during nested box rendering.
 * Contains available space information for resolving percentage-based spans.
 *
 * @internal
 */
export type RenderContext = {
  /**
   * Available space along the main axis (from parent box).
   * Used to resolve percentage spans (bigint values).
   */
  availableMainSpan?: number | undefined

  /**
   * Available space along the cross axis (from parent box).
   * Used to resolve percentage spans (bigint values).
   */
  availableCrossSpan?: number | undefined
}

/**
 * Maps logical properties to physical operations based on orientation.
 * @internal
 */
const getLogicalMapping = (orientation: PropOrientation.Orientation) => {
  return orientation === 'vertical'
    ? {
        newlinesBefore: 'mainStart' as const,
        newlinesAfter: 'mainEnd' as const,
        spacesBeforeLines: 'crossStart' as const,
        spacesAfterLines: 'crossEnd' as const,
      }
    : {
        newlinesBefore: 'crossStart' as const,
        newlinesAfter: 'crossEnd' as const,
        spacesBeforeLines: 'mainStart' as const,
        spacesAfterLines: 'mainEnd' as const,
      }
}

/**
 * Resolve a span value to an absolute number.
 * - number: direct value
 * - string: string.length (size to fit this content)
 * - bigint: percentage of available span
 *
 * @internal
 */
const resolveSpanValue = (
  value: number | string | bigint | undefined,
  availableSpan: number | undefined,
): number | undefined => {
  if (value === undefined) return undefined
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value.length
  if (typeof value === 'bigint') {
    if (availableSpan === undefined) return undefined
    return Math.floor((availableSpan * Number(value)) / 100)
  }
  return undefined
}

/**
 * Resolve padding/margin value to string (for rendering).
 * - number: repeat space N times
 * - string: use directly
 * - bigint: resolve % then repeat space
 *
 * @internal
 */
const resolveSidedToString = (
  value: number | string | bigint | undefined,
  availableSpan: number | undefined,
): string => {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Str.Char.spaceRegular.repeat(value)
  if (typeof value === 'bigint') {
    if (availableSpan === undefined) return ''
    const resolved = Math.floor((availableSpan * Number(value)) / 100)
    return Str.Char.spaceRegular.repeat(resolved)
  }
  return ''
}

/**
 * Resolve gap value for rendering.
 * - number: repeat separator N times
 * - string: use directly as separator
 * - bigint: resolve % then repeat separator
 *
 * @internal
 */
type ResolvedGap = { type: 'count'; value: number } | { type: 'literal'; value: string }

const resolveGap = (
  value: number | string | bigint | undefined,
  availableSpan: number | undefined,
): ResolvedGap | undefined => {
  if (value === undefined) return undefined
  if (typeof value === 'string') return { type: 'literal', value }
  if (typeof value === 'number') return { type: 'count', value }
  if (typeof value === 'bigint') {
    if (availableSpan === undefined) return undefined
    return { type: 'count', value: Math.floor((availableSpan * Number(value)) / 100) }
  }
  return undefined
}

const toMutableBorderEdges = (
  edges?: PropBorder.BorderEdges | Partial<S.SimplifyMutable<PropBorder.BorderEdges>>,
): Partial<S.SimplifyMutable<PropBorder.BorderEdges>> => {
  if (edges === undefined) return {}
  return {
    top: edges.top,
    right: edges.right,
    bottom: edges.bottom,
    left: edges.left,
  }
}

const toMutableBorderCorners = (
  corners?: PropBorder.BorderCorners | Partial<S.SimplifyMutable<PropBorder.BorderCorners>>,
): Partial<S.SimplifyMutable<PropBorder.BorderCorners>> => {
  if (corners === undefined) return {}
  return {
    topLeft: corners.topLeft,
    topRight: corners.topRight,
    bottomRight: corners.bottomRight,
    bottomLeft: corners.bottomLeft,
  }
}

/**
 * Enforce span constraints on text content.
 * Applies exact spans and min/max range constraints.
 *
 * @param text - The text content to constrain
 * @param box - The box with span/spanRange configuration
 * @param orientation - Flow direction
 * @param context - Rendering context for resolving percentages
 * @returns Text with enforced span constraints
 *
 * @internal
 */
const enforceSpan = (
  text: string,
  box: Box,
  orientation: PropOrientation.Orientation,
  context: RenderContext,
  borderMainConsumption: number = 0,
  borderCrossConsumption: number = 0,
  paddingMainConsumption: number = 0,
  paddingCrossConsumption: number = 0,
): string => {
  let result = text

  // Resolve desired spans, then subtract border/padding for border-box model
  // The span specifies total size including border/padding, so content area is smaller
  const resolvedMainSpan = box.span
    ? resolveSpanValue(box.span.main, context.availableMainSpan)
    : undefined
  const resolvedCrossSpan = box.span
    ? resolveSpanValue(box.span.cross, context.availableCrossSpan)
    : undefined
  const desiredMainSpan =
    resolvedMainSpan !== undefined
      ? Math.max(0, resolvedMainSpan - borderMainConsumption - paddingMainConsumption)
      : undefined
  const desiredCrossSpan =
    resolvedCrossSpan !== undefined
      ? Math.max(0, resolvedCrossSpan - borderCrossConsumption - paddingCrossConsumption)
      : undefined

  // Get spanRange constraints
  const minMainSpan = box.spanRange?.main?.min
  const maxMainSpan = box.spanRange?.main?.max
  const minCrossSpan = box.spanRange?.cross?.min
  const maxCrossSpan = box.spanRange?.cross?.max

  // Calculate final target spans (priority: exact span → range constraints)
  const textLines = Str.Text.lines(result)
  const intrinsicMainSpan = textLines.length
  const intrinsicCrossSpan =
    textLines.length === 0 ? 0 : Math.max(...textLines.map((line) => line.length))

  // Main span (height in vertical, width in horizontal)
  let targetMainSpan = desiredMainSpan ?? intrinsicMainSpan
  if (minMainSpan !== undefined && targetMainSpan < minMainSpan) targetMainSpan = minMainSpan
  if (maxMainSpan !== undefined && targetMainSpan > maxMainSpan) targetMainSpan = maxMainSpan

  // Cross span (width in vertical, height in horizontal)
  let targetCrossSpan = desiredCrossSpan ?? intrinsicCrossSpan
  if (minCrossSpan !== undefined && targetCrossSpan < minCrossSpan) targetCrossSpan = minCrossSpan
  if (maxCrossSpan !== undefined && targetCrossSpan > maxCrossSpan) targetCrossSpan = maxCrossSpan

  // Enforce cross span (affects line length)
  if (targetCrossSpan !== intrinsicCrossSpan) {
    result = Str.Text.unlines(
      textLines.map((line) => {
        if (line.length > targetCrossSpan) {
          // Truncate
          return line.slice(0, targetCrossSpan)
        } else if (line.length < targetCrossSpan) {
          // Pad
          return line.padEnd(targetCrossSpan, ' ')
        }
        return line
      }),
    )
  }

  // Enforce main span (affects number of lines)
  if (targetMainSpan !== intrinsicMainSpan) {
    const currentLines = Str.Text.lines(result)
    if (currentLines.length > targetMainSpan) {
      // Truncate lines
      result = Str.Text.unlines(currentLines.slice(0, targetMainSpan))
    } else if (currentLines.length < targetMainSpan) {
      // Add empty lines
      const linesToAdd = targetMainSpan - currentLines.length
      const emptyLine = ' '.repeat(targetCrossSpan)
      result = result + Str.Char.newline + Array(linesToAdd).fill(emptyLine).join(Str.Char.newline)
    }
  }

  return result
}

/**
 * Apply padding to text with hook evaluation.
 * Uses logical properties (mainStart/mainEnd/crossStart/crossEnd).
 * Maps logical properties to physical coordinates based on orientation.
 * @internal
 */
const renderPadding = (
  text: string,
  padding: PropPadding.Padding,
  box: Box,
  orientation: PropOrientation.Orientation,
  context: RenderContext,
): string => {
  let result = text
  const textLines = Str.Text.lines(text)
  const mapping = getLogicalMapping(orientation)

  // Convert a padding value to its string representation with context-aware % resolution
  const toStr = (
    value: number | string | bigint | undefined,
    key: keyof PropPadding.Padding,
  ): string => {
    const isMainAxis = key === 'mainStart' || key === 'mainEnd'
    const availableSpan = isMainAxis ? context.availableMainSpan : context.availableCrossSpan
    return resolveSidedToString(value, availableSpan)
  }

  // Helper to evaluate hooks for a logical property
  const evaluateHooks = (
    key: keyof PropPadding.Padding,
    staticValue: number | string | bigint | undefined,
    lineIndex?: number,
  ): number | string | bigint | undefined => {
    const hooks = (box as any).paddingHooks[key]
    if (!hooks || hooks.length === 0) return staticValue

    const ctx =
      key === 'mainStart' || key === 'mainEnd'
        ? { lineIndex: lineIndex ?? 0, totalLines: textLines.length }
        : {}

    let value = staticValue
    for (const hook of hooks) {
      const hookResult = hook(ctx)
      value =
        typeof hookResult === 'function'
          ? hookResult(typeof value === `number` ? value : 0)
          : hookResult
    }
    return value
  }

  // Newlines before (main axis start)
  const before = evaluateHooks(mapping.newlinesBefore, padding[mapping.newlinesBefore])
  if (before) {
    const beforeStr = toStr(before, mapping.newlinesBefore)
    if (beforeStr) {
      // For main axis, if it's a number/bigint resolved to spaces, convert to newlines
      if (typeof before === 'number') {
        result = Str.Char.newline.repeat(before) + result
      } else if (typeof before === 'bigint') {
        const resolved = resolveSidedToString(before, context.availableMainSpan)
        result = Str.Char.newline.repeat(resolved.length) + result
      } else {
        result = before + result
      }
    }
  }

  // Spaces before lines (cross axis start)
  const leftKey = mapping.spacesBeforeLines
  const leftHooks = (box as any).paddingHooks[leftKey]
  if (padding[leftKey] || (leftHooks && leftHooks.length > 0)) {
    result = Str.Text.unlines(
      Str.Text.lines(result).map((line, i) => {
        const left = evaluateHooks(leftKey, padding[leftKey], i)
        const leftStr = toStr(left, leftKey)
        return leftStr ? leftStr + line : line
      }),
    )
  }

  // Spaces after lines (cross axis end)
  const rightKey = mapping.spacesAfterLines
  const rightHooks = (box as any).paddingHooks[rightKey]
  if (padding[rightKey] || (rightHooks && rightHooks.length > 0)) {
    result = Str.Text.unlines(
      Str.Text.lines(result).map((line, i) => {
        const right = evaluateHooks(rightKey, padding[rightKey], i)
        const rightStr = toStr(right, rightKey)
        return rightStr ? line + rightStr : line
      }),
    )
  }

  // Newlines after (main axis end)
  const after = evaluateHooks(mapping.newlinesAfter, padding[mapping.newlinesAfter])
  if (after) {
    if (typeof after === 'number') {
      result = result + Str.Char.newline.repeat(after)
    } else if (typeof after === 'bigint') {
      const resolved = resolveSidedToString(after, context.availableMainSpan)
      result = result + Str.Char.newline.repeat(resolved.length)
    } else {
      result = result + after
    }
  }

  return result
}

/**
 * Apply margin to text with hook evaluation.
 * Uses logical properties (mainStart/mainEnd/crossStart/crossEnd).
 * Maps logical properties to physical coordinates based on orientation.
 * @internal
 */
const renderMargin = (
  text: string,
  margin: PropMargin.Margin,
  box: Box,
  orientation: PropOrientation.Orientation,
  context: RenderContext,
): string => {
  let result = text
  const textLines = Str.Text.lines(text)
  const mapping = getLogicalMapping(orientation)

  // Convert a margin value to its string representation with context-aware % resolution
  const toStr = (
    value: number | string | bigint | undefined,
    key: keyof PropMargin.Margin,
  ): string => {
    const isMainAxis = key === 'mainStart' || key === 'mainEnd'
    const availableSpan = isMainAxis ? context.availableMainSpan : context.availableCrossSpan
    return resolveSidedToString(value, availableSpan)
  }

  // Helper to evaluate hooks for a logical property
  const evaluateHooks = (
    key: keyof PropMargin.Margin,
    staticValue: number | string | bigint | undefined,
    lineIndex?: number,
  ): number | string | bigint | undefined => {
    const hooks = (box as any).marginHooks[key]
    if (!hooks || hooks.length === 0) return staticValue

    const ctx =
      key === 'mainStart' || key === 'mainEnd'
        ? { lineIndex: lineIndex ?? 0, totalLines: textLines.length }
        : {}

    let value = staticValue
    for (const hook of hooks) {
      const hookResult = hook(ctx)
      value =
        typeof hookResult === 'function'
          ? hookResult(typeof value === `number` ? value : 0)
          : hookResult
    }
    return value
  }

  // Newlines before (main axis start)
  const before = evaluateHooks(mapping.newlinesBefore, margin[mapping.newlinesBefore])
  if (before) {
    if (typeof before === 'number') {
      result = Str.Char.newline.repeat(before) + result
    } else if (typeof before === 'bigint') {
      const resolved = resolveSidedToString(before, context.availableMainSpan)
      result = Str.Char.newline.repeat(resolved.length) + result
    } else {
      result = before + result
    }
  }

  // Spaces before lines (cross axis start)
  const leftKey = mapping.spacesBeforeLines
  const leftHooks = (box as any).marginHooks[leftKey]
  if (margin[leftKey] || (leftHooks && leftHooks.length > 0)) {
    result = Str.Text.unlines(
      Str.Text.lines(result).map((line, i) => {
        const left = evaluateHooks(leftKey, margin[leftKey], i)
        const leftStr = toStr(left, leftKey)
        return leftStr ? leftStr + line : line
      }),
    )
  }

  // Spaces after lines (cross axis end)
  const rightKey = mapping.spacesAfterLines
  const rightHooks = (box as any).marginHooks[rightKey]
  if (margin[rightKey] || (rightHooks && rightHooks.length > 0)) {
    result = Str.Text.unlines(
      Str.Text.lines(result).map((line, i) => {
        const right = evaluateHooks(rightKey, margin[rightKey], i)
        const rightStr = toStr(right, rightKey)
        return rightStr ? line + rightStr : line
      }),
    )
  }

  // Newlines after (main axis end)
  const after = evaluateHooks(mapping.newlinesAfter, margin[mapping.newlinesAfter])
  if (after) {
    if (typeof after === 'number') {
      result = result + Str.Char.newline.repeat(after)
    } else if (typeof after === 'bigint') {
      const resolved = resolveSidedToString(after, context.availableMainSpan)
      result = result + Str.Char.newline.repeat(resolved.length)
    } else {
      result = result + after
    }
  }

  return result
}

/**
 * Apply border to text with hook evaluation.
 * Supports partial borders - only renders sides that are specified.
 * @internal
 */
const renderBorder = (text: string, border: PropBorder.Border, box: Box): string => {
  // Resolve chars with priority: style → edges/corners override
  let edges: Partial<S.SimplifyMutable<PropBorder.BorderEdges>> = {}
  let corners: Partial<S.SimplifyMutable<PropBorder.BorderCorners>> = {}

  // 1. Start with style if provided (gives all edges and corners)
  if (border.style) {
    edges = toMutableBorderEdges(PropBorder.styles[border.style].edges)
    corners = toMutableBorderCorners(PropBorder.styles[border.style].corners)
  }

  // 2. Apply edges override if provided
  if (border.edges) {
    edges = { ...edges, ...toMutableBorderEdges(border.edges) }
  }

  // 3. Apply corners override if provided
  if (border.corners) {
    corners = { ...corners, ...toMutableBorderCorners(border.corners) }
  }

  const textLines = Str.Text.lines(text)
  const maxWidth = textLines.length === 0 ? 0 : Math.max(...textLines.map((line) => line.length))

  // Helper to evaluate edge hooks
  const evaluateEdgeHook = (
    key: keyof PropBorder.BorderEdges,
    staticValue: string | undefined,
    ctx: any,
  ): string | undefined => {
    const hooks = (box as any).borderEdgeHooks?.[key]
    if (!hooks || hooks.length === 0) return staticValue

    // Reduce hooks to get final value
    let value = staticValue
    for (const hook of hooks) {
      const result = hook(ctx)
      if (typeof result === 'function') {
        // Transformer: (ctx) => (value) => value
        value = result(value ?? '')
      } else {
        // Generator: (ctx) => value
        value = result
      }
    }
    return value
  }

  // Helper to evaluate corner hooks
  const evaluateCornerHook = (
    key: keyof PropBorder.BorderCorners,
    staticValue: string | undefined,
    ctx: any,
  ): string | undefined => {
    const hooks = (box as any).borderCornerHooks?.[key]
    if (!hooks || hooks.length === 0) return staticValue

    // Reduce hooks to get final value
    let value = staticValue
    for (const hook of hooks) {
      const result = hook(ctx)
      if (typeof result === 'function') {
        // Transformer: (ctx) => (value) => value
        value = result(value ?? '')
      } else {
        // Generator: (ctx) => value
        value = result
      }
    }
    return value
  }

  // Apply corner hooks
  corners.topLeft = evaluateCornerHook('topLeft', corners.topLeft, { char: corners.topLeft ?? '' })
  corners.topRight = evaluateCornerHook('topRight', corners.topRight, {
    char: corners.topRight ?? '',
  })
  corners.bottomLeft = evaluateCornerHook('bottomLeft', corners.bottomLeft, {
    char: corners.bottomLeft ?? '',
  })
  corners.bottomRight = evaluateCornerHook('bottomRight', corners.bottomRight, {
    char: corners.bottomRight ?? '',
  })

  // Determine which sides have borders
  const hasTop = edges.top !== undefined
  const hasBottom = edges.bottom !== undefined
  const hasLeft = edges.left !== undefined
  const hasRight = edges.right !== undefined

  // Build content lines with left/right borders (may be different per line if hooks exist)
  const contentLines = textLines.map((line, lineIndex) => {
    const paddedLine = line.padEnd(maxWidth, ' ')
    let result = paddedLine

    // Apply left border with hooks
    if (hasLeft || (box as any).borderEdgeHooks?.left) {
      const leftChar = evaluateEdgeHook('left', edges.left, {
        lineIndex,
        totalLines: textLines.length,
        char: edges.left ?? '',
      })
      if (leftChar) {
        const leftStyle = (box as any).borderEdgeStyles?.left
        const styledLeftChar = applyStyle(leftChar, leftStyle)
        result = styledLeftChar + result
      }
    }

    // Apply right border with hooks
    if (hasRight || (box as any).borderEdgeHooks?.right) {
      const rightChar = evaluateEdgeHook('right', edges.right, {
        lineIndex,
        totalLines: textLines.length,
        char: edges.right ?? '',
      })
      if (rightChar) {
        const rightStyle = (box as any).borderEdgeStyles?.right
        const styledRightChar = applyStyle(rightChar, rightStyle)
        result = result + styledRightChar
      }
    }

    return result
  })

  // Build top border with hooks (character may change per column)
  const topBorder =
    hasTop || (box as any).borderEdgeHooks?.top
      ? (() => {
          let line = ''
          // Left corner
          if ((hasLeft || (box as any).borderEdgeHooks?.left) && corners.topLeft) {
            const topLeftStyle = (box as any).borderCornerStyles?.topLeft
            const styledTopLeft = applyStyle(corners.topLeft, topLeftStyle)
            line += styledTopLeft
          }
          // Top chars (may be different per column if hooks exist)
          const topStyle = (box as any).borderEdgeStyles?.top
          for (let colIndex = 0; colIndex < maxWidth; colIndex++) {
            const topChar = evaluateEdgeHook('top', edges.top, {
              colIndex,
              totalCols: maxWidth,
              char: edges.top ?? '',
            })
            const styledTopChar = applyStyle(topChar ?? '', topStyle)
            line += styledTopChar
          }
          // Right corner
          if ((hasRight || (box as any).borderEdgeHooks?.right) && corners.topRight) {
            const topRightStyle = (box as any).borderCornerStyles?.topRight
            const styledTopRight = applyStyle(corners.topRight, topRightStyle)
            line += styledTopRight
          }
          return line || null
        })()
      : null

  // Build bottom border with hooks (character may change per column)
  const bottomBorder =
    hasBottom || (box as any).borderEdgeHooks?.bottom
      ? (() => {
          let line = ''
          // Left corner
          if ((hasLeft || (box as any).borderEdgeHooks?.left) && corners.bottomLeft) {
            const bottomLeftStyle = (box as any).borderCornerStyles?.bottomLeft
            const styledBottomLeft = applyStyle(corners.bottomLeft, bottomLeftStyle)
            line += styledBottomLeft
          }
          // Bottom chars (may be different per column if hooks exist)
          const bottomStyle = (box as any).borderEdgeStyles?.bottom
          for (let colIndex = 0; colIndex < maxWidth; colIndex++) {
            const bottomChar = evaluateEdgeHook('bottom', edges.bottom, {
              colIndex,
              totalCols: maxWidth,
              char: edges.bottom ?? '',
            })
            const styledBottomChar = applyStyle(bottomChar ?? '', bottomStyle)
            line += styledBottomChar
          }
          // Right corner
          if ((hasRight || (box as any).borderEdgeHooks?.right) && corners.bottomRight) {
            const bottomRightStyle = (box as any).borderCornerStyles?.bottomRight
            const styledBottomRight = applyStyle(corners.bottomRight, bottomRightStyle)
            line += styledBottomRight
          }
          return line || null
        })()
      : null

  return [topBorder, ...contentLines, bottomBorder]
    .filter((line) => line !== null)
    .join(Str.Char.newline)
}

/**
 * Render content (string, styled text, or array of these/boxes) to a string.
 * @internal
 */
const renderContent = (
  content: string | StyledText | readonly (string | StyledText | Box)[],
  orientation: PropOrientation.Orientation,
  context: RenderContext,
  gap?: PropGap.Gap,
): string => {
  // If content is a string, return it directly
  if (typeof content === 'string') {
    return content
  }

  // If content is StyledText, apply styling
  if (!Array.isArray(content) && 'text' in content) {
    return applyStyle(content.text, content)
  }

  // Array of items - render each recursively
  const renderedItems = content.map((item) => {
    if (typeof item === 'string') return item
    if ('text' in item) return applyStyle(item.text, item)
    return renderWithContext(item, context)
  })

  // Join based on orientation
  if (orientation === 'vertical') {
    // Vertical: stack items top-to-bottom
    // gap.main = newlines between items
    const resolved = resolveGap(gap?.main, context.availableMainSpan)
    let separator: string
    if (!resolved) {
      separator = Str.Char.newline
    } else if (resolved.type === 'literal') {
      separator = resolved.value
    } else {
      separator = Str.Char.newline.repeat(1 + resolved.value)
    }
    return renderedItems.join(separator)
  } else {
    // Horizontal: place items side-by-side
    // gap.main = spaces between items (in horizontal, main axis affects width)
    const resolved = resolveGap(gap?.main, context.availableCrossSpan)
    let gapColumn: string
    if (!resolved) {
      gapColumn = ''
    } else if (resolved.type === 'literal') {
      gapColumn = resolved.value
    } else {
      gapColumn = Str.Char.spaceRegular.repeat(resolved.value)
    }

    // For side-by-side rendering, we need to:
    // 1. Split each item into lines
    // 2. Pad lines to equal height
    // 3. Concatenate corresponding lines horizontally (with gap)
    const itemLines = renderedItems.map((item) => Str.Text.lines(item))
    const maxHeight = Math.max(...itemLines.map((lines) => lines.length), 0)
    const itemWidths = itemLines.map((lines) => Math.max(...lines.map((line) => line.length), 0))

    // Build result line by line
    const resultLines: string[] = []
    for (let lineIndex = 0; lineIndex < maxHeight; lineIndex++) {
      const lineParts: string[] = []
      for (let itemIndex = 0; itemIndex < itemLines.length; itemIndex++) {
        const itemLine = itemLines[itemIndex]![lineIndex] ?? ''
        // Pad to item width for alignment
        lineParts.push(itemLine.padEnd(itemWidths[itemIndex]!, ' '))
      }
      // Join with gap
      resultLines.push(lineParts.join(gapColumn))
    }

    return Str.Text.unlines(resultLines)
  }
}

/**
 * Render a box to a string.
 */
export const render = (box: Box): string => renderWithContext(box, {})

const renderWithContext = (box: Box, context: RenderContext): string => {
  // Get orientation (default to vertical)
  const orientation = box.orientation ?? 'vertical'

  // Calculate context for children based on this box's span
  // Children see this box's resolved span as their available space
  const childContext: RenderContext = { ...context }

  if (box.span) {
    const resolvedMain = resolveSpanValue(box.span.main, context.availableMainSpan)
    const resolvedCross = resolveSpanValue(box.span.cross, context.availableCrossSpan)

    if (resolvedMain !== undefined) childContext.availableMainSpan = resolvedMain
    if (resolvedCross !== undefined) childContext.availableCrossSpan = resolvedCross
  }

  // Calculate border consumption by measuring each edge character's visual width
  let borderMainConsumption = 0
  let borderCrossConsumption = 0
  if (box.border?.edges) {
    // Border edges are physical (top/right/bottom/left)
    // In vertical mode: main=height (lines), cross=width (chars)
    // In horizontal mode: main=width (chars), cross=height (lines)
    if (orientation === 'vertical') {
      // Cross axis (width): left and right borders consume horizontal space
      if (box.border.edges.left) borderCrossConsumption += Str.Visual.width(box.border.edges.left)
      if (box.border.edges.right) borderCrossConsumption += Str.Visual.width(box.border.edges.right)
      // Main axis (lines): top and bottom each add 1 line
      if (box.border.edges.top) borderMainConsumption += 1
      if (box.border.edges.bottom) borderMainConsumption += 1
    } else {
      // Cross axis (height): top and bottom each add 1 line
      if (box.border.edges.top) borderCrossConsumption += 1
      if (box.border.edges.bottom) borderCrossConsumption += 1
      // Main axis (width): left and right consume horizontal space
      if (box.border.edges.left) borderMainConsumption += Str.Visual.width(box.border.edges.left)
      if (box.border.edges.right) borderMainConsumption += Str.Visual.width(box.border.edges.right)
    }
  }

  // Calculate padding consumption - caller resolves undefined to 0
  const mainSpan = childContext.availableMainSpan ?? 0
  const crossSpan = childContext.availableCrossSpan ?? 0
  let paddingMainConsumption = 0
  let paddingCrossConsumption = 0
  if (box.padding) {
    paddingMainConsumption += PropPadding.resolveValue(box.padding.mainStart, mainSpan)
    paddingMainConsumption += PropPadding.resolveValue(box.padding.mainEnd, mainSpan)
    paddingCrossConsumption += PropPadding.resolveValue(box.padding.crossStart, crossSpan)
    paddingCrossConsumption += PropPadding.resolveValue(box.padding.crossEnd, crossSpan)
  }

  // Calculate margin consumption
  let marginMainConsumption = 0
  let marginCrossConsumption = 0
  if (box.margin) {
    marginMainConsumption += PropMargin.resolveValue(box.margin.mainStart, mainSpan)
    marginMainConsumption += PropMargin.resolveValue(box.margin.mainEnd, mainSpan)
    marginCrossConsumption += PropMargin.resolveValue(box.margin.crossStart, crossSpan)
    marginCrossConsumption += PropMargin.resolveValue(box.margin.crossEnd, crossSpan)
  }

  // Subtract border, padding, and margin from available span for children
  if (childContext.availableMainSpan !== undefined) {
    childContext.availableMainSpan = Math.max(
      0,
      childContext.availableMainSpan -
        borderMainConsumption -
        paddingMainConsumption -
        marginMainConsumption,
    )
  }
  if (childContext.availableCrossSpan !== undefined) {
    childContext.availableCrossSpan = Math.max(
      0,
      childContext.availableCrossSpan -
        borderCrossConsumption -
        paddingCrossConsumption -
        marginCrossConsumption,
    )
  }

  // Render content (may be string or nested boxes) with gap
  let result = renderContent(box.content, orientation, childContext, box.gap)

  // Enforce span constraints (exact size or range constraints)
  // Pass border/padding consumption for border-box model calculation
  if (box.span || box.spanRange) {
    result = enforceSpan(
      result,
      box,
      orientation,
      context,
      borderMainConsumption,
      borderCrossConsumption,
      paddingMainConsumption,
      paddingCrossConsumption,
    )
  }

  // Apply layers from inside out: content → gap → span → padding → border → margin
  if (box.padding) {
    result = renderPadding(result, box.padding, box, orientation, context)
  }

  if (box.border) {
    result = renderBorder(result, box.border, box)
  }

  if (box.margin) {
    result = renderMargin(result, box.margin, box, orientation, context)
  }

  return result
}
