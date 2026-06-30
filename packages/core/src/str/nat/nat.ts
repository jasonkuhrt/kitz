import pluralizeLib from 'pluralize-esm'

// Re-export pluralize-esm functions
export const pluralize = pluralizeLib
export const plural: typeof pluralizeLib.plural = (...args) => pluralizeLib.plural(...args)
export const singular: typeof pluralizeLib.singular = (...args) => pluralizeLib.singular(...args)
export const isPlural: typeof pluralizeLib.isPlural = (...args) => pluralizeLib.isPlural(...args)
export const isSingular: typeof pluralizeLib.isSingular = (...args) =>
  pluralizeLib.isSingular(...args)

/**
 * Format an array as an English list with commas and "or".
 * @category Natural Language
 * @param items - Array of strings to format
 * @returns Formatted list string
 * @example
 * ```typescript
 * list([]) // ''
 * list(['a']) // 'a'
 * list(['a', 'b']) // 'a or b'
 * list(['a', 'b', 'c']) // 'a, b, or c'
 * ```
 */
export const list = (items: string[]): string => {
  if (items.length === 0) return ``
  if (items.length === 1) return items[0] as string
  if (items.length === 2) return `${items[0] as string} or ${items[1] as string}`
  return `${items.slice(0, items.length - 1).join(`, `)}, or ${items[items.length - 1] as string}`
}

/**
 * Convert a number to its ordinal string representation.
 * @category Natural Language
 * @param n - Number to convert
 * @returns Ordinal string (e.g., "1st", "2nd", "3rd", "21st")
 * @example
 * ```typescript
 * ordinal(1) // '1st'
 * ordinal(2) // '2nd'
 * ordinal(3) // '3rd'
 * ordinal(11) // '11th'
 * ordinal(21) // '21st'
 * ordinal(42) // '42nd'
 * ```
 */
export const ordinal = (n: number): string => {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return `${n}st`
  if (j === 2 && k !== 12) return `${n}nd`
  if (j === 3 && k !== 13) return `${n}rd`
  return `${n}th`
}

/**
 * Irregular words that affect "a" vs "an" article choice.
 * Words starting with vowels but taking "a" (e.g., "unicorn", "European").
 * Words starting with consonants but taking "an" (e.g., "hour", "honor").
 */
const irregularWords = new Set([
  // Nouns starting with vowels but taking "a"
  `eunuch`,
  `eucalyptus`,
  `eugenics`,
  `eulogy`,
  `euphemism`,
  `euphony`,
  `euphoria`,
  `eureka`,
  `one`,
  `ouija`,
  `ubiquity`,
  `udometer`,
  `ufo`,
  `uke`,
  `ukelele`,
  `ululate`,
  `unicorn`,
  `unicycle`,
  `uniform`,
  `unify`,
  `union`,
  `unison`,
  `unit`,
  `unity`,
  `universe`,
  `university`,
  `upas`,
  `ural`,
  `uranium`,
  `urea`,
  `ureter`,
  `urethra`,
  `urine`,
  `urologist`,
  `urology`,
  `urus`,
  `usage`,
  `use`,
  `user`,
  `usual`,
  `usurp`,
  `usurper`,
  `usury`,
  `utensil`,
  `uterus`,
  `utility`,
  `utopia`,
  `utricle`,
  `uvarovite`,
  `uvea`,
  `uvula`,
  `utah`,
  `utahn`,
  `yttria`,
  `yggdrasil`,
  `ylem`,
  `yperite`,
  `ytterbia`,
  `ytterbium`,
  `yttrium`,
  // Adjectives starting with vowels but taking "a"
  `euro`,
  `european`,
  `euphemistic`,
  `euphonic`,
  `euphoric`,
  `once`,
  `ubiquitous`,
  `ugandan`,
  `ukrainian`,
  `unanimous`,
  `unicameral`,
  `unified`,
  `unique`,
  `unisex`,
  `universal`,
  `urinal`,
  `urological`,
  `useful`,
  `useless`,
  `usurious`,
  `utilitarian`,
  `utopic`,
  `ytterbous`,
  `ytterbic`,
  `yttric`,
  // Adverbs starting with vowels but taking "a"
  `euphemistically`,
  `euphonically`,
  `euphorically`,
  `ubiquitously`,
  `unanimously`,
  `unicamerally`,
  `uniquely`,
  `universally`,
  `urologically`,
  `usefully`,
  `uselessly`,
  `usuriously`,
  // Nouns starting with consonants but taking "an"
  `heir`,
  `heiress`,
  `herb`,
  `homage`,
  `honesty`,
  `honor`,
  `honour`,
  `honoree`,
  `hour`,
  // Adjectives starting with consonants but taking "an"
  `honest`,
  `honorous`,
  `honorific`,
  `honorable`,
  `honourable`,
  // Adverbs starting with consonants but taking "an"
  `honestly`,
  `hourly`,
])

/**
 * Check if a word is irregular (affects article choice).
 * Tries the word as-is and with common suffixes removed.
 */
const isIrregular = (word: string): boolean => {
  const lower = word.toLowerCase()
  if (irregularWords.has(lower)) return true
  // Try removing common suffixes
  if (lower.endsWith(`s`) && irregularWords.has(lower.slice(0, -1))) return true
  if (lower.endsWith(`es`) && irregularWords.has(lower.slice(0, -2))) return true
  if (lower.endsWith(`ed`) && irregularWords.has(lower.slice(0, -2))) return true
  return false
}

/**
 * Determine the correct indefinite article ("a" or "an") for a word.
 * @category Natural Language
 * @param word - Word to get article for
 * @returns "a" or "an"
 * @example
 * ```typescript
 * article('apple') // 'an'
 * article('banana') // 'a'
 * article('hour') // 'an' (irregular)
 * article('unicorn') // 'a' (irregular)
 * article('university') // 'a' (irregular)
 * ```
 */
export const article = (word: string): `a` | `an` => {
  if (!word) return `a`

  // Extract first word from multi-word strings
  const firstWord = word.split(/\s+/)[0] as string

  // For hyphenated words, check first part
  const checkWord = firstWord.split(`-`)[0] as string

  // Remove possessive
  const cleanWord = checkWord.replace(`'s`, ``)

  const firstChar = cleanWord[0]?.toLowerCase() ?? ``
  const startsWithVowel = [`a`, `e`, `i`, `o`, `u`].includes(firstChar)
  const irregular = isIrregular(cleanWord)

  // XOR logic: vowel XOR irregular
  // Vowel + NOT irregular = "an"
  // Vowel + IS irregular = "a" (e.g., "a unicorn")
  // Consonant + NOT irregular = "a"
  // Consonant + IS irregular = "an" (e.g., "an hour")
  return startsWithVowel !== irregular ? `an` : `a`
}
