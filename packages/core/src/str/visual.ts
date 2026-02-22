import { CoreFn as Fn } from '#fn/core'
import ansis from 'ansis'
import { Char } from './char/_.js'
import { defaultPadCharacter, lines, unlines } from './text.js'
import { pad as strPad } from './text.js'

/**
 * Visual-aware string utilities that handle ANSI escape codes and grapheme clusters.
 *
 * These functions calculate string length and perform operations based on visual appearance,
 * not raw character count. They strip ANSI escape codes before measuring and correctly count
 * grapheme clusters (emojis, combining characters, etc.) as single units.
 *
 * @category Text Formatting
 *
 * @example
 * ```typescript
 * import { Str } from '@wollybeard/kit'
 *
 * // Regular length vs visual length
 * const colored = '\x1b[31mred\x1b[0m'  // ANSI codes for red text
 * colored.length                          // 13 (includes escape codes)
 * Str.Visual.length(colored)             // 3 (just "red")
 *
 * // Grapheme cluster counting
 * Str.Visual.length('👨‍👩‍👧‍👦')              // 1 (family emoji is one cluster)
 * Str.Visual.length('é')                 // 1 (combining accent)
 *
 * // Visual-aware padding
 * Str.Visual.pad('\x1b[32mOK\x1b[0m', 3, 'left')  // Pads to visual width 5
 * ```
 */

/**
 * Shared segmenter instance for grapheme cluster counting.
 *
 * Uses explicit 'en-US' locale to ensure consistent behavior across environments.
 * Different Node.js versions have different ICU data, causing Intl.Segmenter
 * to produce different results when no locale is specified. This caused issue #41
 * where table column widths differed between local (Node 22.x) and CI (Node 24.x).
 *
 * @internal
 */
const segmenter = new Intl.Segmenter('en-US', { granularity: 'grapheme' })

/**
 * Remove all ANSI escape codes from text.
 *
 * Strips color codes, styles, cursor movements, and other escape sequences,
 * leaving only the raw visible text.
 *
 * @category Text Formatting
 * @param text - Text containing ANSI codes
 * @returns Text with all ANSI codes removed
 *
 * @example
 * ```typescript
 * const colored = '\x1b[31mred\x1b[0m text'
 * Str.Visual.strip(colored)  // 'red text'
 *
 * Str.Visual.strip('plain text')  // 'plain text' (unchanged)
 * ```
 */
export const strip = ansis.strip

/**
 * Get the visual width of a string, ignoring ANSI escape codes and counting grapheme clusters.
 *
 * This is the "true" visual width as it would appear in a terminal:
 * - ANSI escape codes (colors, styles) are stripped before counting
 * - Grapheme clusters (emojis, combining characters) count as single units
 *
 * @category Text Formatting
 * @param text - The text to measure
 * @returns The visual width of the text
 *
 * @example
 * ```typescript
 * // ANSI codes are stripped
 * Str.Visual.width('\x1b[31mred\x1b[0m')  // 3
 *
 * // Grapheme clusters count as 1
 * Str.Visual.width('👨‍👩‍👧‍👦')              // 1 (family emoji)
 * Str.Visual.width('é')                   // 1 (e + combining accent)
 * Str.Visual.width('🇺🇸')                  // 1 (flag emoji)
 *
 * // Empty string
 * Str.Visual.width('')                    // 0
 * Str.Visual.width('\x1b[31m\x1b[0m')     // 0 (only ANSI codes)
 * ```
 */
export const width = (text: string): number => {
  const stripped = strip(text)
  if (stripped === ``) return 0
  let count = 0
  for (const _ of segmenter.segment(stripped)) {
    count++
  }
  return count
}

/**
 * Add padding to text, calculated based on visual length.
 *
 * The padding size is adjusted to account for ANSI escape codes, so the final
 * output has the desired visual width.
 *
 * @category Text Formatting
 * @param text - The text to pad
 * @param size - Target visual size (including text)
 * @param side - Which side to add padding ('left' or 'right')
 * @param char - Character to use for padding (default: space)
 * @returns The padded text (or original if already wider than size)
 *
 * @example
 * ```typescript
 * // Regular text
 * Str.Visual.pad('hi', 5, 'right')  // 'hi   ' (visual width 5)
 *
 * // With ANSI codes - padding accounts for escape codes
 * const colored = '\x1b[31mOK\x1b[0m'
 * Str.Visual.pad(colored, 5, 'right')  // Adds 3 spaces (visual: "OK   ")
 *
 * // Text already wider than target size
 * Str.Visual.pad('hello', 3, 'left')  // 'hello' (unchanged)
 * ```
 */
export const pad = (
  text: string,
  size: number,
  side: `left` | `right` = `left`,
  char: string = defaultPadCharacter,
): string => {
  const padSize = size - width(text)
  if (padSize <= 0) return text
  return side === `left` ? char.repeat(padSize) + text : text + char.repeat(padSize)
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
 * @param size - Target visual size
 * @returns Function that takes text, side, and char
 *
 * @example
 * ```typescript
 * const pad10 = Str.Visual.padWith(10)
 * pad10('\x1b[32mSuccess\x1b[0m', 'right')  // Visual width 10
 * ```
 */
export const padWith = Fn.flipCurried(padOn)

/**
 * Align text within a specified visual width by adding padding.
 *
 * This ensures text spans exactly the target width, aligning content to the left or right.
 * If the text is already wider than the target width, no padding is added.
 *
 * @category Text Formatting
 * @param text - The text to align
 * @param width - Target visual width
 * @param align - Content alignment ('left' or 'right')
 * @param char - Character to use for padding (default: space)
 * @returns The aligned text
 *
 * @example
 * ```typescript
 * // Left-align (pad right)
 * Str.Visual.span('hi', 5, 'left')     // 'hi   '
 *
 * // Right-align (pad left)
 * Str.Visual.span('hi', 5, 'right')    // '   hi'
 *
 * // With ANSI codes
 * const colored = '\x1b[34mID\x1b[0m'
 * Str.Visual.span(colored, 6, 'left')  // Visual: "ID    "
 * ```
 */
export const span = (
  text: string,
  width: number,
  align: `left` | `right` = `left`,
  char: string = defaultPadCharacter,
): string => {
  return pad(text, width, align === `left` ? `right` : `left`, char)
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
 * @param width - Target visual width
 * @returns Function that takes text, align, and char
 *
 * @example
 * ```typescript
 * const span8 = Str.Visual.spanWith(8)
 * span8('Name', 'left')   // 'Name    '
 * span8('Age', 'right')   // '     Age'
 * ```
 */
export const spanWith = Fn.flipCurried(spanOn)

/**
 * Center text within a specified visual width by adding padding on both sides.
 *
 * If the total padding is odd, the extra character goes on the right side.
 * If the text is already wider than the target width, it is returned unchanged.
 *
 * @category Text Formatting
 * @param text - The text to center
 * @param targetWidth - Target visual width
 * @param char - Character to use for padding (default: space)
 * @returns The centered text
 *
 * @example
 * ```typescript
 * // Basic centering
 * Str.Visual.center('hi', 6)       // '  hi  '
 * Str.Visual.center('hello', 9)    // '  hello  '
 *
 * // Odd padding - extra char on right
 * Str.Visual.center('hi', 5)       // ' hi  '
 *
 * // Text already at or exceeds width
 * Str.Visual.center('hello', 5)    // 'hello'
 * Str.Visual.center('hello', 3)    // 'hello'
 *
 * // With ANSI codes
 * const colored = '\x1b[32mOK\x1b[0m'
 * Str.Visual.center(colored, 6)    // Visual: "  OK  "
 *
 * // Custom padding character
 * Str.Visual.center('hi', 6, '-')  // '--hi--'
 * ```
 */
export const center = (
  text: string,
  targetWidth: number,
  char: string = defaultPadCharacter,
): string => {
  const textWidth = width(text)
  const totalPadding = targetWidth - textWidth
  if (totalPadding <= 0) return text
  const leftPadding = Math.floor(totalPadding / 2)
  const rightPadding = totalPadding - leftPadding
  return char.repeat(leftPadding) + text + char.repeat(rightPadding)
}

/**
 * Curried version of {@link center} with text first.
 * @category Text Formatting
 * @param text - The text to center
 * @returns Function that takes targetWidth and char
 */
export const centerOn = Fn.curry(center)

/**
 * Curried version of {@link center} with targetWidth first.
 * @category Text Formatting
 * @param targetWidth - Target visual width
 * @returns Function that takes text and char
 *
 * @example
 * ```typescript
 * const center10 = Str.Visual.centerWith(10)
 * center10('hi')      // '    hi    '
 * center10('hello')   // '  hello   '
 * ```
 */
export const centerWith = Fn.flipCurried(centerOn)

/**
 * Constrain text to exact visual width by cropping and/or padding.
 *
 * Unlike {@link span} which only pads (leaving text unchanged if too long),
 * this function guarantees the exact width by:
 * - Cropping text if it exceeds the target width
 * - Padding text if it's shorter than the target width
 *
 * This is useful for fixed-width layouts where column widths must be exact,
 * such as table columns, status bars, and terminal UIs.
 *
 * @category Text Formatting
 * @param text - The text to constrain
 * @param width - Exact target visual width
 * @param align - Content alignment ('left' or 'right')
 * @param char - Character to use for padding (default: space)
 * @returns Text constrained to exact width
 *
 * @example
 * ```typescript
 * // Text too long - gets cropped
 * Str.Visual.fit('hello world', 5, 'left')  // 'hello'
 *
 * // Text too short - gets padded
 * Str.Visual.fit('hi', 5, 'left')           // 'hi   '
 * Str.Visual.fit('hi', 5, 'right')          // '   hi'
 *
 * // Perfect fit - unchanged
 * Str.Visual.fit('exact', 5, 'left')        // 'exact'
 *
 * // With ANSI codes
 * const colored = '\x1b[31mvery long colored text\x1b[0m'
 * Str.Visual.fit(colored, 8, 'left')        // '\x1b[31mvery lon\x1b[0m' (visual: "very lon")
 *
 * // Use case: Fixed-width table columns
 * const columns = ['Name', 'Email', 'Status'].map(
 *   (header, i) => Str.Visual.fit(header, [10, 20, 8][i], 'left')
 * )
 * // ['Name      ', 'Email               ', 'Status  ']
 * ```
 */
export const fit = (
  text: string,
  width: number,
  align: `left` | `right` = `left`,
  char: string = defaultPadCharacter,
): string => {
  const cropped = take(text, width)
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
 * @param width - Exact target visual width
 * @returns Function that takes text, align, and char
 *
 * @example
 * ```typescript
 * // Create fixed-width formatters
 * const nameColumn = Str.Visual.fitWith(20)
 * const statusColumn = Str.Visual.fitWith(10)
 *
 * nameColumn('John Doe', 'left')         // 'John Doe            '
 * statusColumn('Active', 'left')         // 'Active    '
 * statusColumn('Very Long Status', 'left') // 'Very Long '
 * ```
 */
export const fitWith = Fn.flipCurried(fitOn)

/**
 * Take a substring by visual length.
 *
 * Extracts characters from the start of the string up to the specified visual width.
 * Accounts for ANSI codes and grapheme clusters, so the result has the desired visual length.
 *
 * @category Text Formatting
 * @param text - The text to extract from
 * @param size - Visual length to take
 * @returns The extracted substring
 *
 * @example
 * ```typescript
 * // Regular text
 * Str.Visual.take('hello', 3)  // 'hel'
 *
 * // With ANSI codes
 * const colored = '\x1b[31mhello\x1b[0m world'
 * Str.Visual.take(colored, 5)  // '\x1b[31mhello\x1b[0m' (visual: "hello")
 *
 * // With emoji
 * Str.Visual.take('👋 hello', 2)  // '👋 ' (emoji + space)
 * ```
 */
export const take = (text: string, size: number): string => {
  let taken = text.slice(0, size)
  let i = 0
  while (width(taken) < size) {
    if (taken.length === text.length) break
    i++
    taken = text.slice(0, size + i)
  }
  return taken
}

/**
 * Curried version of {@link take} with text first.
 * @category Text Formatting
 * @param text - The text to extract from
 * @returns Function that takes size
 */
export const takeOn = Fn.curry(take)

/**
 * Curried version of {@link take} with size first.
 * @category Text Formatting
 * @param size - Visual length to take
 * @returns Function that takes text
 *
 * @example
 * ```typescript
 * const take10 = Str.Visual.takeWith(10)
 * take10('a long string here')  // First 10 visual chars
 * ```
 */
export const takeWith = Fn.flipCurried(takeOn)

/**
 * Split text into words by visual length, respecting word boundaries.
 *
 * Extracts words from the start of the string until reaching the visual width limit.
 * Avoids breaking words mid-way when possible (though single words longer than size
 * will be taken anyway).
 *
 * @category Text Formatting
 * @param text - The text to split
 * @param size - Maximum visual length
 * @returns Object with `taken` words and `remaining` text
 *
 * @example
 * ```typescript
 * // Splits at word boundaries
 * Str.Visual.takeWords('hello world here', 12)
 * // { taken: 'hello world', remaining: 'here' }
 *
 * // Single word too long - takes it anyway
 * Str.Visual.takeWords('verylongword more', 8)
 * // { taken: 'verylongword', remaining: 'more' }
 *
 * // With ANSI codes
 * const colored = '\x1b[32mone\x1b[0m two three'
 * Str.Visual.takeWords(colored, 7)
 * // { taken: '\x1b[32mone\x1b[0m two', remaining: 'three' }
 * ```
 */
export const takeWords = (text: string, size: number): { taken: string; remaining: string } => {
  const words = splitWords(text)
  let taken = ``

  while (true) {
    // There are no words (empty string)
    if (words.length === 0) {
      break
    }
    const word = String(words[0])

    // single word is too long for asked take
    if (width(word) > size) {
      // TODO hyphen the word?
      words.shift()
      taken += String(word)
      break
    }

    // Cannot take any more, taking another word would exceed limit:
    const nextString = taken ? `${taken} ${word}` : word
    if (width(nextString) > size) {
      break
    }

    words.shift()
    taken += (taken.length ? ` ` : ``) + word
  }

  const remaining = joinWords(words)

  return {
    taken,
    remaining,
  }
}

/**
 * Curried version of {@link takeWords} with text first.
 * @category Text Formatting
 * @param text - The text to split
 * @returns Function that takes size
 */
export const takeWordsOn = Fn.curry(takeWords)

/**
 * Curried version of {@link takeWords} with size first.
 * @category Text Formatting
 * @param size - Maximum visual length
 * @returns Function that takes text
 *
 * @example
 * ```typescript
 * const take20 = Str.Visual.takeWordsWith(20)
 * take20('Lorem ipsum dolor sit amet')
 * // { taken: 'Lorem ipsum dolor', remaining: 'sit amet' }
 * ```
 */
export const takeWordsWith = Fn.flipCurried(takeWordsOn)

/**
 * Configuration for text wrapping behavior.
 * @category Text Formatting
 */
export interface WrapConfig {
  /**
   * Strategy for handling long words that exceed the max width.
   *
   * - `'word-overflow'` (default) - Keep whole words intact even if they exceed width
   * - `'break-word'` - Break long words at width boundary without hyphen
   * - `'break-word-hyphen-in'` - Break with hyphen counting toward width (e.g., 7 chars + `-` for width 8)
   * - `'break-word-hyphen-out'` - Break with hyphen not counting toward width (e.g., 8 chars + `-`)
   *
   * @default 'word-overflow'
   */
  strategy?: 'word-overflow' | 'break-word' | 'break-word-hyphen-in' | 'break-word-hyphen-out'
}

/**
 * Wrap text to fit within visual width, respecting word boundaries.
 *
 * Breaks text into lines that fit the specified visual width. Respects existing
 * newlines in the input and breaks long lines at word boundaries when possible.
 *
 * @category Text Formatting
 * @param text - Text to wrap (may contain existing newlines)
 * @param maxWidth - Maximum visual width per line
 * @param config - Optional wrapping configuration
 * @returns Array of wrapped lines
 *
 * @example
 * ```typescript
 * // Basic wrapping
 * Str.Visual.wrap('hello world here', 10)
 * // ['hello', 'world here']
 *
 * // Long word handling (default: word-overflow)
 * Str.Visual.wrap('verylongword more', 8)
 * // ['verylongword', 'more']  // Keeps long word intact
 *
 * // Break long words without hyphen
 * Str.Visual.wrap('verylongword more', 8, { strategy: 'break-word' })
 * // ['verylong', 'word', 'more']
 *
 * // Break with hyphen counting toward width
 * Str.Visual.wrap('verylongword more', 8, { strategy: 'break-word-hyphen-in' })
 * // ['verylon-', 'gword', 'more']
 *
 * // Respects existing newlines
 * Str.Visual.wrap('line one\nline two is long', 10)
 * // ['line one', 'line two', 'is long']
 *
 * // With ANSI codes - visual width accounts for escape codes
 * const colored = '\x1b[31mthis is red text\x1b[0m and normal'
 * Str.Visual.wrap(colored, 12)
 * // ['\x1b[31mthis is red\x1b[0m', 'text and', 'normal']
 * ```
 */
export const wrap = (text: string, maxWidth: number, config: WrapConfig = {}): string[] => {
  const strategy = config.strategy ?? 'word-overflow'

  // Edge case: maxWidth 0 - return empty string if text is non-empty
  if (maxWidth === 0) {
    const stripped = strip(text).trim()
    return stripped.length > 0 ? [''] : []
  }

  // Edge case: maxWidth 1
  if (maxWidth === 1) {
    // With hyphen-in strategy, can't fit even a single char + hyphen
    if (strategy === 'break-word-hyphen-in') {
      const stripped = strip(text).trim()
      return stripped.length > 0 ? [''] : []
    }

    // For other strategies, break into individual grapheme clusters (no whitespace)
    const allText = lines(text).join('') // Flatten existing newlines
    const stripped = strip(allText) // Remove ANSI codes
    const noSpaces = stripped.replace(/\s+/g, '') // Remove all whitespace

    if (noSpaces === '') return []

    // Break into individual grapheme clusters
    const chars: string[] = []
    for (const segment of segmenter.segment(noSpaces)) {
      chars.push(segment.segment)
    }

    // For hyphen-out strategy, add hyphen to all except last
    if (strategy === 'break-word-hyphen-out') {
      return chars.map((char, i) => i < chars.length - 1 ? `${char}-` : char)
    }

    return chars
  }

  const textLines = lines(text)
  const linesFitted = textLines.flatMap((text) => {
    const fittedLines: string[] = []
    let textToConsume = text
    while (textToConsume.length > 0) {
      const result = takeWords(textToConsume, maxWidth)

      // Handle oversized words based on strategy
      if (width(result.taken) > maxWidth) {
        if (strategy === 'word-overflow') {
          // Keep the word intact even if it exceeds width
          const resultLines = lines(result.taken.replace(/\n$/, ``))
          fittedLines.push(...resultLines)
        } else if (strategy === 'break-word') {
          // Break word at width boundary without hyphen
          let remaining = result.taken
          while (remaining.length > 0) {
            const chunk = take(remaining, maxWidth)
            fittedLines.push(chunk)
            remaining = remaining.slice(chunk.length)
          }
        } else if (strategy === 'break-word-hyphen-in') {
          // Break with hyphen counting toward width (take width-1 chars + hyphen)
          // TODO: Coordinate with existing hyphens in words for natural break points
          let remaining = result.taken
          while (remaining.length > 0) {
            if (width(remaining) <= maxWidth) {
              // Last chunk fits without breaking
              fittedLines.push(remaining)
              break
            }
            const chunk = take(remaining, maxWidth - 1) // Reserve 1 for hyphen
            fittedLines.push(chunk + '-')
            remaining = remaining.slice(chunk.length)
          }
        } else if (strategy === 'break-word-hyphen-out') {
          // Break with hyphen not counting toward width (take width chars + hyphen)
          // TODO: Coordinate with existing hyphens in words for natural break points
          let remaining = result.taken
          while (remaining.length > 0) {
            if (width(remaining) <= maxWidth) {
              // Last chunk fits without breaking
              fittedLines.push(remaining)
              break
            }
            const chunk = take(remaining, maxWidth)
            fittedLines.push(chunk + '-')
            remaining = remaining.slice(chunk.length)
          }
        }
      } else {
        const resultLines = lines(result.taken.replace(/\n$/, ``))
        fittedLines.push(...resultLines)
      }

      textToConsume = result.remaining
    }
    return fittedLines
  })

  return linesFitted
}

/**
 * Curried version of {@link wrap} with text first.
 * @category Text Formatting
 * @param text - Text to wrap
 * @returns Function that takes width
 */
export const wrapOn = Fn.curry(wrap)

/**
 * Curried version of {@link wrap} with width first.
 * @category Text Formatting
 * @param width - Maximum visual width per line
 * @returns Function that takes text
 *
 * @example
 * ```typescript
 * const wrap80 = Str.Visual.wrapWith(80)
 * wrap80('long text here...')  // Wraps to 80 columns
 * ```
 */
export const wrapWith = Fn.flipCurried(wrapOn)

/**
 * Get the visual size (dimensions) of text.
 *
 * Returns the maximum visual width (longest line) and height (line count).
 * Accounts for ANSI codes and grapheme clusters.
 *
 * @category Text Formatting
 * @param text - The text to measure
 * @returns Object with `maxWidth` and `height` properties
 *
 * @example
 * ```typescript
 * Str.Visual.size('hello\nworld')
 * // { maxWidth: 5, height: 2 }
 *
 * // With ANSI codes
 * const colored = '\x1b[31mred\x1b[0m\n\x1b[32mgreen!\x1b[0m'
 * Str.Visual.size(colored)
 * // { maxWidth: 6, height: 2 } (visual: "red" and "green!")
 *
 * // Empty string
 * Str.Visual.size('')
 * // { maxWidth: 0, height: 0 }
 * ```
 */
export const size = (text: string): { maxWidth: number; height: number } => {
  const textLines = lines(text)
  const maxWidth = textLines.length === 0 ? 0 : Math.max(...textLines.map(width))
  const height = textLines.length
  return {
    maxWidth,
    height,
  }
}

/**
 * Get the maximum visual width of text (longest line).
 *
 * Convenience function that returns just the width from {@link size}.
 * Useful when you only need width and not height.
 *
 * @category Text Formatting
 * @param text - The text to measure
 * @returns The maximum visual width across all lines
 *
 * @example
 * ```typescript
 * Str.Visual.maxWidth('short\nlonger line\nhi')  // 11
 *
 * // With ANSI codes
 * Str.Visual.maxWidth('\x1b[31mred\x1b[0m\n\x1b[32mgreen\x1b[0m')  // 5
 * ```
 */
export const maxWidth = (text: string): number => {
  return Math.max(...lines(text).map(width))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Internal Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Join words back into text, preserving newlines.
 * @internal
 */
const joinWords = (words: string[]): string => {
  return words.reduce((text, word, i) => {
    return i === 0 ? word : text + (text[text.length - 1] === Char.newline ? `` : ` `) + word
  }, ``)
}

/**
 * Split text into words, preserving newlines within words.
 * @internal
 */
const splitWords = (text: string): string[] => {
  const words = []
  let currentWord = ``
  let currentWordReady = false
  for (const char of text.split(``)) {
    if (char === Char.spaceRegular && currentWordReady) {
      words.push(currentWord)
      // If the next word is on a new line then do not disregard the leading space
      currentWord = currentWord[currentWord.length - 1] === Char.newline ? ` ` : ``
      currentWordReady = false
      continue
    }

    if (char !== Char.spaceRegular) {
      currentWordReady = true
    }

    currentWord += char
  }

  if (currentWord.length > 0) {
    words.push(currentWord)
  }
  return words
}

// @ts-expect-error Duplicate identifier
export * as Table from './visual-table.js'
/**
 * Visual-aware table operations for multi-column text layout.
 *
 * @category Text Formatting
 */
export namespace Table {}
