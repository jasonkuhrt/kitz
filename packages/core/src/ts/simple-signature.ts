/**
 * Utilities for working with the `__simpleSignature` phantom type pattern.
 *
 * This pattern allows functions with complex generic signatures to provide
 * a simpler signature for type inference in contexts like testing or documentation.
 *
 * @module SimpleSignature
 */

/**
 * Symbol used to attach a simplified signature to complex generic functions.
 *
 * Functions can add this symbol as a property with a simpler signature type
 * to help type inference in contexts where the complex generics are difficult
 * to infer (e.g., Test.on(), documentation generators).
 *
 * @example
 * ```ts
 * export const complexFn = <T extends object>(obj: T): Complex<T> => { ... }
 *
 * // Add simple signature for better type inference
 * complexFn[__simpleSignature] = undefined as any as ((obj: object) => object)
 * ```
 */
export const symbol = Symbol.for('__simpleSignature')

/**
 * Helper interface for defining simple signatures with overloads.
 *
 * Use this to define multiple overload signatures in a type-safe way.
 * The type parameter accepts a tuple of function signatures.
 *
 * @template $Overloads - Tuple of function signature types
 *
 * @example
 * ```ts
 * interface MyFunctionType extends SimpleSignature<[
 *   (x: string) => number,
 *   (x: number) => string,
 *   (x: boolean) => boolean
 * ]> {
 *   // Your complex generic signature
 *   <T extends string | number | boolean>(x: T): ComplexType<T>
 * }
 * ```
 *
 * @example
 * ```ts
 * // Single overload (most common case)
 * interface PartitionFn extends SimpleSignature<[
 *   (obj: object, keys: string[]) => { picked: object; omitted: object }
 * ]> {
 *   <T extends object, K extends keyof T>(
 *     obj: T,
 *     keys: K[]
 *   ): { picked: Pick<T, K>; omitted: Omit<T, K> }
 * }
 * ```
 */
export interface SimpleSignature<
  $Overloads extends readonly [(...args: any[]) => any, ...Array<(...args: any[]) => any>],
> {
  [symbol]: $Overloads[number]
}

/**
 * Extract the signature from a function, preferring `__simpleSignature` if available.
 *
 * If the function has a `__simpleSignature` property, returns that type.
 * Otherwise, returns the function's actual type unchanged.
 *
 * @template $fn - The function type to extract from
 *
 * @example
 * ```ts
 * // Function without __simpleSignature
 * type Fn1 = (a: string, b: number) => boolean
 * type Result1 = GetSignature<Fn1>  // (a: string, b: number) => boolean
 *
 * // Function with __simpleSignature
 * declare const partition: {
 *   <T extends object, K extends keyof T>(obj: T, keys: K[]): { picked: Pick<T, K>; omitted: Omit<T, K> }
 *   [__simpleSignature]: (obj: object, keys: string[]) => { picked: object; omitted: object }
 * }
 * type Result2 = GetSignature<typeof partition>  // (obj: object, keys: string[]) => { picked: object; omitted: object }
 * ```
 */
export type GetSignature<$fn> = $fn extends { [symbol]: infer $sig } ? $sig : $fn

/**
 * Extract parameters from a function, using `__simpleSignature` if available.
 *
 * @template $fn - The function type to extract parameters from
 *
 * @example
 * ```ts
 * type Params1 = GetParameters<(a: string, b: number) => void>  // [a: string, b: number]
 *
 * // With __simpleSignature
 * declare const partition: {
 *   <T extends object, K extends keyof T>(obj: T, keys: K[]): any
 *   [__simpleSignature]: (obj: object, keys: string[]) => any
 * }
 * type Params2 = GetParameters<typeof partition>  // [obj: object, keys: string[]]
 * ```
 */
export type GetParameters<$fn> =
  GetSignature<$fn> extends (...args: any) => any ? Parameters<GetSignature<$fn>> : never

/**
 * Extract return type from a function, using `__simpleSignature` if available.
 *
 * @template $fn - The function type to extract return type from
 *
 * @example
 * ```ts
 * type Return1 = GetReturnType<(a: string) => number>  // number
 *
 * // With __simpleSignature
 * declare const partition: {
 *   <T extends object, K extends keyof T>(obj: T, keys: K[]): { picked: Pick<T, K>; omitted: Omit<T, K> }
 *   [__simpleSignature]: (obj: object, keys: string[]) => { picked: object; omitted: object }
 * }
 * type Return2 = GetReturnType<typeof partition>  // { picked: object; omitted: object }
 * ```
 */
export type GetReturnType<$fn> =
  GetSignature<$fn> extends (...args: any) => any ? ReturnType<GetSignature<$fn>> : never

/**
 * Helper to implement a function with a simple signature for inference.
 *
 * This allows you to write the implementation using the simple signature types
 * while the returned function has the full complex signature.
 *
 * @template $Fn - The full function interface (with complex generics)
 * @param impl - Implementation function typed with the simple signature
 * @returns The implementation cast to the full function type
 *
 * @example
 * ```ts
 * interface PartitionFn extends SimpleSignature<[
 *   (obj: object, keys: string[]) => { picked: object; omitted: object }
 * ]> {
 *   <T extends object, K extends keyof T>(
 *     obj: T,
 *     keys: K[]
 *   ): { picked: Pick<T, K>; omitted: Omit<T, K> }
 * }
 *
 * export const partition = implement<PartitionFn>((obj, pickedKeys) => {
 *   // Implementation typed with simple signature: object and string[]
 *   return { picked: {}, omitted: { ...obj } }
 * })
 * ```
 */
export const implement = <$Fn>(impl: GetSignature<$Fn>): $Fn => impl as any
