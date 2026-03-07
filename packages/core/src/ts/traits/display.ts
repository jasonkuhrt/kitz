import type { Arr } from '#arr'
import type { IsAny, IsNever, IsUnknown } from '../inhabitance.js'
import type * as Union from '../union.js'

/**
 * Get the result of applying all Handlers to a type.
 * Returns a union of all matching handler outputs, or `never` if no handlers match.
 *
 * @internal
 */
type HandlersResult<$Type> = [keyof KITZ.Traits.Display.Handlers<$Type>] extends [never]
  ? never
  : KITZ.Traits.Display.Handlers<$Type>[keyof KITZ.Traits.Display.Handlers<$Type>]

/**
 * Display a type as a readable string representation.
 *
 * @remarks
 * This type converts TypeScript types to human-readable string representations.
 * It handles special types (any, unknown, never), primitives, common objects,
 * and supports extensibility via {@link KITZ.Traits.Display.Handlers}.
 *
 * **Extensibility:** Add custom type display handlers by augmenting Handlers:
 * ```typescript
 * declare global {
 *   namespace KITZ.Traits.Display {
 *     interface Handlers<$Type> {
 *       MyType: $Type extends MyType<infer A> ? `MyType<${Ts.Display<A>}>` : never
 *     }
 *   }
 * }
 * ```
 *
 * @category Type Display
 */
// oxfmt-ignore
export type Display<$Type, $Fallback extends string | undefined = undefined> =
  // Language base category types
    IsAny<$Type> extends true     ? 'any'
  : IsUnknown<$Type> extends true ? 'unknown'
  : IsNever<$Type> extends true   ? 'never'

  // Special union type boolean which we display as boolean instead of true | false
  : [$Type] extends [boolean]      ? ([boolean] extends [$Type] ? 'boolean' : `${$Type}`)

  // General union types
  : Union.ToTuple<$Type> extends Arr.Any2OrMore ? _DisplayUnion<Union.ToTuple<$Type>>

  // Primitive and literal types (always display, ignoring fallback)
  : $Type extends true             ? 'true'
  : $Type extends false            ? 'false'
  : $Type extends void             ? ($Type extends undefined ? 'undefined' : 'void')
  : $Type extends string           ? (string extends $Type    ? 'string'  : `'${$Type}'`)
  : $Type extends number           ? (number extends $Type    ? 'number'  : `${$Type}`)
  : $Type extends bigint           ? (bigint extends $Type    ? 'bigint'  : `${$Type}n`)
  : $Type extends null             ? 'null'
  : $Type extends undefined        ? 'undefined'

  // User-provided fallback takes precedence if type is not a primitive
  : $Fallback extends string       ? $Fallback

  // Check registered Handlers for common object types
  : [HandlersResult<$Type>] extends [never]
    // No handler matched - general fallbacks
    ? $Type extends object           ? 'object'
    : '?'
    // Handler matched - use its result
    : HandlersResult<$Type>

/**
 * Helper type for displaying union types.
 * @internal
 */
// oxfmt-ignore
export type _DisplayUnion<$Type extends Arr.Any> =
    $Type extends readonly [infer __first__, ...infer __rest__ extends Arr.Any1OrMore]
      ? `${Display<__first__>} | ${_DisplayUnion<__rest__>}`
      : $Type extends readonly [infer __first__]
        ? `${Display<__first__>}`
        : $Type extends Arr.Empty
          ? ''
          : never

/**
 * Global namespace for Kit trait implementations.
 *
 * Each trait gets its own namespace with a Handlers interface
 * that can be extended via declaration merging.
 */
declare global {
  namespace KITZ.Traits {
    /**
     * Display trait for type-level string representation.
     *
     * Extend the Handlers interface to add custom display logic for your types.
     */
    namespace Display {
      /**
       * Registry of Display trait implementations.
       *
       * Each property should be a conditional type that:
       * - Returns the formatted string if `$Type` matches the constraint
       * - Returns `never` if `$Type` doesn't match
       *
       * This allows users to extend type display for custom types via declaration merging.
       * The constraint and formatter are colocated in a single conditional type expression.
       *
       * **Built-in handlers:** Array, ReadonlyArray, Promise, Date, RegExp, Function, symbol
       * (registered in their respective domain modules)
       *
       * @example
       * ```typescript
       * // Add custom type display for Effect
       * import type { Effect } from 'effect'
       * import type { Ts } from '@wollybeard/kit'
       *
       * declare global {
       *   namespace KITZ.Traits.Display {
       *     interface Handlers<$Type> {
       *       Effect: $Type extends Effect.Effect<infer A, infer E, infer R>
       *         ? `Effect<${Ts.Display<A>}, ${Ts.Display<E>}, ${Ts.Display<R>}>`
       *         : never
       *     }
       *   }
       * }
       * export {}
       *
       * // Now Display<Effect.Effect<string, Error, never>> → 'Effect<string, Error, never>'
       * ```
       */
      interface Handlers<$Type> {
        // Empty by default - built-in handlers are added in domain modules via declaration merging
      }
    }
  }
}
