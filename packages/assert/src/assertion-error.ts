import { Ts } from '@kitz/core'
/**
 * Represents a static assertion error at the type level, optimized for type testing.
 *
 * This is specifically designed for type assertions where you need to communicate expected vs. actual types.
 *
 * Supports three forms of metadata:
 * - Single string tip: `StaticErrorAssertion<'msg', E, A, 'tip'>`
 * - Tuple of tips: `StaticErrorAssertion<'msg', E, A, ['tip1', 'tip2']>`
 * - Metadata object: `StaticErrorAssertion<'msg', E, A, { custom: 'data' }>`
 * - Object with tip: `StaticErrorAssertion<'msg', E, A, { tip: 'advice', ...meta }>`
 *
 * @template $Message - A string literal type describing the assertion failure
 * @template $Expected - The expected type
 * @template $Actual - The actual type that was provided
 * @template $MetaInput - Optional metadata: string tip, tuple of tips, or object with custom fields
 *
 * @example
 * ```ts
 * // Simple error with message only
 * type E1 = StaticErrorAssertion<'Types mismatch', string, number>
 *
 * // With a single tip
 * type E2 = StaticErrorAssertion<'Types mismatch', string, number, 'Use String() to convert'>
 *
 * // With multiple tips
 * type E3 = StaticErrorAssertion<'Types mismatch', string, number, ['Tip 1', 'Tip 2']>
 *
 * // With metadata object
 * type E4 = StaticErrorAssertion<'Types mismatch', string, number, { operation: 'concat' }>
 *
 * // With tip and metadata
 * type E5 = StaticErrorAssertion<'Types mismatch', string, number, { tip: 'Use String()', diff_missing: { x: number } }>
 * ```
 *
 * @category Utils
 */
export interface StaticErrorAssertion<
  $Message extends string = string,
  $Expected = unknown,
  $Actual = unknown,
  $MetaInput extends MetaInput = never,
> extends Ts.Err.StaticError<
  ['assert'],
  {
    message: $Message
    expected: $Expected
    actual: $Actual
  } & NormalizeMetaInput<$MetaInput>
> {}

/**
 * Normalizes metadata input into a consistent object shape.
 *
 * @internal
 * @template $MetaInput - The metadata input (never, string, string[], or object)
 */
// oxfmt-ignore
export type NormalizeMetaInput<$MetaInput extends MetaInput = never> =
  [$MetaInput] extends [never]
    ? {}
    : [$MetaInput] extends [string]
      ? { tip: $MetaInput }
      : [$MetaInput] extends [readonly string[]]
        ? Ts.TupleToLettered<$MetaInput>
        : $MetaInput

export type MetaInput = string | readonly string[] | Record<string, any>

export namespace StaticErrorAssertion {
  /**
   * Type guard to check if a type is specifically a {@link StaticErrorAssertion}.
   *
   * This distinguishes assertion library errors from other domain error types.
   * It checks both:
   * 1. The type is an error (has `ERROR_______` tuple)
   * 2. The hierarchy starts with `['assert', ...]`
   *
   * @template $T - The type to check
   *
   * @example
   * ```ts
   * interface AssertError extends StaticErrorAssertion<string, number> {}
   * interface DomainError extends Ts.Err.StaticError<['domain']> {}
   *
   * type T1 = StaticErrorAssertion.Is<AssertError>  // true
   * type T2 = StaticErrorAssertion.Is<DomainError>  // false
   * type T3 = StaticErrorAssertion.Is<string>       // false
   * ```
   */
  export type Is<$T> = $T extends Ts.Err.StaticError<['assert']> ? true : false
}
