/**
 * Recursively traverse and transform values in nested data structures with early exit optimization.
 *
 * Performs **top-down traversal**: The visitor function is called for each value BEFORE recursing
 * into its children. This enables the visitor to transform a value and prevent further recursion,
 * which is useful for replacing complex objects with primitives or handling special types.
 *
 * ## Early Exit Pattern
 *
 * The visitor function controls recursion through its return value:
 * - **Return `undefined`**: Continue recursing into the original value's children
 * - **Return any other value**: Use as replacement and STOP recursing into that branch
 *
 * ## Features
 *
 * - **Handles all structures**: Works with primitives, objects, arrays, and nested combinations
 * - **Circular reference safe**: Automatically detects and marks circular references as `'[Circular]'`
 * - **Type preservation**: Maintains array and object structures during traversal
 * - **Performance**: Early exit allows stopping recursion when a match is found
 *
 * ## Common Use Cases
 *
 * - Encoding schema instances to primitives (e.g., for snapshots)
 * - Replacing Error objects with error messages
 * - Sanitizing sensitive data in nested structures
 * - Truncating or formatting string values deeply
 * - Converting special objects to JSON-serializable forms
 *
 * @category Transformation
 *
 * @param value - Any value to traverse (primitive, object, or array)
 * @param visitor - Transformation function called for each value.
 *                  Return `undefined` to continue recursing, or any other value to replace and stop.
 * @returns Transformed structure with visitor transformations applied
 *
 * @example
 * **Schema encoding** - Transform schema instances to encoded primitives:
 * ```typescript
 * import { Schema as S } from 'effect'
 *
 * mapValuesDeep(testData, (v) => {
 *   for (const schema of [FsLoc.FsLoc, User.User]) {
 *     if (S.is(schema)(v)) {
 *       return S.encodeSync(schema)(v)  // Replace and stop recursing
 *     }
 *   }
 *   // Return undefined to continue into children
 * })
 * // Before: { location: FsLocInstance { ... } }
 * // After:  { location: './src/index.ts' }
 * ```
 *
 * @example
 * **Error sanitization** - Replace Error objects with messages:
 * ```typescript
 * const data = {
 *   result: 'success',
 *   errors: [new Error('Failed'), new Error('Timeout')],
 *   nested: { err: new Error('Deep error') }
 * }
 *
 * mapValuesDeep(data, (v) => {
 *   if (v instanceof Error) return v.message
 * })
 * // { result: 'success', errors: ['Failed', 'Timeout'], nested: { err: 'Deep error' } }
 * ```
 *
 * @example
 * **String truncation** - Limit string lengths throughout a structure:
 * ```typescript
 * mapValuesDeep(data, (v) => {
 *   if (typeof v === 'string' && v.length > 100) {
 *     return v.slice(0, 100) + '...'
 *   }
 * })
 * ```
 *
 * @example
 * **Conditional replacement** - Replace specific objects entirely:
 * ```typescript
 * mapValuesDeep(data, (v) => {
 *   // Replace Buffer objects with their base64 representation
 *   if (Buffer.isBuffer(v)) {
 *     return v.toString('base64')
 *   }
 * })
 * ```
 */
export const mapValuesDeep = (
  value: any,
  visitor: (value: any) => unknown,
  visited = new WeakSet(),
): any => {
  // Primitives pass through
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value

  // Circular reference guard
  if (visited.has(value)) return '[Circular]'
  visited.add(value)

  // Visit BEFORE recursing (allows early exit)
  const transformed = visitor(value)
  if (transformed !== undefined) {
    return transformed // Stop recursing
  }

  // No transformation - recurse into structure
  if (Array.isArray(value)) {
    return value.map((item) => mapValuesDeep(item, visitor, visited))
  }

  // Any object - recurse into all properties
  const result: any = {}
  for (const [key, val] of Object.entries(value)) {
    result[key] = mapValuesDeep(val, visitor, visited)
  }
  return result
}
