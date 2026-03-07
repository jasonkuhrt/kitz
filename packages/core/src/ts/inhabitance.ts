/**
 * Type utilities for detecting TypeScript edge case types: `any`, `never`, and `unknown`.
 *
 * These utilities are useful for conditional type logic that needs to handle these special types differently.
 *
 * @module
 */

/**
 * Check if a type is `never`.
 *
 * @example
 * ```ts
 * type _ = Ts.Test.Cases<
 *   Ts.Test.equal<IsNever<never>, true>,
 *   Ts.Test.equal<IsNever<any>, false>,
 *   Ts.Test.equal<IsNever<unknown>, false>,
 *   Ts.Test.equal<IsNever<string>, false>
 * >
 * ```
 */
export type IsNever<$Type> = [$Type] extends [never] ? true : false

/**
 * Check if a type is `any`.
 *
 * Uses the fact that `any` is the only type where `0 extends (1 & T)` is true,
 * since `any` absorbs all type operations including impossible intersections.
 *
 * @example
 * ```ts
 * type _ = Ts.Test.Cases<
 *   Ts.Test.equal<IsAny<any>, true>,
 *   Ts.Test.equal<IsAny<unknown>, false>,
 *   Ts.Test.equal<IsAny<string>, false>,
 *   Ts.Test.equal<IsAny<never>, false>
 * >
 * ```
 */
export type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * Check if a type is `unknown`.
 *
 * Unknown is the top type - everything extends unknown (except any, which is special).
 * So we check if unknown extends the type (only true for unknown and any),
 * then exclude any using IsAny.
 *
 * @example
 * ```ts
 * type _ = Ts.Test.Cases<
 *   Ts.Test.equal<IsUnknown<unknown>, true>,
 *   Ts.Test.equal<IsUnknown<any>, false>,
 *   Ts.Test.equal<IsUnknown<string>, false>,
 *   Ts.Test.equal<IsUnknown<never>, false>
 * >
 * ```
 */
export type IsUnknown<T> = unknown extends T ? (IsAny<T> extends true ? false : true) : false

/**
 * Detect if a type is `any` or `unknown`.
 *
 * @example
 * ```ts
 * type _ = Ts.Test.Cases<
 *   Ts.Test.equal<IsAnyOrUnknown<any>, true>,
 *   Ts.Test.equal<IsAnyOrUnknown<unknown>, true>,
 *   Ts.Test.equal<IsAnyOrUnknown<never>, false>,
 *   Ts.Test.equal<IsAnyOrUnknown<string>, false>
 * >
 * ```
 */
export type IsAnyOrUnknown<T> = unknown extends T ? true : false

/**
 * Detect if a type is `any`, `unknown`, or `never`.
 *
 * @example
 * ```ts
 * type _ = Ts.Test.Cases<
 *   Ts.Test.equal<IsAnyOrUnknownOrNever<any>, true>,
 *   Ts.Test.equal<IsAnyOrUnknownOrNever<unknown>, true>,
 *   Ts.Test.equal<IsAnyOrUnknownOrNever<never>, true>,
 *   Ts.Test.equal<IsAnyOrUnknownOrNever<string>, false>
 * >
 * ```
 */
// oxfmt-ignore
export type IsAnyOrUnknownOrNever<T> =
  [T] extends [never] ? true /* never */ :
  unknown extends T   ? true /* any or unknown, we don't care which */
                      : false

// oxfmt-ignore
export type GetCase<T> =
    [T] extends [never]   ? Case.Never :
    unknown extends T     ? (
                              0 extends (1 & T)
                                ? Case.Any
                                : Case.Unknown
                            )
                          : Case.Proper

export type Case = Case.Any | Case.Unknown | Case.Never | Case.Proper

export namespace Case {
  export type Any = 'any'
  export type Unknown = 'unknown'
  export type Never = 'never'
  export type Proper = 'proper'
}

/**
 * Check if a type is empty.
 *
 * Empty types:
 * - Empty array: `[]` or `readonly []`
 * - Empty object: `keyof T extends never` (no properties)
 * - Empty string: `''`
 *
 * Note: `{}` and `interface Foo {}` mean "non-nullish", NOT empty!
 *
 * @example
 * ```ts
 * type _ = Ts.Test.Cases<
 *   Ts.Test.equal<IsEmpty<[]>, true>,
 *   Ts.Test.equal<IsEmpty<readonly []>, true>,
 *   Ts.Test.equal<IsEmpty<''>, true>,
 *   Ts.Test.equal<IsEmpty<Record<string, never>>, true>,
 *   Ts.Test.equal<IsEmpty<[1]>, false>,
 *   Ts.Test.equal<IsEmpty<'hello'>, false>,
 *   Ts.Test.equal<IsEmpty<{ a: 1 }>, false>,
 *   Ts.Test.equal<IsEmpty<{}>, false>  // {} = non-nullish, not empty!
 * >
 * ```
 */
// oxfmt-ignore
export type IsEmpty<$T> =
  $T extends readonly [] ? true :
  $T extends '' ? true :
  $T extends object
    ? keyof $T extends never ? true : false
    : false
