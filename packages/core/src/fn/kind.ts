/**
 * Higher-kinded type utilities for TypeScript.
 *
 * Provides type-level functions and utilities for simulating higher-kinded
 * types in TypeScript, enabling more advanced type-level programming patterns.
 *
 * @module
 */

import type { Result } from 'effect'

/**
 * Apply arguments to a kind (higher-kinded type function).
 *
 * Simulates type-level function application by using intersection types
 * to "pass" parameters and extract the return type. This is a common
 * pattern for implementing higher-kinded types in TypeScript.
 *
 * @template $Kind - The kind function to apply
 * @template $Args - The arguments to apply to the kind function
 *
 * @example
 * ```ts
 * // Define a type-level function
 * interface ArrayOf {
 *   return: Array<this['parameters'][0]>
 * }
 *
 * // Apply it to a type
 * type StringArray = Kind.Apply<ArrayOf, [string]> // string[]
 * type NumberArray = Kind.Apply<ArrayOf, [number]> // number[]
 * ```
 */
export type Apply<$Kind, $Args> =
  // @ts-expect-error - Intentional type manipulation for kind simulation
  ($Kind & { parameters: $Args })['return']

/**
 * Define a kind (higher-kinded type) function interface.
 *
 * Provides a standard structure for defining type-level functions
 * that can be applied using the Apply utility.
 *
 * @template $Params - The parameter types this kind accepts
 * @template $Return - The return type this kind produces
 *
 * @example
 * ```ts
 * interface BoxOf extends Kind<[unknown], Box<any>> {
 *   return: Box<this['parameters'][0]>
 * }
 * ```
 */
export interface Kind<$Params = unknown, $Return = unknown> {
  parameters: $Params
  return: $Return
}

/**
 * Extract the parameter types from a kind.
 *
 * @template $Kind - The kind to extract parameters from
 */
export type Parameters<$Kind> = $Kind extends Kind<infer P, any> ? P : never

/**
 * Extract the return type from a kind.
 *
 * @template $Kind - The kind to extract return type from
 */
export type Return<$Kind> = $Kind extends Kind<any, infer R> ? R : never

/**
 * Create a type-level identity function.
 *
 * Returns the input type unchanged. Useful as a default or
 * placeholder in kind compositions.
 *
 * @example
 * ```ts
 * type Same = Kind.Apply<Kind.Identity, [string]> // string
 * ```
 */
export interface Identity extends Kind {
  // @ts-expect-error
  return: this['parameters'][0]
}

/**
 * Create a type-level constant function.
 *
 * Always returns the same type regardless of input.
 *
 * @template $Const - The constant type to always return
 *
 * @example
 * ```ts
 * type AlwaysString = Kind.Apply<Kind.Const<string>, [number]> // string
 * ```
 */
export interface Const<$Const> extends Kind {
  return: $Const
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Private Kinds
//
//

/**
 * Private symbol for storing kind return type.
 */
export const PrivateKindReturn = Symbol()
export type PrivateKindReturn = typeof PrivateKindReturn

/**
 * Private symbol for storing kind parameters.
 */
export const PrivateKindParameters = Symbol()
export type PrivateKindParameters = typeof PrivateKindParameters

/**
 * Private kind interface using symbols instead of string keys.
 *
 * This provides a more secure way to define higher-kinded types
 * as the symbols cannot be accessed outside the module.
 *
 * @example
 * ```ts
 * interface BoxKind extends PrivateKind {
 *   // @ts-expect-error
 *   [PRIVATE_KIND_RETURN]: Box<this[PRIVATE_KIND_PARAMETERS][0]>
 *   [PRIVATE_KIND_PARAMETERS]: unknown
 * }
 * ```
 */
export interface Private {
  [PrivateKindReturn]: unknown
  [PrivateKindParameters]: unknown
}

/**
 * Apply arguments to a private kind.
 *
 * @template $Kind - The private kind to apply
 * @template $Args - The arguments to apply
 *
 * @example
 * ```ts
 * type BoxOfString = PrivateKindApply<BoxKind, [string]> // Box<string>
 * ```
 */
export type PrivateApply<$Kind extends Private, $Args> = ($Kind & {
  [PrivateKindParameters]: $Args
})[PrivateKindReturn]

// oxfmt-ignore
export type MaybePrivateApplyOr<$MaybeKind, $Args, $Or> =
  $MaybeKind extends Private
    ? PrivateApply<$MaybeKind, $Args>
    : $Or

/**
 * Check if a type is a private kind.
 *
 * @template T - The type to check
 *
 * @example
 * ```ts
 * type Test1 = IsPrivateKind<BoxKind> // true
 * type Test2 = IsPrivateKind<string> // false
 * ```
 */
export type IsPrivateKind<T> = T extends Private ? true : false

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Kind Composition
//
//
//
//

/**
 * Apply a tuple of Kinds sequentially (left-to-right composition).
 *
 * Takes an array of Kind functions and applies them in sequence from left to right.
 * This enables composing multiple type-level transformations without creating
 * specialized intermediate types.
 *
 * **Application order**: Left-to-right (first Kind, then second, then third, etc.)
 *
 * @template $Kinds - Tuple of Kind functions to apply sequentially
 * @template $Input - The initial type to transform
 *
 * @example
 * ```ts
 * // Define some extractors
 * interface Awaited extends Kind {
 *   return: Awaited<this['parameters'][0]>
 * }
 *
 * interface ArrayElement extends Kind {
 *   return: this['parameters'][0] extends (infer El)[] ? El : never
 * }
 *
 * // Compose them: Promise<string[]> -> string[] -> string
 * type Result = Pipe<[Awaited, ArrayElement], Promise<string[]>>
 * // Result: string
 *
 * // Compose three: () => Promise<number[]> -> Promise<number[]> -> number[] -> number
 * type Result2 = Pipe<[ReturnType, Awaited, ArrayElement], () => Promise<number[]>>
 * // Result2: number
 * ```
 */
// oxfmt-ignore
export type Pipe<$Kinds extends readonly Kind[], $Input> =
  $Kinds extends readonly [infer __first__ extends Kind, ...infer __rest__ extends readonly Kind[]]
    ? Pipe<__rest__, Apply<__first__, [$Input]>>
    : $Input

/**
 * Apply a tuple of Kinds sequentially with Result short-circuiting.
 *
 * Like {@link Pipe}, but each Kind is expected to return `Result<A, E>`.
 * On `Success`, unwraps the value and continues to the next Kind.
 * On `Failure`, short-circuits and returns the error immediately.
 *
 * This is the type-level equivalent of chaining `mapSuccess` operations.
 *
 * @template $Input - The initial type to transform
 * @template $Kinds - Tuple of Kind functions that return Result
 *
 * @example
 * ```ts
 * import type { Result } from 'effect'
 *
 * // Kinds that return Result for validation/extraction
 * interface AwaitedKind extends Kind {
 *   return: Result.Success<Awaited<this['parameters'][0]>, never>
 * }
 *
 * // Compose with short-circuit semantics
 * type Result = PipeRight<Promise<string[]>, [AwaitedKind, ArrayKind]>
 * // On success: Result.Success<string, never>
 * // On error: Result.Failure<never, SomeError>
 * ```
 */
// oxfmt-ignore
export type PipeRight<$Input, $Kinds extends readonly Kind[]> =
  $Kinds extends readonly [infer __first__ extends Kind, ...infer __rest__ extends readonly Kind[]]
    ? Apply<__first__, [$Input]> extends infer ___result___
      ? ___result___ extends Result.Failure<infer _, infer __error__> ? Result.Failure<never, __error__>
      : ___result___ extends Result.Success<infer __value__, infer _> ? PipeRight<__value__, __rest__>
      : never
    : never
  : Result.Success<$Input, never>
