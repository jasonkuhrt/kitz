/**
 * `String` — effect's `String` module, extended (not shadowed) with type-level
 * string operators effect does not ship.
 *
 * Re-exports all of `effect/String` (value-level: `camelCase`, `split`, …) and
 * adds compile-time operators (`Split`, `EndsWith`, `StartsWith`, `LastSegment`,
 * `RemoveTrailingSlash`) under the same namespace.
 *
 * @example
 * ```ts
 * import { String } from '@kitz/effect'
 *
 * String.camelCase('foo-bar')          // effect's value-level helper
 * type Parts = String.Split<'a/b/c', '/'>  // kitz's type-level operator → ['a','b','c']
 * ```
 *
 * @module
 */
export * from 'effect/String'
export type * from './types.js'
