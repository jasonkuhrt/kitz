/**
 * `String` — effect's `String` module, extended (not shadowed) with type-level
 * string operators effect does not ship.
 *
 * Re-exports all of `effect/String` (value-level: `camelCase`, `split`, …) and
 * adds compile-time operators (`Split`, `EndsWith`, `StartsWith`, `AfterLast`,
 * `RemoveTrailing`) and character constants (`ZeroWidthSpace`) under the
 * same namespace. `Split` follows `String.prototype.split` except for an empty
 * delimiter on astral characters, where TypeScript's type level splits by code
 * point because generic UTF-16 code-unit parity is not expressible.
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
export * as String from './__.js'
