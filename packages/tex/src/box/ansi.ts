/**
 * ANSI escape code utilities for terminal styling.
 *
 * Uses the ansis library to generate ANSI codes for colors and styles.
 *
 * @see https://github.com/webdiscus/ansis - ansis library
 * @see https://en.wikipedia.org/wiki/ANSI_escape_code - ANSI escape codes
 * @category Text Formatting
 * @internal
 */

import { Color } from '@kitz/color'
import ansis from 'ansis'
import type { Style } from './style.js'

/**
 * An ansis style object - a callable function with `.open` and `.close` properties.
 *
 * This is the type returned by ansis style chains (e.g., `ansis.red`, `ansis.bold.red.underline`).
 * The `.open` and `.close` properties contain the ANSI escape codes.
 *
 * ansis automatically handles nested styles - when you wrap text that contains
 * inner ANSI codes, it detects inner resets and replaces them with the outer style,
 * enabling proper color restoration in nested blocks.
 *
 * @category Text Formatting
 */
export type AnsiStyle = ((text: string) => string) & { open: string; close: string }

/**
 * Type guard to check if a value is an AnsiStyle (ansis chain).
 *
 * @param value - Value to check
 * @returns True if value is an AnsiStyle
 *
 * @category Text Formatting
 */
export const isAnsiStyle = (value: unknown): value is AnsiStyle => {
  return (
    typeof value === 'function' &&
    typeof (value as any).open === 'string' &&
    typeof (value as any).close === 'string'
  )
}

/**
 * Build an ansis style chain from a declarative Style spec.
 *
 * @param style - Declarative style specification
 * @returns An ansis chain that can be called to wrap text
 *
 * @category Text Formatting
 */
export const buildAnsiChain = (style: Style): AnsiStyle => {
  let chain: any = ansis

  if (style.bold) chain = chain.bold
  if (style.dim) chain = chain.dim
  if (style.italic) chain = chain.italic
  if (style.underline) chain = chain.underline
  if (style.strikethrough) chain = chain.strikethrough
  if (style.inverse) chain = chain.inverse
  if (style.hidden) chain = chain.hidden

  if (style.color?.foreground) {
    const colorObj =
      typeof style.color.foreground === 'string'
        ? Color.fromString(style.color.foreground)
        : Color.fromRgb(style.color.foreground)
    chain = chain.rgb(colorObj.r, colorObj.g, colorObj.b)
  }

  if (style.color?.background) {
    const colorObj =
      typeof style.color.background === 'string'
        ? Color.fromString(style.color.background)
        : Color.fromRgb(style.color.background)
    chain = chain.bgRgb(colorObj.r, colorObj.g, colorObj.b)
  }

  return chain
}

/**
 * Apply ANSI styles to text.
 *
 * Takes a Style configuration and wraps the text with appropriate ANSI escape codes.
 * Returns the original text if no styles are specified.
 *
 * @param text - Text to style
 * @param style - Style configuration (colors and modifiers)
 * @returns Text wrapped with ANSI escape codes
 *
 * @example
 * ```typescript
 * applyStyle('Hello', {
 *   color: { foreground: 'red' },
 *   bold: true
 * })
 * // Returns: '\x1b[1m\x1b[31mHello\x1b[39m\x1b[22m'
 * ```
 *
 * @internal
 */
export const applyStyle = (text: string, style?: Style): string => {
  if (!style || text === '') return text

  let styled = text

  // Apply foreground color
  if (style.color?.foreground) {
    const colorObj =
      typeof style.color.foreground === 'string'
        ? Color.fromString(style.color.foreground)
        : Color.fromRgb(style.color.foreground)
    styled = ansis.rgb(colorObj.r, colorObj.g, colorObj.b)(styled)
  }

  // Apply background color
  if (style.color?.background) {
    const colorObj =
      typeof style.color.background === 'string'
        ? Color.fromString(style.color.background)
        : Color.fromRgb(style.color.background)
    styled = ansis.bgRgb(colorObj.r, colorObj.g, colorObj.b)(styled)
  }

  // Apply underline color (if underline is also enabled)
  // Note: ansis doesn't have direct underline color support, so we skip this for now
  // It would require raw ANSI codes like \x1b[58;2;r;g;bm

  // Apply style modifiers
  if (style.bold) styled = ansis.bold(styled)
  if (style.dim) styled = ansis.dim(styled)
  if (style.italic) styled = ansis.italic(styled)
  if (style.underline) styled = ansis.underline(styled)
  if (style.strikethrough) styled = ansis.strikethrough(styled)
  if (style.inverse) styled = ansis.inverse(styled)
  if (style.hidden) styled = ansis.hidden(styled)
  // Note: ansis doesn't support blink, so we skip it

  return styled
}

/**
 * Extract character from CharStyle or string.
 *
 * @param value - String or CharStyle
 * @returns The character
 *
 * @internal
 */
export const extractChar = (value: string | { char: string }): string => {
  return typeof value === 'string' ? value : value.char
}

/**
 * Extract style from CharStyle.
 *
 * @param value - String or CharStyle
 * @returns Style object if CharStyle, undefined if string
 *
 * @internal
 */
export const extractStyle = (value: string | { char: string }): Style | undefined => {
  if (typeof value === 'string') return undefined

  // Type guard: check if value has style properties
  const maybeStyled = value as any

  return {
    color: maybeStyled.color,
    bold: maybeStyled.bold,
    dim: maybeStyled.dim,
    italic: maybeStyled.italic,
    underline: maybeStyled.underline,
    strikethrough: maybeStyled.strikethrough,
    blink: maybeStyled.blink,
    inverse: maybeStyled.inverse,
    hidden: maybeStyled.hidden,
  }
}
