/**
 * `Tuple` — effect's `Tuple` module, extended (not shadowed) with type-level
 * tuple operators effect does not ship.
 *
 * Re-exports all of `effect/Tuple` and adds `Last` under the same namespace.
 *
 * @example
 * ```ts
 * import { Tuple } from '@kitz/effect'
 *
 * const pair = Tuple.make('a', 'b')
 * type Last = Tuple.Last<readonly ['a', 'b']> // 'b'
 * ```
 *
 * @module
 */
export * as Tuple from './__.js'
