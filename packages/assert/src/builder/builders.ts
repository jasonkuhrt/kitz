import { Fn, Optic, Ts } from '@kitz/core'
import type { Result } from 'effect'
import type {
  AssertAnyKind,
  AssertEmptyKind,
  AssertEquivKind,
  AssertEquivNoExcessKind,
  AssertExactKind,
  AssertNeverKind,
  AssertSubKind,
  AssertSubNoExcessKind,
  AssertUnknownKind,
} from '../asserts.js'
import type {
  AssertActual,
  AssertEdgeType,
  AssertExpected,
  AssertUnaryRelator,
  AssertUnaryRelatorValue,
  OnlyAssertionErrorsAndShow,
} from './asserts.js'
import type { GuardActual, GuardExpected } from './guards.js'
import type { State as S } from './state.js'

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Core
//
//

export type Builder<$State extends S> = BuilderUnaryRelators<$State> &
  BuilderBinaryRelators<$State> &
  BuilderExtractors<$State> &
  BuilderSettings<$State> &
  BuilderActualInputIfMissing<$State>

export type BuilderActualInputIfMissing<$State extends S> = {
  actual: BuilderActualInput<$State>
  either: BuilderActualInput<$State>
  expected: {}
  complete: {}
}[S.InputNextCase<$State>]

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Unary Relators
//
//

/**
 * Unary relators - check properties of a single type.
 * These are directly executable (no matchers needed).
 * All support .not modifier.
 */
export interface BuilderUnaryRelators<$State extends S> {
  /**
   * Assert type is `any`.
   */
  readonly any: UnaryRelatorDispatch<$State, AssertAnyKind>

  /**
   * Assert type is `unknown`.
   */
  readonly unknown: UnaryRelatorDispatch<$State, AssertUnknownKind>

  /**
   * Assert type is `never`.
   */
  readonly never: UnaryRelatorDispatch<$State, AssertNeverKind>

  /**
   * Assert type is empty ([], keyof T extends never, or '').
   * Note: {} is non-nullish, not empty!
   */
  readonly empty: UnaryRelatorDispatch<$State, AssertEmptyKind>
}

type UnaryRelatorDispatch<$State extends S, $Kind extends Fn.Kind.Kind> = {
  complete: ExecuteUnaryRelator<$State, $Kind>
  either: InputActualForUnaryRelator<$State, $Kind>
  actual: InputActualForUnaryRelator<$State, $Kind>
  expected: ExecuteUnaryRelator<$State, $Kind> // Unary relators execute when we have actual (no expected needed)
}[S.InputNextCase<$State>]

export type InputActualForUnaryRelator<$State extends S, $Kind extends Fn.Kind.Kind> = {
  auto: InputActualForUnaryRelatorNarrow<$State, $Kind>
  narrow: InputActualForUnaryRelatorNarrow<$State, $Kind>
  wide: InputActualForUnaryRelatorWide<$State, $Kind>
}[$State['matcher_inferMode']]

export interface InputActualForUnaryRelatorNarrow<$State extends S, $Kind extends Fn.Kind.Kind> {
  <const $actual>(
    value: $actual,
    ...params: OnlyAssertionErrorsAndShow<[AssertUnaryRelator<$actual, $State, $Kind>]>
  ): void
}

export interface InputActualForUnaryRelatorWide<$State extends S, $Kind extends Fn.Kind.Kind> {
  <$actual>(
    value: $actual,
    ...params: OnlyAssertionErrorsAndShow<[AssertUnaryRelator<$actual, $State, $Kind>]>
  ): void
}

export type ExecuteUnaryRelator<
  $State extends S,
  $Kind extends Fn.Kind.Kind,
  ___ExtractionResult = Fn.Kind.PipeRight<$State['actual_type'], $State['actual_extractors']>,
> =
  ___ExtractionResult extends Result.Failure<infer _, infer ERROR>
    ? (...params: OnlyAssertionErrorsAndShow<[ERROR]>) => void // Extraction failed - propagate error
    : ___ExtractionResult extends Result.Success<infer VALUE, infer _>
      ? (
          ...params: OnlyAssertionErrorsAndShow<[AssertUnaryRelatorValue<VALUE, $State, $Kind>]>
        ) => void // Extraction succeeded
      : never

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Binary Relators
//
//

/**
 * Binary relators - compare two types.
 * Return Matchers interface for providing expected type.
 */
export interface BuilderBinaryRelators<$State extends S> {
  readonly exact: BuilderMatchers<S.SetRelator<$State, AssertExactKind>, AssertExactKind>
  readonly equiv: BuilderMatchers<S.SetRelator<$State, AssertEquivKind>, AssertEquivKind>
  readonly sub: BuilderMatchers<S.SetRelator<$State, AssertSubKind>, AssertSubKind>
}

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Extractors
//
//

export type BuilderExtractors<$State extends S> = {
  actual: BuilderExtractorsConstant<$State>
  either: BuilderExtractorsConstant<$State>
  expected: BuilderExtractorsConditionalMaybe<$State>
  complete: {}
}[S.InputNextCase<$State>]

/**
 * Extractor methods derived from registry.
 * Each extractor returns a builder with that extractor added to the chain.
 */
export type BuilderExtractorsConstant<$State extends S> = {
  readonly [K in keyof Optic.LensRegistry]: Builder<
    S.AddActualExtractor<$State, Optic.LensRegistry[K]>
  >
}

/**
 * Unwrap Result.Success to get the success value after extraction.
 * Used to determine what extractors are applicable to the transformed type.
 */
type UnwrapExtractionResult<$Result> =
  $Result extends Result.Success<infer __value__, infer _> ? __value__ : $Result // If Left, extraction failed - shouldn't happen in conditional context

export type BuilderExtractorsConditionalMaybe<
  $State extends S,
  ___$ActualAfterExtraction = UnwrapExtractionResult<
    Fn.Kind.PipeRight<$State['actual_type'], $State['actual_extractors']>
  >,
  ___$ActualIsEmpty extends boolean = Ts.SENTINEL.IsEmpty<___$ActualAfterExtraction>,
  ___$ActualInhabitanceCase extends Ts.Inhabitance.Case =
    Ts.Inhabitance.GetCase<___$ActualAfterExtraction>,
> = ___$ActualIsEmpty extends true
  ? BuilderExtractorsConstant<$State> // Empty sentinel - use constant (HKT) extractors
  : {
      proper: BuilderExtractorsConditionalAfterExtraction<$State, ___$ActualAfterExtraction>
      // else constant extractors only
      any: BuilderExtractorsConstant<$State>
      unknown: BuilderExtractorsConstant<$State>
      never: BuilderExtractorsConstant<$State>
    }[___$ActualInhabitanceCase]

/**
 * Conditional extractors based on the type AFTER applying the extraction chain.
 *
 * This variant is used when extractors have already been added to the state.
 * It checks applicability against the transformed type, not the raw actual type.
 *
 * @param $State - Current builder state
 * @param $ActualAfterExtraction - The actual type after applying all extractors in the chain
 */
export type BuilderExtractorsConditionalAfterExtraction<
  $State extends S,
  $ActualAfterExtraction,
> = {
  readonly [K in keyof Optic.GetApplicableLenses<$ActualAfterExtraction> &
    keyof Optic.LensRegistry]: Builder<S.AddActualExtractor<$State, Optic.LensRegistry[K]>>
}

/**
 * Conditional extractors based on actual type structure (no prior extraction).
 *
 * Uses Path.GetApplicableExtractors to determine which extractors are valid for the type,
 * then adds each extractor to the transformation chain (like BuilderExtractorsConstant).
 *
 * The difference from Constant is that Conditional only exposes applicable extractors,
 * while Constant exposes all extractors (for HKT use cases).
 *
 * Extraction happens later during validation, not here.
 */
export type BuilderExtractorsConditional<$State extends S> = {
  readonly [K in keyof Optic.GetApplicableLenses<$State['actual_type']> &
    keyof Optic.LensRegistry]: Builder<S.AddActualExtractor<$State, Optic.LensRegistry[K]>>
}

/**
 * Valid relator kinds for use in Relator interface.
 */
type RelatorKind = AssertExactKind | AssertEquivKind | AssertSubKind

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Matchers
//
//

/**
 * Relator namespace containing all matchers for a specific relator.
 *
 * Matchers come in three forms:
 * - `.of` - Base primitive, takes expected then actual (two-level curry)
 * - `.string`, `.number`, etc. - Pre-curried convenience (one-level, direct actual)
 * - `.literal` - Special matcher with const inference (two-level curry)
 */
export interface BuilderMatchers<$State extends S, $RelatorKind extends RelatorKind = RelatorKind> {
  readonly of: InputExpectedAsValue<$State>
  readonly ofAs: InputExpectedAsType<$State>

  readonly string: InputActualDispatch<S.SetExpectedType<$State, string>>
  readonly number: InputActualDispatch<S.SetExpectedType<$State, number>>
  readonly bigint: InputActualDispatch<S.SetExpectedType<$State, bigint>>
  readonly boolean: InputActualDispatch<S.SetExpectedType<$State, boolean>>
  readonly true: InputActualDispatch<S.SetExpectedType<$State, true>>
  readonly false: InputActualDispatch<S.SetExpectedType<$State, false>>
  readonly undefined: InputActualDispatch<S.SetExpectedType<$State, undefined>>
  readonly null: InputActualDispatch<S.SetExpectedType<$State, null>>
  readonly symbol: InputActualDispatch<S.SetExpectedType<$State, symbol>>
  readonly Date: InputActualDispatch<S.SetExpectedType<$State, Date>>
  readonly RegExp: InputActualDispatch<S.SetExpectedType<$State, RegExp>>
  readonly Error: InputActualDispatch<S.SetExpectedType<$State, Error>>
  readonly unknown: UnaryRelatorDispatch<
    S.SetExpectedType<S.SetAllowUnknown<$State>, unknown>,
    AssertUnknownKind
  >
  readonly any: UnaryRelatorDispatch<S.SetExpectedType<S.SetAllowAny<$State>, any>, AssertAnyKind>
  readonly never: UnaryRelatorDispatch<
    S.SetExpectedType<S.SetAllowNever<$State>, never>,
    AssertNeverKind
  >
  // readonly empty: UnaryRelatorDispatch<$State, EmptyKind> // todo: do we need this??????

  /**
   * NoExcess modifier - adds excess property checking to relation.
   *
   * - `sub.noExcess`: Subtype relation with excess property checking
   * - `equiv.noExcess`: Equivalence relation with excess property checking
   * - `exact.noExcess`: Not available (exact already requires exact match)
   */
  readonly noExcess: {
    sub: InputExpectedAsValue<S.SetRelator<$State, AssertSubNoExcessKind>>
    equiv: InputExpectedAsValue<S.SetRelator<$State, AssertEquivNoExcessKind>>
    exact: never
  }[$RelatorKind['name']]

  /**
   * Type-explicit variant of noExcess.
   */
  readonly noExcessAs: {
    sub: InputExpectedAsType<S.SetRelator<$State, AssertSubNoExcessKind>>
    equiv: InputExpectedAsType<S.SetRelator<$State, AssertEquivNoExcessKind>>
    exact: never
  }[$RelatorKind['name']]
}

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Settings
//
//

export interface BuilderSettings<$State extends S> {
  // _: $State
  /**
   * Negate the assertion (inverts the relation check).
   */
  readonly not: Builder<S.SetNegated<$State>>

  /**
   * Apply a custom extractor function to transform the actual type.
   *
   * Extracts the `.kind` property from the extractor and adds it to the transformation chain.
   * Allows using custom extractors created with `Fn.Extractor` and Lens types.
   *
   * @param extractor - An Extractor function with `.kind` property
   * @returns Builder with extractor added to transformation chain
   *
   * @example
   * ```ts
   * import { Fn, Lens } from '@wollybeard/kit'
   *
   * // Create and use a custom extractor
   * const awaited: Fn.Extractor = Object.assign(
   *   (value: Promise<any>) => value,
   *   { kind: {} as Optic.Awaited.$Get }
   * )
   * const promise = Promise.resolve(42)
   * A.extract(awaited).exact.of(42).on(promise)
   * ```
   */
  extract<$Extractor extends Fn.Extractor>(
    extractor: $Extractor,
  ): Builder<S.AddActualExtractor<$State, $Extractor['kind']>>

  /**
   * Configure inference mode to narrow (literals with readonly preserved).
   *
   * Use `const` modifier with readonly preserved.
   * Example: `[1, 2]` becomes `readonly [1, 2]`
   */
  readonly inferNarrow: Builder<S.SetInferMode<$State, 'narrow'>>

  /**
   * Configure inference mode to wide (no literal inference).
   *
   * No `const` modifier, types are widened.
   * Example: `[1, 2]` becomes `number[]`
   */
  readonly inferWide: Builder<S.SetInferMode<$State, 'wide'>>

  /**
   * Configure inference mode to auto (default: literals with readonly stripped).
   *
   * Use `const` modifier but strip readonly deep.
   * Example: `[1, 2]` becomes `[1, 2]` (not `readonly [1, 2]`)
   */
  readonly inferAuto: Builder<S.SetInferMode<$State, 'auto'>>

  /**
   * Dynamically configure inference mode.
   *
   * Useful when inference mode comes from configuration or external source.
   */
  setInfer<$Mode extends S.InferMode>(mode: $Mode): Builder<S.SetInferMode<$State, $Mode>>
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • InputExpected
//
//
//
//

// oxfmt-ignore
export type InputExpectedAsValue<$State extends S> = {
  'auto': InputExpectedAsValueNarrow<$State>
  'narrow': InputExpectedAsValueNarrow<$State>
  'wide': InputExpectedAsValueWide<$State>
}[$State['matcher_inferMode']]

// oxfmt-ignore
export interface InputExpectedAsValueNarrow<$State extends S> {
  <const $expected>(...params: InputExpectedAsValueParams<$State, $expected>): Dispatch_AfterInputEither<S.SetExpectedType<$State, $expected>>
}
// oxfmt-ignore
export interface InputExpectedAsValueWide<$State extends S> {
        <$expected>(...params: InputExpectedAsValueParams<$State, $expected>): Dispatch_AfterInputEither<S.SetExpectedType<$State, $expected>>
}

export interface InputExpectedAsType<$State extends S> {
  <$Type>(
    ...errors: InputExpectedAsTypeParam<$State, $Type>
  ): Dispatch_AfterInputEither<S.SetExpectedType<$State, $Type>>
}

export type InputExpectedAsTypeParam<$State extends S, $expected> = {
  either: []
  // Trigger
  expected: OnlyAssertionErrorsAndShow<
    [
      AssertExpected<$expected, $State>,
      ...CheckAgainstAnyNeverUnknown<$State['actual_type'], $expected, $State>,
    ]
  >
  // Awaiting actual now
  actual: []
  // impossible
  complete: never
}[S.InputNextCase<$State>]

export type InputExpectedAsValueParams<$State extends S, $expected> = {
  // Neither set - no guards needed
  either: [expected: $expected]
  // Expected missing, actual IS set - validate expected against actual
  expected: [
    expected: GuardExpected<$expected, $State>,
    ...CheckAgainstAnyNeverUnknown<$State['actual_type'], $expected, $State>,
  ]
  // Impossible - expected already set
  actual: never
  // Impossible
  complete: never
}[S.InputNextCase<$State>]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • InputActual
//
//
//
//

export type InputActualDispatch<$State extends S> = {
  either: never
  expected: never
  actual: InputActualAsValue<$State>
  complete: ExecuteNullary<$State>
}[S.InputNextCase<$State>]

export interface BuilderActualInput<$State extends S> {
  on: InputActualAsValue<$State>
  onAs: InputActualAsType<$State>
}

export type InputActualAsValue<$State extends S> = {
  auto: InputActualAsValueNarrow<$State>
  wide: InputActualAsValueWide<$State>
  narrow: InputActualAsValueNarrow<$State>
}[$State['matcher_inferMode']]

// oxfmt-ignore
export interface InputActualAsValueNarrow<$State extends S> {
  <const $actual>(...params: InputActualAsValueParams<$State, $actual>): Dispatch_AfterInputEither<S.SetActualType<$State,$actual>>
}
// oxfmt-ignore
export interface InputActualAsValueWide<$State extends S> {
        <$actual>(...params: InputActualAsValueParams<$State, $actual>): Dispatch_AfterInputEither<S.SetActualType<$State,$actual>>
}

export type InputActualAsValueParams<$State extends S, $actual> = {
  // in this case we're in an actual-first style call chain,
  // just collect the actual, don't apply assertion yet since
  // we don't have any expected to work with.
  either: [actual: $actual]
  // Impossible, ... todo?
  expected: never
  // trigger
  actual: [
    actual: GuardActual<$actual, $State>,
    ...CheckAgainstAnyNeverUnknown<NoInfer<$actual>, $State['expected_type'], $State>,
  ]
  // Impossible, only at the end of the chain can this happen
  complete: never
}[S.InputNextCase<$State>]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • InputActualAsType

export interface InputActualAsType<$State extends S> {
  <$actual>(
    ...errors: InputActualAsTypeParam<$State, $actual>
  ): Dispatch_AfterInputEither<S.SetActualType<$State, $actual>>
}

export type InputActualAsTypeParam<$State extends S, $actual> = {
  // Actual-first mode - no guards needed (no relator/expected to validate against)
  either: []
  // Impossible
  expected: never
  // Expected-first mode - apply guards to validate actual matches expected
  actual: OnlyAssertionErrorsAndShow<
    [
      AssertActual<$actual, $State>,
      ...CheckAgainstAnyNeverUnknown<$actual, $State['expected_type'], $State>,
    ]
  >
  // Impossible
  complete: never
}[S.InputNextCase<$State>]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • DispatchAfterInput
//
//
//
//

export type Dispatch_AfterInputEither<$State extends S> = {
  either: never
  expected: Builder<$State>
  actual: Builder<$State>
  complete: never // ExecuteLone<$State>
}[S.InputNextCase<$State>]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Execute
//
//
//
//

type ExecuteNullary<$State extends S> = (
  ...errors: OnlyAssertionErrorsAndShow<
    [
      AssertActual<$State['actual_type'], $State>,
      ...CheckAgainstAnyNeverUnknown<$State['actual_type'], $State['expected_type'], $State>,
    ]
  >
) => void

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Helpers
//
//

/**
 * Unified guard for never/any/unknown validation.
 * Checks both actual and expected values, returns tuple of 0-2 errors.
 */
export type CheckAgainstAnyNeverUnknown<
  $actual,
  $expected,
  $State extends S,
> = OnlyAssertionErrorsAndShow<[AssertEdgeType<$actual, $State>, AssertEdgeType<$expected, $State>]>
