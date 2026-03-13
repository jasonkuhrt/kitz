import type { Fn } from '#fn'
import type { Rec } from '#rec'
import type { Ts } from '#ts'
import type { Result } from 'effect'

/**
 * Error when type does not have an index signature.
 */
export type LensErrorNoIndexSignature<$Actual> = Ts.Err.StaticError<
  ['lens', 'no-index-signature'],
  { message: 'Type does not have an index signature'; actual: $Actual }
>

/**
 * Get the value type from a type's string index signature.
 *
 * @example
 * ```ts
 * type T1 = Get<Record<string, number>> // Result.Success<number>
 * type T2 = Get<{ [k: string]: Foo }> // Result.Success<Foo>
 * type T3 = Get<{ name: string }> // Result.Failure<error>
 * ```
 */
// oxfmt-ignore
export type Get<$T> =
  string extends keyof $T
    ? Result.Success<never, $T[string]>
    : Result.Failure<LensErrorNoIndexSignature<$T>, never>

/**
 * Set the value type of a type's string index signature.
 *
 * @example
 * ```ts
 * type T = Set<Record<string, number>, string> // { [x: string]: string }
 * ```
 */
// oxfmt-ignore
export type Set<$T, $New> =
  string extends keyof $T
    ? { [k in keyof $T]: $New }
    : never

/**
 * HKT for Get operation.
 */
export interface $Get extends Fn.Kind.Kind {
  constraint: Rec.Any
  lensName: 'indexed'
  parameters: [$T: unknown]
  return: Get<this['parameters'][0]>
}

/**
 * HKT for Set operation.
 */
export interface $Set extends Fn.Kind.Kind {
  constraint: Rec.Any
  lensName: 'indexed'
  parameters: [$T: unknown, $New: unknown]
  return: Set<this['parameters'][0], this['parameters'][1]>
}
