/**
 * `Types` — effect's `Types` module, extended (not shadowed) with type-level
 * utilities effect does not ship.
 *
 * Re-exports all of `effect/Types` (`Simplify`, `Equals`, `Tags`, …) and adds
 * kitz operators (`Last`, `StaticError`) under the same namespace.
 *
 * @example
 * ```ts
 * import { Types } from '@kitz/effect'
 *
 * type Flat = Types.Simplify<A & B>                  // effect's utility
 * type Tail = Types.Last<readonly ['a', 'b']>        // 'b'
 * type Err = Types.StaticError<'message shown inline'> // kitz's branded error message
 * ```
 *
 * @module
 */
export * as Types from './__.js'
