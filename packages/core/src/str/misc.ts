import { Case } from './case/_.js'

/** URL path separator regex */
const pathSeparator = /\//g

/**
 * Convert a URL slug to title case.
 * Replaces URL path separators with spaces and converts to title case.
 * @category Transformation
 * @param str - The slug string to convert
 * @returns The title-cased string
 * @example
 * ```typescript
 * titlizeSlug('foo/bar/baz') // 'Foo Bar Baz'
 * titlizeSlug('the/quick/brown/fox') // 'The Quick Brown Fox'
 * titlizeSlug('hello-world') // 'Hello-World' (hyphens are preserved)
 * ```
 */
export const titlizeSlug = (str: string) => {
  return Case.title(str.replace(pathSeparator, ' '))
}

/**
 * Ensure a string ends with a specific ending, adding it if not present.
 * @category Transformation
 * @param string - The string to check
 * @param ending - The ending to ensure
 * @returns The string with the ending ensured
 */
export const ensureEnd = (string: string, ending: string) => {
  if (string.endsWith(ending)) return string
  return string + ending
}
