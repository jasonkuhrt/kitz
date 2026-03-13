import type { Fn } from '#fn'
import type { Ts } from '#ts'
import type { Result } from 'effect'
import type { Compile, CompileError } from './exp.js'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Helpers
//
//
//
//

/**
 * Check if two types are completely disjoint (cannot overlap).
 * Only returns true when types are GUARANTEED to never intersect.
 *
 * This allows unions that include valid types to pass through.
 * @example
 * IsDisjoint<string, PromiseLike<any>> // true - guaranteed disjoint
 * IsDisjoint<Promise<number>, PromiseLike<any>> // false - they overlap
 * IsDisjoint<string | Promise<number>, PromiseLike<any>> // false - Promise part overlaps
 */
export type IsDisjoint<$T, $Constraint> = [Extract<$T, $Constraint>] extends [never] ? true : false

/**
 * Format a constraint type for display in error messages.
 * Provides human-readable descriptions for common type patterns.
 */
export type FormatConstraint<$Constraint> = $Constraint extends readonly any[]
  ? 'Type must extend array (readonly any[])'
  : $Constraint extends PromiseLike<any>
    ? 'Type must extend PromiseLike<any>'
    : $Constraint extends (...args: any) => any
      ? 'Type must extend function ((...args: any) => any)'
      : Ts.ShowInTemplate<$Constraint>

/**
 * Validates an input type against a constraint and returns extraction result or error.
 * This is used by lenses to provide helpful errors when used on incompatible types.
 *
 * @param $Actual - The type to validate and extract from
 * @param $Constraint - The required constraint type
 * @param $LensName - Human-readable name of the lens
 * @param $ExtractionLogic - The extraction logic to apply if validation passes
 */
export type ValidateAndExtract<$Actual, $Constraint, $LensName extends string, $ExtractionLogic> =
  IsDisjoint<$Actual, $Constraint> extends true
    ? Result.Failure<
        never,
        Ts.Err.StaticError<
          ['lens', 'incompatible'],
          {
            message: `Cannot extract ${$LensName} from incompatible type`
            expected: FormatConstraint<$Constraint>
            actual: $Actual
            attempted: `${$LensName} lens`
          }
        >
      >
    : Result.Success<$ExtractionLogic, never>

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Error Types
//
//
//
//

/**
 * Error when a key does not exist on a type.
 */
export type LensErrorKeyNotFound<$Key, $Actual> = Ts.Err.StaticError<
  ['lens', 'key-not-found'],
  { message: 'Key does not exist on type'; key: $Key; actual: $Actual }
>

/**
 * Error when array element extraction fails.
 */
export type LensErrorArrayExtract<$Actual> = Ts.Err.StaticError<
  ['lens', 'array-extract'],
  {
    message: 'Failed to extract array element from type'
    expected: readonly any[]
    actual: $Actual
  }
>

/**
 * Error when tuple element extraction fails.
 */
export type LensErrorTupleExtract<$Actual> = Ts.Err.StaticError<
  ['lens', 'tuple-extract'],
  {
    message: 'Failed to extract tuple element from type'
    expected: readonly any[]
    actual: $Actual
  }
>

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Core Operations
//
//
//
//

/**
 * Apply a Get lens to extract a value from a type.
 *
 * Supports two calling patterns:
 *
 * 1. **Expression mode**: `Get<'.user.name', Data>` - Compile and apply lens expression
 * 2. **HKT mode**: `Get<Awaited.$Get, Promise<string>>` - Apply HKT directly
 *
 * Returns the extracted value type directly (unwrapped from Result).
 * On error, returns the error type directly.
 *
 * @example
 * ```ts
 * // Expression mode - returns unwrapped value
 * type T1 = Get<'.user.name', { user: { name: string } }> // string
 * type T2 = Get<'.handler>#', { handler: () => Promise<number> }> // number
 *
 * // HKT mode (existing behavior)
 * type T3 = Get<Awaited.$Get, Promise<string>> // Result.Success<string, never>
 * ```
 */
// oxfmt-ignore
export type Get<$First, $Second> =
  // Expression mode: string → compile, apply pipeline, unwrap result
  $First extends string
    ? Compile<$First> extends Result.Failure<infer _, infer __error__>
      ? __error__
      : Compile<$First> extends Result.Success<infer __pipeline__ extends readonly Fn.Kind.Kind[], infer _>
        ? UnwrapEither<Fn.Kind.PipeRight<$Second, __pipeline__>>
        : never
    // HKT mode: apply directly (returns Result-wrapped result)
    : $First extends Fn.Kind.Kind
      ? Fn.Kind.Apply<$First, [$Second]>
      : never

/**
 * Apply a Set lens to replace a value within a type.
 *
 * @example
 * ```ts
 * type T = Set<Awaited.$Set, Promise<string>, number> // Promise<number>
 * ```
 */
export type Set<$Lens extends Fn.Kind.Kind, $T, $New> = Fn.Kind.Apply<$Lens, [$T, $New]>

/**
 * Unwrap Result to get the value or error for type-level shortcuts.
 *
 * - Failure<never, E> → E (propagate error)
 * - Success<V, never> → V (extract value)
 *
 * Used by generated type-level assertion shortcuts to unwrap lens results
 * before passing to relators.
 */
export type UnwrapEither<$Result> =
  $Result extends Result.Failure<infer _, infer __error__>
    ? __error__
    : $Result extends Result.Success<infer __value__, infer _>
      ? __value__
      : never

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Applicability Analysis
//
//
//
//

/**
 * Determine which lenses are applicable to a given type based on its structure.
 *
 * This performs type analysis to determine which lenses can meaningfully
 * operate on a type:
 * - Promise types → `awaited`
 * - Function types → `returned`, `parameters`, `parameter1-5`
 * - Array types → `array`
 *
 * Returns a mapped type with applicable lens names as keys.
 * Used by the assertion builder to provide contextual lens methods.
 *
 * @example
 * ```ts
 * type PromiseLenses = GetApplicableLenses<Promise<string>>
 * // { awaited: true }
 *
 * type FunctionLenses = GetApplicableLenses<() => number>
 * // { returned: true; parameters: true; parameter1: true; ... }
 *
 * type ArrayLenses = GetApplicableLenses<string[]>
 * // { array: true }
 * ```
 */
// oxfmt-ignore
export type GetApplicableLenses<$T> =
  // Check Promise first (outermost layer)
  $T extends Promise<any>
    ? { awaited: true }
    // Not Promise - check Function
    : $T extends (...args: any) => any
      ? { returned: true; parameters: true; parameter1: true; parameter2: true; parameter3: true; parameter4: true; parameter5: true }
      // Not Function - check Array
      : $T extends readonly any[]
        ? { array: true }
        // Not any of the above - no lenses applicable
        : {}
