/**
 * Type guard to check if a value is a string.
 */
export const is = (value: unknown): value is string => {
  return typeof value === `string`
}
