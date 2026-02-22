import { CoreFn as Fn } from '#fn/core'
import { Char } from './char/_.js'
import { prependWith, repeat, replaceWith } from './replace.js'
import { joinWith, splitWith } from './split.js'

/**
 * Default indentation size in characters.
 * @category Text Formatting
 * @default 2
 */
export const defaultIndentSize = 2

/**
 * Default character used for indentation (non-breaking space).
 * @category Text Formatting
 */
export const defaultIndentCharacter = Char.spaceNoBreak

/**
 * Default line separator character (newline).
 * @category Text Formatting
 */
export const defaultLineSeparator = Char.newline

// ─── Line Endings ────────────────────────────────────────────────────────────

/**
 * Carriage return character (CR, U+000D).
 * Used alone as line ending in classic Mac OS (pre-OS X).
 * @category Line Endings
 */
export const cr = '\r'

/**
 * Line feed character (LF, U+000A).
 * Used as line ending in Unix/Linux/macOS.
 * @category Line Endings
 */
export const lf = '\n'

/**
 * Carriage return + line feed sequence (CRLF).
 * Used as line ending in Windows.
 * @category Line Endings
 */
export const crlf = '\r\n'

/**
 * Pattern matching any line ending style (CRLF, CR, or LF).
 *
 * Order matters: CRLF (`\r\n`) must be matched first to avoid
 * splitting it into separate CR and LF matches.
 *
 * @category Line Endings
 */
export const lineEndingPattern = /\r\n|\r|\n/

/**
 * Normalize all line endings to LF.
 *
 * Converts CRLF (`\r\n`) and CR (`\r`) to LF (`\n`) for consistent
 * cross-platform text handling. Implements "wider input, narrow output"
 * pattern - accept any line ending style, output only LF.
 *
 * @category Line Endings
 * @param text - Text with potentially mixed line endings
 * @returns Text with all line endings normalized to LF
 * @example
 * ```typescript
 * normalizeLineEndings('hello\r\nworld')  // 'hello\nworld'
 * normalizeLineEndings('hello\rworld')    // 'hello\nworld'
 * normalizeLineEndings('a\r\nb\rc\n')     // 'a\nb\nc\n'
 * ```
 */
export const normalizeLineEndings = replaceWith(/\r\n|\r/g, lf)

// Types

/**
 * A column is a vertical stack of lines.
 * @category Text Formatting
 */
export type Column = string[]

// Lines

/**
 * Split text into an array of lines.
 *
 * Handles all common line ending styles:
 * - LF (`\n`) - Unix/Linux/macOS
 * - CRLF (`\r\n`) - Windows
 * - CR (`\r`) - Classic Mac OS
 *
 * @category Text Formatting
 * @param text - The text to split into lines
 * @returns Array of lines
 * @example
 * ```typescript
 * lines('hello\nworld')     // ['hello', 'world'] - Unix
 * lines('hello\r\nworld')   // ['hello', 'world'] - Windows
 * lines('hello\rworld')     // ['hello', 'world'] - Classic Mac
 * lines('mixed\r\n\n\r')    // ['mixed', '', ''] - Mixed endings
 * ```
 */
export const lines = (text: string): string[] => text.split(lineEndingPattern)

/**
 * Join an array of lines into text.
 * Pre-configured {@link joinWith} using newline separator.
 * @category Text Formatting
 * @param lines - Array of lines to join
 * @returns The joined text
 * @example
 * ```typescript
 * unlines(['hello', 'world', '!']) // 'hello\nworld\n!'
 * unlines(['single line']) // 'single line'
 * ```
 */
export const unlines = joinWith(defaultLineSeparator)

// Indent

/**
 * Indent each line of text by a specified number of spaces.
 * @category Text Formatting
 * @param text - The text to indent
 * @param size - Number of spaces to indent (default: {@link defaultIndentSize})
 * @returns The indented text
 * @example
 * ```typescript
 * indent('hello\nworld') // '  hello\n  world'
 * indent('line1\nline2', 4) // '    line1\n    line2'
 * ```
 */
export const indent = (text: string, size?: number | undefined) => {
  const result = unlines(lines(text).map(prependWith(repeat(defaultIndentCharacter, size ?? defaultIndentSize))))
  return result
}

/**
 * Curried version of {@link indent} with text first.
 * @category Text Formatting
 * @param text - The text to indent
 * @returns Function that takes size and returns the indented text
 */
export const indentOn = Fn.curry(indent)

/**
 * Curried version of {@link indent} with size first.
 * @category Text Formatting
 * @param size - Number of spaces to indent
 * @returns Function that takes text and returns the indented text
 * @example
 * ```typescript
 * const indent4 = indentWith(4)
 * indent4('hello\nworld') // '    hello\n    world'
 * ```
 */
export const indentWith = Fn.flipCurried(indentOn)

/**
 * Indent each line using a custom prefix string or function.
 * When given a function, it receives both the line content and index, allowing for content-aware indentation.
 * @category Text Formatting
 * @param text - The text to indent
 * @param prefixOrFn - String to prepend to each line, or function `(line: string, lineIndex: number) => string`
 * @returns The indented text
 * @example
 * ```typescript
 * // Fixed string prefix
 * indentBy('hello\nworld', '>>> ') // '>>> hello\n>>> world'
 *
 * // Dynamic prefix based on line index (ignore line content with _)
 * indentBy('line1\nline2\nline3', (_, i) => `${i + 1}. `)
 * // '1. line1\n2. line2\n3. line3'
 *
 * // Content-aware indentation
 * indentBy('title\nitem', (line, i) => line === 'title' ? '' : '  ')
 * // 'title\n  item'
 * ```
 */
export const indentBy = (text: string, prefixOrFn: string | ((line: string, lineIndex: number) => string)): string => {
  return unlines(
    lines(text).map((line, index) => {
      const prefix = typeof prefixOrFn === `string` ? prefixOrFn : prefixOrFn(line, index)
      return prefix + line
    }),
  )
}

/**
 * Curried version of {@link indentBy} with text first.
 * @category Text Formatting
 * @param text - The text to indent
 * @returns Function that takes prefix and returns the indented text
 */
export const indentByOn = Fn.curry(indentBy)

/**
 * Curried version of {@link indentBy} with prefix first.
 * @category Text Formatting
 * @param prefixOrFn - String or function to use as prefix
 * @returns Function that takes text and returns the indented text
 * @example
 * ```typescript
 * const addArrow = indentByWith('→ ')
 * addArrow('hello\nworld') // '→ hello\n→ world'
 *
 * const numbered = indentByWith((_, i) => `${i}. `)
 * numbered('first\nsecond') // '0. first\n1. second'
 *
 * const conditionalIndent = indentByWith((line, i) =>
 *   line.startsWith('#') ? '' : '  '
 * )
 * conditionalIndent('# Title\nContent') // '# Title\n  Content'
 * ```
 */
export const indentByWith = Fn.flipCurried(indentByOn)

/**
 * Remove common leading whitespace from all lines.
 * Finds the minimum indentation across all non-empty lines and removes that amount from every line.
 * This is useful for dedenting code blocks or template strings while preserving relative indentation.
 * @category Text Formatting
 * @param text - The text to dedent
 * @returns The dedented text
 * @example
 * ```typescript
 * stripIndent('    line1\n      line2\n    line3')
 * // 'line1\n  line2\nline3'
 *
 * stripIndent('  code\n    nested\n  code')
 * // 'code\n  nested\ncode'
 *
 * // Empty lines are ignored when calculating minimum indent
 * stripIndent('    line1\n\n    line2')
 * // 'line1\n\nline2'
 * ```
 */
export const stripIndent = (text: string): string => {
  const textLines = lines(text)

  // Find minimum indentation from non-empty lines
  const indents = textLines
    .filter((line) => line.trim().length > 0) // Skip empty lines
    .map((line) => {
      const match = line.match(/^(\s*)/)
      return match?.[1]?.length ?? 0
    })

  // If no non-empty lines, return original text
  if (indents.length === 0) return text

  const minIndent = Math.min(...indents)

  // Remove the minimum indentation from each line
  return unlines(textLines.map((line) => line.slice(minIndent)))
}

// Padding

/**
 * Default character used for padding.
 * @category Text Formatting
 */
export const defaultPadCharacter = Char.spaceRegular

/**
 * Add padding characters to text.
 * @category Text Formatting
 * @param text - The text to pad
 * @param size - Number of padding characters to add
 * @param side - Which side to add padding ('left' or 'right')
 * @param char - Character to use for padding (default: space)
 * @returns The padded text
 * @example
 * ```typescript
 * pad('hello', 3, 'left') // '   hello'
 * pad('hello', 3, 'right') // 'hello   '
 * pad('hello', 2, 'left', '-') // '--hello'
 * ```
 */
export const pad = (
  text: string,
  size: number,
  side: `left` | `right` = `left`,
  char: string = defaultPadCharacter,
): string => {
  return side === `left` ? char.repeat(size) + text : text + char.repeat(size)
}

/**
 * Curried version of {@link pad} with text first.
 * @category Text Formatting
 * @param text - The text to pad
 * @returns Function that takes size, side, and char
 */
export const padOn = Fn.curry(pad)

/**
 * Curried version of {@link pad} with size first.
 * @category Text Formatting
 * @param size - Number of padding characters to add
 * @returns Function that takes text, side, and char
 */
export const padWith = Fn.flipCurried(padOn)

/**
 * Add left padding to text.
 * @category Text Formatting
 * @param text - The text to pad
 * @param size - Number of padding characters to add
 * @param char - Character to use for padding (default: space)
 * @returns The left-padded text
 * @example
 * ```typescript
 * padLeft('hello', 3) // '   hello'
 * padLeft('hello', 2, '0') // '00hello'
 * ```
 */
export const padLeft = (text: string, size: number, char: string = defaultPadCharacter): string => {
  return pad(text, size, `left`, char)
}

/**
 * Curried version of {@link padLeft} with text first.
 * @category Text Formatting
 * @param text - The text to pad
 * @returns Function that takes size and char
 */
export const padLeftOn = Fn.curry(padLeft)

/**
 * Curried version of {@link padLeft} with size first.
 * @category Text Formatting
 * @param size - Number of padding characters to add
 * @returns Function that takes text and char
 * @example
 * ```typescript
 * const pad3 = padLeftWith(3)
 * pad3('hi') // '   hi'
 * ```
 */
export const padLeftWith = Fn.flipCurried(padLeftOn)

/**
 * Add right padding to text.
 * @category Text Formatting
 * @param text - The text to pad
 * @param size - Number of padding characters to add
 * @param char - Character to use for padding (default: space)
 * @returns The right-padded text
 * @example
 * ```typescript
 * padRight('hello', 3) // 'hello   '
 * padRight('hello', 2, '.') // 'hello..'
 * ```
 */
export const padRight = (text: string, size: number, char: string = defaultPadCharacter): string => {
  return pad(text, size, `right`, char)
}

/**
 * Curried version of {@link padRight} with text first.
 * @category Text Formatting
 * @param text - The text to pad
 * @returns Function that takes size and char
 */
export const padRightOn = Fn.curry(padRight)

/**
 * Curried version of {@link padRight} with size first.
 * @category Text Formatting
 * @param size - Number of padding characters to add
 * @returns Function that takes text and char
 * @example
 * ```typescript
 * const pad3 = padRightWith(3)
 * pad3('hi') // 'hi   '
 * ```
 */
export const padRightWith = Fn.flipCurried(padRightOn)

/**
 * Align text within a specified width by adding padding.
 *
 * This ensures text spans exactly the target width, aligning content to the left or right.
 * If the text is already wider than the target width, no padding is added.
 *
 * @category Text Formatting
 * @param text - The text to align
 * @param width - Target width (in characters)
 * @param align - Content alignment ('left' or 'right')
 * @param char - Character to use for padding (default: space)
 * @returns The aligned text
 *
 * @example
 * ```typescript
 * // Left-align (pad right)
 * Str.span('hi', 5, 'left')     // 'hi   '
 *
 * // Right-align (pad left)
 * Str.span('hi', 5, 'right')    // '   hi'
 *
 * // Text already wider - no padding added
 * Str.span('hello world', 5, 'left')  // 'hello world' (unchanged)
 * ```
 */
export const span = (
  text: string,
  width: number,
  align: `left` | `right` = `left`,
  char: string = defaultPadCharacter,
): string => {
  const padSize = width - text.length
  if (padSize <= 0) return text
  return align === `left` ? text + char.repeat(padSize) : char.repeat(padSize) + text
}

/**
 * Curried version of {@link span} with text first.
 * @category Text Formatting
 * @param text - The text to align
 * @returns Function that takes width, align, and char
 */
export const spanOn = Fn.curry(span)

/**
 * Curried version of {@link span} with width first.
 * @category Text Formatting
 * @param width - Target width
 * @returns Function that takes text, align, and char
 *
 * @example
 * ```typescript
 * const span8 = Str.spanWith(8)
 * span8('Name', 'left')   // 'Name    '
 * span8('Age', 'right')   // '     Age'
 * ```
 */
export const spanWith = Fn.flipCurried(spanOn)

/**
 * Constrain text to exact width by cropping and/or padding.
 *
 * Unlike {@link span} which only pads (leaving text unchanged if too long),
 * this function guarantees the exact width by:
 * - Cropping text if it exceeds the target width
 * - Padding text if it's shorter than the target width
 *
 * This is useful for fixed-width layouts where column widths must be exact,
 * such as table columns, CSV files, and fixed-format text files.
 *
 * @category Text Formatting
 * @param text - The text to constrain
 * @param width - Exact target width (in characters)
 * @param align - Content alignment ('left' or 'right')
 * @param char - Character to use for padding (default: space)
 * @returns Text constrained to exact width
 *
 * @example
 * ```typescript
 * // Text too long - gets cropped
 * Str.fit('hello world', 5, 'left')  // 'hello'
 *
 * // Text too short - gets padded
 * Str.fit('hi', 5, 'left')           // 'hi   '
 * Str.fit('hi', 5, 'right')          // '   hi'
 *
 * // Perfect fit - unchanged
 * Str.fit('exact', 5, 'left')        // 'exact'
 *
 * // Use case: Fixed-width table columns
 * const columns = ['Name', 'Email', 'Status'].map(
 *   (header, i) => Str.fit(header, [10, 20, 8][i], 'left')
 * )
 * // ['Name      ', 'Email               ', 'Status  ']
 *
 * // CSV formatting with fixed columns
 * const row = [name, email, status].map((val, i) =>
 *   Str.fit(val, [20, 30, 10][i], 'left')
 * ).join(',')
 * ```
 */
export const fit = (
  text: string,
  width: number,
  align: `left` | `right` = `left`,
  char: string = defaultPadCharacter,
): string => {
  const cropped = text.slice(0, width)
  return span(cropped, width, align, char)
}

/**
 * Curried version of {@link fit} with text first.
 * @category Text Formatting
 * @param text - The text to constrain
 * @returns Function that takes width, align, and char
 */
export const fitOn = Fn.curry(fit)

/**
 * Curried version of {@link fit} with width first.
 * @category Text Formatting
 * @param width - Exact target width
 * @returns Function that takes text, align, and char
 *
 * @example
 * ```typescript
 * // Create fixed-width formatters
 * const nameColumn = Str.fitWith(20)
 * const statusColumn = Str.fitWith(10)
 *
 * nameColumn('John Doe', 'left')         // 'John Doe            '
 * statusColumn('Active', 'left')         // 'Active    '
 * statusColumn('Very Long Status', 'left') // 'Very Long '
 * ```
 */
export const fitWith = Fn.flipCurried(fitOn)

/**
 * Map a transformation function over each line of text.
 * @category Text Formatting
 * @param text - The text to transform
 * @param fn - Function to apply to each line, receiving the line and its index
 * @returns The transformed text
 * @example
 * ```typescript
 * mapLines('hello\nworld', (line) => line.toUpperCase())
 * // 'HELLO\nWORLD'
 *
 * mapLines('a\nb\nc', (line, i) => `${i}: ${line}`)
 * // '0: a\n1: b\n2: c'
 * ```
 */
export const mapLines = (text: string, fn: (line: string, index: number) => string): string => {
  return unlines(lines(text).map(fn))
}

/**
 * Curried version of {@link mapLines} with text first.
 * @category Text Formatting
 * @param text - The text to transform
 * @returns Function that takes the transformation function
 */
export const mapLinesOn = Fn.curry(mapLines)

/**
 * Curried version of {@link mapLines} with function first.
 * @category Text Formatting
 * @param fn - Function to apply to each line
 * @returns Function that takes the text to transform
 * @example
 * ```typescript
 * const uppercase = mapLinesWith((line) => line.toUpperCase())
 * uppercase('hello\nworld') // 'HELLO\nWORLD'
 * ```
 */
export const mapLinesWith = Fn.flipCurried(mapLinesOn)

// Prefix

/**
 * Styled prefix that can have an optional color function.
 * Used with {@link formatBlock} for colored line prefixes.
 *
 * @category Text Formatting
 */
export type StyledPrefix = {
  /**
   * The prefix text/symbol to display.
   */
  symbol: string
  /**
   * Optional function to colorize the prefix.
   */
  color?: (text: string) => string
}

/**
 * Format a multi-line text block with line-by-line transformations.
 *
 * Processes each line of text, adding a prefix and optional indentation.
 * Supports excluding the first line and styled prefixes with colors.
 *
 * @category Text Formatting
 * @param block - The text block to format
 * @param opts - Formatting options
 * @param opts.prefix - Prefix to add to each line (string or styled with color)
 * @param opts.indent - Number of spaces to indent after prefix
 * @param opts.excludeFirstLine - Skip formatting the first line (default: false)
 * @returns Formatted text block
 *
 * @example
 * ```typescript
 * // Simple string prefix
 * formatBlock('line1\nline2\nline3', { prefix: '> ' })
 * // '> line1\n> line2\n> line3'
 *
 * // With indentation
 * formatBlock('line1\nline2', { prefix: '| ', indent: 2 })
 * // '|   line1\n|   line2'
 *
 * // Exclude first line (useful for continuing indentation)
 * formatBlock('header\nline1\nline2', { prefix: '  ', excludeFirstLine: true })
 * // 'header\n  line1\n  line2'
 *
 * // Single line - returned as-is
 * formatBlock('single', { prefix: '> ' })
 * // 'single'
 *
 * // Styled prefix with color function
 * formatBlock('data\nmore data', {
 *   prefix: {
 *     symbol: '│ ',
 *     color: (text) => `\x1b[90m${text}\x1b[0m` // gray color
 *   },
 *   indent: 2
 * })
 * // '\x1b[90m│ \x1b[0m  data\n\x1b[90m│ \x1b[0m  more data'
 * ```
 */
export const formatBlock = (
  block: string,
  opts: {
    prefix?: string | StyledPrefix
    indent?: number
    excludeFirstLine?: boolean
  },
): string => {
  const [first, ...rest] = lines(block)
  if (rest.length === 0) return first!

  const linesToProcess = opts.excludeFirstLine === true ? rest : (rest.unshift(first!), rest)
  const prefixText = typeof opts.prefix === `string` ? opts.prefix : opts.prefix?.symbol ?? ``
  const indentText = opts.indent !== undefined ? Char.spaceRegular.repeat(opts.indent) : ``
  const linesProcessed = opts.excludeFirstLine === true ? [first] : []

  for (const line of linesToProcess) {
    const prefixRendered = typeof opts.prefix === `object`
      ? opts.prefix?.color?.(prefixText) ?? prefixText
      : prefixText
    linesProcessed.push(prefixRendered + indentText + line)
  }

  return unlines(linesProcessed.filter((line): line is string => line !== undefined))
}

/**
 * Curried version of {@link formatBlock} with block first.
 * @category Text Formatting
 * @param block - The text block to format
 * @returns Function that takes formatting options
 */
export const formatBlockOn = Fn.curry(formatBlock)

/**
 * Curried version of {@link formatBlock} with options first.
 * @category Text Formatting
 * @param opts - Formatting options
 * @returns Function that takes the text block
 * @example
 * ```typescript
 * const addSpine = formatBlockWith({ prefix: '│ ', indent: 2 })
 * addSpine('line1\nline2\nline3')
 * // '│   line1\n│   line2\n│   line3'
 * ```
 */
export const formatBlockWith = Fn.flipCurried(formatBlockOn)
