/**
 * `String` — effect's `String` module, extended (not shadowed) with type-level
 * string operators effect does not ship.
 *
 * Re-exports all of `effect/String` (value-level: `camelCase`, `split`, …) and
 * adds compile-time operators (`Split`, `EndsWith`, `StartsWith`, `AfterLast`,
 * `RemoveTrailing`) and character constants (`ZeroWidthSpace`) under the
 * same namespace.
 *
 * @example
 * ```ts
 * import { String } from '@kitz/effect'
 *
 * String.camelCase('foo-bar')          // effect's value-level helper
 * type Parts = String.Split<'a//b', '/'> // kitz type operator → ['a', '', 'b']
 * ```
 *
 * @module
 */
export * from 'effect/String'
export * from './chars.js'
export type * from './types.js'
