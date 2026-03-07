import { Fn, Ts } from '@kitz/core'
/**
 * Assertion builder state tracking the current configuration and position in the API chain.
 *
 * The state is immutable - each API call returns a new state with updated fields.
 * State flows through the builder API to enable type-safe, fluent assertion chains.
 *
 * State is organized into three namespaces:
 * - `actual_*` - The actual value being asserted and its transformations
 * - `expected_*` - The expected value to compare against
 * - `matcher_*` - Configuration for how the comparison is performed
 */
export interface State {
  /**
   * The actual value type being asserted on.
   *
   * In actual-first API (`Assert.on(value)`), this is set immediately.
   * In expected-first API, this is `SENTINEL.Empty` until actual is provided.
   */
  actual_type: unknown

  /**
   * Stack of extractors applied to the actual value before assertion.
   *
   * Extractors transform types (e.g., `.awaited` extracts `T` from `Promise<T>`,
   * `.returned` extracts return type from functions).
   *
   * Applied in order from first to last when the assertion executes.
   *
   * @example
   * ```typescript
   * Assert.on(promise).awaited.returned.exact.of(42)
   * // actual_extractors: [AwaitedKind, ReturnedKind]
   * // Extracts: Promise<() => number> -> number -> number -> assert equals 42
   * ```
   */
  actual_extractors: readonly Fn.Kind.Kind[]

  /**
   * The expected type to compare against.
   *
   * Captured from the matcher argument (e.g., `.of(expected)`, `.string`, etc.).
   * Initially `SENTINEL.Empty` until a matcher provides the expected value.
   */
  expected_type: unknown

  /**
   * The relator kind defining the type relation to check.
   *
   * - `ExactKind` - Structural equality (exact type match)
   * - `EquivKind` - Mutual assignability (semantic equality)
   * - `SubKind` - Subtype relation (actual extends expected)
   * - `SubNoExcessKind` - Subtype + no excess properties
   * - `EquivNoExcessKind` - Equivalent + no excess properties
   *
   * Set when choosing a relator (`.exact`, `.equiv`, `.sub`).
   * Undefined until a relator is selected.
   *
   * @example
   * ```typescript
   * Assert.exact.of(expected)(actual)  // matcher_relator: ExactKind
   * Assert.sub.of(expected)(actual)    // matcher_relator: SubKind
   * ```
   */
  matcher_relator: undefined | Fn.Kind.Kind

  /**
   * Whether the assertion is negated (inverts the check).
   *
   * When `true`, the assertion passes if types do NOT satisfy the relation.
   *
   * @example
   * ```typescript
   * Assert.not.exact.of(string)(42)  // matcher_negated: true - passes because 42 is not string
   * ```
   */
  matcher_negated: boolean

  /**
   * Whether the next input should be the expected value (matcher) or actual value.
   *
   * - `true` - Next input is expected value (matcher phase)
   * - `false` - Next input is actual value (assertion phase)
   *
   * Used by `InputFactory` to dispatch to the correct input handler.
   *
   * @example
   * ```typescript
   * Assert.exact.of(...)  // matcher_input: true (awaiting expected)
   *            .of(42)    // Sets expected_type, toggles matcher_input to false
   *               (actual) // matcher_input: false (awaiting actual)
   * ```
   */
  matcher_input: boolean

  /**
   * Type inference mode controlling how literal types are inferred from values.
   *
   * - `'auto'` - Const inference + strip readonly (default, balanced)
   * - `'narrow'` - Const inference + keep readonly (narrowest literals)
   * - `'wide'` - No const inference (widest types)
   *
   * Affects whether `42` infers as `42` (narrow) or `number` (wide).
   * Also controls readonly stripping in comparison normalization.
   *
   * @example
   * ```typescript
   * Assert.exact.of(42)           // auto: infers 42 (literal), strips readonly in comparison
   * Assert.exact.wide.of(42)      // wide: infers number
   * Assert.exact.narrow.of(42)    // narrow: infers 42 (literal), keeps readonly in comparison
   * ```
   */
  matcher_inferMode: State.InferMode

  /**
   * Whether to allow `unknown` in the actual value type.
   *
   * When `false`, `unknown` actual values are rejected with a type error.
   */
  matcher_allowUnknown: boolean

  /**
   * Whether to allow `any` in the actual value type.
   *
   * When `false`, `any` actual values are rejected with a type error.
   */
  matcher_allowAny: boolean

  /**
   * Whether to allow `never` in the actual value type.
   *
   * When `false`, `never` actual values are rejected with a type error.
   */
  matcher_allowNever: boolean
}

export namespace State {
  export type InferMode = 'auto' | 'narrow' | 'wide'

  // oxfmt-ignore
  export type InputNextCase<$State extends State> = {
    true: {
      true: 'either'
      false: 'actual'
    }
    false: {
      true: 'expected'
      false: 'complete'
    }
  }[Ts.SENTINEL.CaseIsEmpty<$State['actual_type']>][Ts.SENTINEL.CaseIsEmpty<$State['expected_type']>]

  /**
   * Initial state for the assertion builder.
   */
  export type Empty = {
    actual_type: Ts.SENTINEL.Empty
    actual_extractors: []
    expected_type: Ts.SENTINEL.Empty
    matcher_relator: undefined
    matcher_negated: false
    matcher_input: true
    matcher_inferMode: 'auto'
    matcher_allowUnknown: false
    matcher_allowAny: false
    matcher_allowNever: false
  }

  export type SetActualType<$State extends State, $Type> = {
    actual_type: $Type
    actual_extractors: $State['actual_extractors']
    expected_type: $State['expected_type']
    matcher_relator: $State['matcher_relator']
    matcher_negated: $State['matcher_negated']
    matcher_input: $State['matcher_input']
    matcher_inferMode: $State['matcher_inferMode']
    matcher_allowUnknown: $State['matcher_allowUnknown']
    matcher_allowAny: $State['matcher_allowAny']
    matcher_allowNever: $State['matcher_allowNever']
  }

  export type AddActualExtractor<$State extends State, $Extractor extends Fn.Kind.Kind> = {
    actual_type: $State['actual_type']
    actual_extractors: [...$State['actual_extractors'], $Extractor]
    expected_type: $State['expected_type']
    matcher_relator: $State['matcher_relator']
    matcher_negated: $State['matcher_negated']
    matcher_input: $State['matcher_input']
    matcher_inferMode: $State['matcher_inferMode']
    matcher_allowUnknown: $State['matcher_allowUnknown']
    matcher_allowAny: $State['matcher_allowAny']
    matcher_allowNever: $State['matcher_allowNever']
  }

  export type SetExpectedType<$State extends State, $Type> = {
    actual_type: $State['actual_type']
    actual_extractors: $State['actual_extractors']
    expected_type: $Type
    matcher_relator: $State['matcher_relator']
    matcher_negated: $State['matcher_negated']
    matcher_input: false // Expected has been set, now awaiting actual
    matcher_inferMode: $State['matcher_inferMode']
    matcher_allowUnknown: $State['matcher_allowUnknown']
    matcher_allowAny: $State['matcher_allowAny']
    matcher_allowNever: $State['matcher_allowNever']
  }

  export type SetRelator<$State extends State, $Relator extends Fn.Kind.Kind> = {
    actual_type: $State['actual_type']
    actual_extractors: $State['actual_extractors']
    expected_type: $State['expected_type']
    matcher_relator: $Relator
    matcher_negated: $State['matcher_negated']
    matcher_input: $State['matcher_input']
    matcher_inferMode: $State['matcher_inferMode']
    matcher_allowUnknown: $State['matcher_allowUnknown']
    matcher_allowAny: $State['matcher_allowAny']
    matcher_allowNever: $State['matcher_allowNever']
  }

  export type SetNegated<$State extends State> = {
    actual_type: $State['actual_type']
    actual_extractors: $State['actual_extractors']
    expected_type: $State['expected_type']
    matcher_relator: $State['matcher_relator']
    matcher_negated: true
    matcher_input: $State['matcher_input']
    matcher_inferMode: $State['matcher_inferMode']
    matcher_allowUnknown: $State['matcher_allowUnknown']
    matcher_allowAny: $State['matcher_allowAny']
    matcher_allowNever: $State['matcher_allowNever']
  }

  export type SetInferMode<$State extends State, $Mode extends InferMode> = {
    actual_type: $State['actual_type']
    actual_extractors: $State['actual_extractors']
    expected_type: $State['expected_type']
    matcher_relator: $State['matcher_relator']
    matcher_negated: $State['matcher_negated']
    matcher_input: $State['matcher_input']
    matcher_inferMode: $Mode
    matcher_allowUnknown: $State['matcher_allowUnknown']
    matcher_allowAny: $State['matcher_allowAny']
    matcher_allowNever: $State['matcher_allowNever']
  }

  export type SetAllowUnknown<$State extends State> = {
    actual_type: $State['actual_type']
    actual_extractors: $State['actual_extractors']
    expected_type: $State['expected_type']
    matcher_relator: $State['matcher_relator']
    matcher_negated: $State['matcher_negated']
    matcher_input: $State['matcher_input']
    matcher_inferMode: $State['matcher_inferMode']
    matcher_allowUnknown: true
    matcher_allowAny: $State['matcher_allowAny']
    matcher_allowNever: $State['matcher_allowNever']
  }

  export type SetAllowAny<$State extends State> = {
    actual_type: $State['actual_type']
    actual_extractors: $State['actual_extractors']
    expected_type: $State['expected_type']
    matcher_relator: $State['matcher_relator']
    matcher_negated: $State['matcher_negated']
    matcher_input: $State['matcher_input']
    matcher_inferMode: $State['matcher_inferMode']
    matcher_allowUnknown: $State['matcher_allowUnknown']
    matcher_allowAny: true
    matcher_allowNever: $State['matcher_allowNever']
  }

  export type SetAllowNever<$State extends State> = {
    actual_type: $State['actual_type']
    actual_extractors: $State['actual_extractors']
    expected_type: $State['expected_type']
    matcher_relator: $State['matcher_relator']
    matcher_negated: $State['matcher_negated']
    matcher_input: $State['matcher_input']
    matcher_inferMode: $State['matcher_inferMode']
    matcher_allowUnknown: $State['matcher_allowUnknown']
    matcher_allowAny: $State['matcher_allowAny']
    matcher_allowNever: true
  }
}
