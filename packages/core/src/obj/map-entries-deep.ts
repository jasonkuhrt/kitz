/**
 * A deep object value can be any JSON-serializable value including nested objects and arrays.
 */
export type DeepObjectValue = string | boolean | null | number | DeepObject | DeepObjectValue[]

/**
 * A deep object is a plain object with string keys and deep object values.
 */
export type DeepObject = { [key: string]: DeepObjectValue }

/**
 * Recursively traverse nested object structures and transform key-value pairs (entries).
 *
 * Performs **top-down traversal**: The visitor function is called for each object entry BEFORE
 * recursing into the value's children. This allows transforming both keys and values while
 * maintaining consistent traversal semantics with {@link mapValuesDeep}.
 *
 * ## Visitor Pattern
 *
 * The visitor receives both the key and value for each object entry:
 * - **Return `undefined`**: Keep the entry unchanged and recurse into the value's children
 * - **Return `{key, value}`**: Replace the entry and recurse into the NEW value's children
 *
 * **Note**: Unlike {@link mapValuesDeep}, this function does NOT support early exit.
 * The visitor result is always recursed into, whether it's the original or transformed value.
 *
 * ## Features
 *
 * - **Key transformations**: Rename object keys throughout nested structures
 * - **Value transformations**: Transform values based on their keys
 * - **Combined transformations**: Change both key and value simultaneously
 * - **Circular reference safe**: Automatically detects and marks circular references as `'[Circular]'`
 * - **Type preservation**: Maintains array and object structures during traversal
 *
 * ## Common Use Cases
 *
 * - Normalizing key naming conventions (e.g., stripping prefixes, camelCase conversion)
 * - Transforming values based on key patterns
 * - Sanitizing or filtering object properties recursively
 * - Renaming keys while preserving nested structure
 *
 * ## Comparison with mapValuesDeep
 *
 * Use **mapEntriesDeep** when you need to:
 * - Transform object keys
 * - Access both key and value in the visitor
 * - Transform entries at the object level
 *
 * Use **{@link mapValuesDeep}** when you need to:
 * - Only transform values (keys unchanged)
 * - Early exit optimization (stop recursing after match)
 * - Transform any value type (not just object entries)
 *
 * @category Transformation
 *
 * @param value - The value to traverse (can be primitive, object, or array)
 * @param visitor - Function called for each object entry.
 *                  Return `undefined` to keep unchanged, or `{key, value}` to transform.
 * @returns A new structure with entry transformations applied
 *
 * @example
 * **Key normalization** - Strip prefix from keys:
 * ```typescript
 * const data = {
 *   $name: 'Alice',
 *   $age: 30,
 *   $address: {
 *     $city: 'NYC',
 *     $zip: '10001'
 *   }
 * }
 *
 * mapEntriesDeep(data, (key, value) =>
 *   key.startsWith('$') ? { key: key.slice(1), value } : undefined
 * )
 * // { name: 'Alice', age: 30, address: { city: 'NYC', zip: '10001' } }
 * ```
 *
 * @example
 * **Value transformation** - Uppercase all string values:
 * ```typescript
 * const data = {
 *   name: 'alice',
 *   location: {
 *     city: 'nyc',
 *     country: 'usa'
 *   }
 * }
 *
 * mapEntriesDeep(data, (key, value) =>
 *   typeof value === 'string' ? { key, value: value.toUpperCase() } : undefined
 * )
 * // { name: 'ALICE', location: { city: 'NYC', country: 'USA' } }
 * ```
 *
 * @example
 * **Combined transformation** - Strip prefix AND uppercase string values:
 * ```typescript
 * mapEntriesDeep(data, (key, value) => {
 *   if (key.startsWith('$')) {
 *     const newKey = key.slice(1)
 *     const newValue = typeof value === 'string' ? value.toUpperCase() : value
 *     return { key: newKey, value: newValue }
 *   }
 * })
 * ```
 *
 * @example
 * **Selective transformation** - Only transform specific keys:
 * ```typescript
 * mapEntriesDeep(data, (key, value) => {
 *   if (key === 'password' || key === 'apiKey') {
 *     return { key, value: '[REDACTED]' }
 *   }
 * })
 * ```
 *
 * @example
 * **Works with arrays** - Transforms entries in nested arrays:
 * ```typescript
 * const users = [
 *   { $id: 1, $name: 'Alice' },
 *   { $id: 2, $name: 'Bob' }
 * ]
 *
 * mapEntriesDeep(users, (key, value) =>
 *   key.startsWith('$') ? { key: key.slice(1), value } : undefined
 * )
 * // [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
 * ```
 */
export const mapEntriesDeep = <$value extends DeepObjectValue>(
  value: $value,
  visitor: (
    key: string,
    value: DeepObjectValue,
  ) => undefined | { key: string; value: DeepObjectValue },
): $value => {
  const impl = (val: any, visited = new WeakSet()): any => {
    if (Array.isArray(val)) {
      return val.map((item) => impl(item, visited))
    }

    // Only process plain objects, not Date, RegExp, Error, etc.
    if (typeof val === 'object' && val !== null && val.constructor === Object) {
      // Circular reference guard
      if (visited.has(val)) return '[Circular]'
      visited.add(val)

      const newObject: DeepObject = {}
      for (const currentKey in val) {
        const currentValue = val[currentKey]!
        // Visit BEFORE recursing (top-down traversal)
        const visitorResult = visitor(currentKey, currentValue)
        if (visitorResult) {
          // Transform applied - recurse with transformed value
          const recursedValue = impl(visitorResult.value, visited)
          newObject[visitorResult.key] = recursedValue
        } else {
          // No transform - recurse with original value
          const recursedValue = impl(currentValue, visited)
          newObject[currentKey] = recursedValue
        }
      }
      return newObject
    }

    return val
  }

  return impl(value) as $value
}
