import type { Fn } from '#fn'
import { type Num } from '#num'
import type { Ts } from '#ts'
import type { GetPreservedTypes } from './global-settings.ts'
import type * as Union from './union.js'

/**
 * Simplify a type to a specific depth.
 *
 * Recursively flattens intersections and mapped types while preserving:
 * - Error types ({@link Ts.Err.StaticError})
 * - Built-in primitives (Date, Error, RegExp, Function)
 * - Globally registered types ({@link KITZ.Ts.PreserveTypes})
 *
 * Includes circular reference detection to prevent infinite recursion.
 * Traverses into generic containers (Array, Map, Set, Promise, etc.).
 * Supports custom traversal via {@link KITZ.Simplify.Traversables}.
 *
 * @template $DepthRemaining - How many levels deep to simplify (use -1 for infinite)
 * @template $T - The type to simplify
 * @template $Seen - Internal accumulator for circular reference detection
 *
 * @example
 * ```typescript
 * // Depth 1 - flatten one level
 * type One = Simplify.To<1, { a: 1 } & { b: { c: 2 } & { d: 3 } }>
 * // { a: 1; b: { c: 2 } & { d: 3 } } - inner not flattened
 *
 * // Depth 2 - flatten two levels
 * type Two = Simplify.To<2, { a: 1 } & { b: { c: 2 } & { d: 3 } }>
 * // { a: 1; b: { c: 2; d: 3 } } - all levels flattened
 *
 * // Infinite depth
 * type All = Simplify.To<-1, DeepType>
 * // Flattens all levels
 *
 * // Preserves built-ins
 * type WithDate = Simplify.To<-1, { created: Date }>
 * // { created: Date } - Date not expanded
 *
 * // Traverses containers
 * type Container = Simplify.To<-1, Map<{ a: 1 } & { b: 2 }, string>>
 * // Map<{ a: 1; b: 2 }, string>
 * ```
 *
 * @category Type Simplification
 */
// oxfmt-ignore
export type To<
  $DepthRemaining extends Num.Literal,
  $T,
  $Seen = never,
  DN extends Num.Literal = Num.NatDec<$DepthRemaining>,
  SN = $T | $Seen
> =
  // Depth 0 - stop recursing
  $DepthRemaining extends Num.LiteralZero                                                       ? $T :
  // Check for circular reference - prevent infinite recursion
  Union.IsHas<$Seen, $T> extends true                                                           ? $T :
  // Check if type should be preserved (includes built-ins + user-registered types)
  $T extends GetPreservedTypes                                                                  ? $T :
  // Handle arrays and tuples - preserve structure with mapped type
  $T extends readonly any[]                                                                     ? { [K in keyof $T]: To<DN, $T[K], SN> } :
  // Handle Map - traverse both key and value types
  $T extends Map<infer __key__, infer __value__>                                                ? Map<To<DN, __key__, SN>, To<DN, __value__, SN>> :
  // Handle Set - traverse element type
  $T extends Set<infer __element__>                                                             ? Set<To<DN, __element__, SN>> :
  // Handle Promise - traverse resolved type
  $T extends Promise<infer __resolved__>                                                        ? Promise<To<DN, __resolved__, SN>> :
  // Handle WeakMap - traverse both key and value types
  $T extends WeakMap<infer __key__, infer __value__>                                            ? WeakMap<To<DN, __key__, SN>, To<DN, __value__, SN>> :
  // Handle WeakSet - traverse element type
  $T extends WeakSet<infer __element__>                                                         ? WeakSet<To<DN, __element__, SN>> :
  // Try custom types (user-registered via KITZ.Simplify.Traversables)
  // Let-Style Binding
  {
    [K in keyof KITZ.Simplify.Traversables]:
      KITZ.Simplify.Traversables[K] extends { extends: infer __traverse_constraint__, traverse: infer __traverse_kind__ }
        ? $T extends __traverse_constraint__
          ? [Ts.SENTINEL, Fn.Kind.Apply<__traverse_kind__, [$T, DN, SN]>]
          : never // pattern doesn't match
        : never // entry malformed
  }[keyof KITZ.Simplify.Traversables] extends infer __custom_registry_result__
    ? [__custom_registry_result__] extends [never]
      ? $T extends object
        ? { [k in keyof $T]: To<DN, $T[k], SN> } & {}
        : $T
      : __custom_registry_result__ extends [Ts.SENTINEL, infer __apply_return__]
        ? __apply_return__
        : never // impossible - we've either we dealt with apply return or skipped apply
    : never // impossible - alt of let-style binding

/**
 * Simplify one level only (top level flattening).
 *
 * Alias for {@link To}<1, $T>.
 *
 * @template $T - The type to simplify
 *
 * @example
 * ```typescript
 * type Complex = { a: 1 } & { b: { c: 2 } & { d: 3 } }
 * type Simple = Simplify.Top<Complex>
 * // { a: 1; b: { c: 2 } & { d: 3 } } - inner not flattened
 * ```
 *
 * @category Type Simplification
 */
export type Top<$T> = To<1, $T>

/**
 * Simplify using the configured default depth.
 *
 * Alias for {@link To}<{@link KITZ.Perf.Settings.depth}, $T>.
 *
 * Default depth is 10, configurable via global settings.
 *
 * @template $T - The type to simplify
 *
 * @example
 * ```typescript
 * // With default depth: 10
 * type Simple = Simplify.Auto<DeepType>
 *
 * // Customize depth globally
 * declare global {
 *   namespace KITZ {
 *     namespace Perf {
 *       interface Settings {
 *         depth: 5
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * @category Type Simplification
 */
export type Auto<$T> = To<KITZ.Perf.Settings['depth'], $T>

/**
 * Simplify all levels (infinite depth).
 *
 * Alias for {@link To}<-1, $T>.
 *
 * @template $T - The type to simplify
 *
 * @example
 * ```typescript
 * type Complex = { a: 1 } & { b: { c: 2 } & { d: 3 } }
 * type Simple = Simplify.All<Complex>
 * // { a: 1; b: { c: 2; d: 3 } } - all levels flattened
 * ```
 *
 * @category Type Simplification
 */
export type All<$T> = To<Num.LiteralInfinity, $T>
