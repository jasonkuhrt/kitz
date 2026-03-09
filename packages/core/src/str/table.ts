import { Char } from './char/_.js'
import { repeatOn } from './replace.js'

/**
 * Format a key-value object as an aligned table string.
 * @category Formatting
 * @param input - Configuration object
 * @param input.data - Key-value pairs to format as a table
 * @param input.separator - String to separate keys and values (default: ' → ')
 * @param input.separatorAlignment - Whether to align separators (default: true)
 * @returns Formatted table string with aligned columns
 * @example
 * ```typescript
 * table({
 *   data: { name: 'John', age: '25', city: 'NYC' }
 * })
 * // Returns:
 * // name → John
 * // age  → 25
 * // city → NYC
 *
 * table({
 *   data: { foo: 'bar', hello: 'world' },
 *   separator: ' = ',
 *   separatorAlignment: false
 * })
 * // Returns:
 * // foo =   bar
 * // hello = world
 * ```
 */
export const table = (input: {
  data: Record<string, string>
  separator?: string | undefined | false
  separatorAlignment?: boolean
}) => {
  const separator = input.separator ?? ` ${Char.rightwardsArrow} `
  const separatorAlignment = input.separatorAlignment ?? true
  const padding = repeatOn(Char.spaceNoBreak)

  const entries = Object.entries(input.data)
  const keyMaxLength = Math.max(...entries.map(([key]) => key.length))
  return entries
    .map(([key, value]) => {
      const paddingSize = keyMaxLength - key.length

      const gap = separatorAlignment
        ? `${padding(paddingSize)}${separator}`
        : `${separator}${padding(paddingSize)}`

      return `${key}${gap}${value}`
    })
    .join(`\n`)
}

// const isOdd = (value: number) => value % 2 !== 0

// const makeEvenUpward = (value: number) => value + (isOdd(value) ? 1 : 0)
