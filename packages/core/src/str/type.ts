/**
 * Type guard to check if a string is empty.
 * @category Type Guards
 * @deprecated Use {@link String.isEmpty} from Effect instead
 * @param value - The string to check
 * @returns True if the string is empty
 * @example
 * ```typescript
 * isEmpty('') // true
 * isEmpty('hello') // false
 * isEmpty(' ') // false
 * ```
 */
export const isEmpty = (value: string): value is '' => value.length === 0

/**
 * Type for an empty string.
 * @category Type Utilities
 */
export type Empty = ''

/**
 * Empty string constant.
 * @category Constants
 * @example
 * ```typescript
 * const result = someCondition ? 'hello' : Empty
 * ```
 */
export const Empty: Empty = ''
