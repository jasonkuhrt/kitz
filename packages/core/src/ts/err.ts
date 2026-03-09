import type { Str } from '#str'
import type * as Simplify from './simplify.js'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Base Error Types
//
//
//
//

/**
 * Base interface for all static type-level errors.
 *
 * Errors are identified by their hierarchical path in the `ERROR_______` field.
 * Additional error context (metadata, messages, etc.) goes in the `CONTEXT_____` field.
 *
 * The empty array `[]` represents the root of the error hierarchy.
 *
 * @template $Hierarchy - Error hierarchy path as a tuple (e.g., `['parse', 'param']`)
 * @template $Context - Arbitrary context object with error-specific data
 *
 * @example
 * ```ts
 * // Simple error with no context
 * interface ParseError extends StaticError<['parse']> {}
 *
 * // Error with context
 * interface InvalidKeyError extends StaticError<
 *   ['group', 'invalid-key'],
 *   { key: string; message: string }
 * > {}
 *
 * // Check if a type is an error
 * type IsError<$T> = $T extends { ERROR_______: readonly [...string[]] } ? true : false
 * ```
 *
 * @category Error Messages
 */
/**
 * Normalize hierarchy input - convert string to [string] array.
 * @internal
 */
// todo use Tup.ensure helper for this
type NormalizeHierarchyInput<$H> = $H extends readonly string[]
  ? $H
  : $H extends string
    ? [$H]
    : readonly string[]

export interface StaticError<
  // todo with readonly
  // $HierarchyInput extends ArrMut.Maybe<string>
  $HierarchyInput extends readonly string[] | string = readonly string[],
  $Context extends object = object,
> {
  ERROR_______: readonly [...NormalizeHierarchyInput<$HierarchyInput>, ...string[]]
  CONTEXT_____: $Context
}

export interface StaticErrorMessage<$Message extends string> extends StaticError<
  [],
  { message: $Message }
> {}

/**
 * Pad a key to 14 characters with underscores - optimized with zero recursion.
 * @internal
 */
// oxfmt-ignore
type PadKeyTo14<$Key extends string> =
  Str.Length<$Key> extends infer __len extends number
    ? __len extends 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
      ? {
          0: '______________'
          1: `${$Key}_____________`
          2: `${$Key}____________`
          3: `${$Key}___________`
          4: `${$Key}__________`
          5: `${$Key}_________`
          6: `${$Key}________`
          7: `${$Key}_______`
          8: `${$Key}______`
          9: `${$Key}_____`
          10: `${$Key}____`
          11: `${$Key}___`
          12: `${$Key}__`
          13: `${$Key}_`
        }[__len]
      : $Key  // >= 14, already long enough
    : $Key

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Error Utilities (Err namespace)
//
//
//
//

/**
 * Check if a type is a static error.
 *
 * This type distributes over unions, checking each member.
 *
 * @template $T - The type to check
 * @returns true if $T extends StaticError, false otherwise
 *
 * @example
 * ```ts
 * type A = Is<StaticError<['parse']>>  // true
 * type B = Is<string>  // false
 * type C = Is<{ ERROR_______: ['custom'] }>  // true (structural compatibility)
 * type D = Is<string | StaticError<['parse']>>  // boolean (distributes: false | true)
 * ```
 *
 * @category Error Utilities
 */
export type Is<$T> = $T extends StaticError ? true : false

/**
 * Convert hierarchy array to dot-separated path string.
 * @internal
 */
type HierarchyToPath<$Hierarchy extends readonly string[]> = $Hierarchy extends readonly [
  infer __first__ extends string,
  ...infer __rest__ extends string[],
]
  ? __rest__ extends []
    ? `.${__first__}`
    : `.${__first__}${HierarchyToPath<__rest__>}`
  : ''

/**
 * Extract hierarchy from StaticError ERROR field and convert to path string.
 * Extracts from the ERROR field directly to get the normalized hierarchy.
 * @internal
 */
type ExtractHierarchy<$Error extends StaticError> = HierarchyToPath<$Error['ERROR_______']>

/**
 * Display an error with formatted hierarchy and context.
 *
 * Shows the error with consistent key formatting:
 * - `ERROR_______` key displays the hierarchy tuple (without readonly)
 * - All other keys are padded to 14 characters for visual alignment
 *
 * @template $Error - The StaticError to display
 *
 * @example
 * ```ts
 * interface ParseError extends StaticError<
 *   ['parse', 'param'],
 *   { input: string; message: string }
 * > {}
 *
 * type Displayed = Show<ParseError>
 * // {
 * //   ERROR_______: ['parse', 'param']
 * //   input________: string
 * //   message______: string
 * // }
 * ```
 *
 * @category Error Utilities
 */
// oxfmt-ignore
export type Show<
  $Error extends StaticError,
  ___$Context extends object = object extends $Error['CONTEXT_____'] ? {} : $Error['CONTEXT_____'],
  ___$Error extends string = ExtractHierarchy<$Error>
> =
Simplify.Top<{
  [k in keyof (
    & { ERROR_______: ___$Error }
    & ___$Context
  ) as k extends string ? PadKeyTo14<k> : k]: (
    & { ERROR_______: ___$Error }
    & ___$Context
  )[k]
}>

export type ShowOrPassthrogh<$T> = $T extends StaticError ? Show<$T> : $T

/**
 * Renders an error based on the `renderErrors` setting.
 *
 * When `renderErrors` is `true` (default), returns the full formatted error via {@link Show}.
 * When `false`, extracts just the error message string for cleaner IDE hovers.
 *
 * Uses the {@link KITZ.Ts.Error.renderErrors} setting.
 *
 * @template $Error - The StaticError to render
 *
 * @example
 * ```ts
 * interface MyError extends StaticError<['parse'], { message: 'Invalid input' }> {}
 *
 * // With renderErrors: true (default)
 * type Full = Render<MyError>
 * // { ERROR_______: ['parse'], message_______: 'Invalid input' }
 *
 * // With renderErrors: false
 * type Compact = Render<MyError>
 * // 'Invalid input'
 * ```
 *
 * @category Error Display
 */
// oxfmt-ignore
export type Render<$Error extends StaticError> =
  KITZ.Ts.Error['renderErrors'] extends false
    ? $Error['CONTEXT_____'] extends { message: infer __message__ extends string }
      ? __message__
      : Show<$Error>
    : Show<$Error>

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Unicode Symbols
//
//
//
//

/**
 * Cross mark - indicates an error or type mismatch occurred.
 * Used in error messages to denote failures or incompatibilities.
 */
export const CROSS = `✕`

/**
 * Warning sign - indicates a potential issue or cautionary note.
 * Used when types are equivalent but not structurally exact.
 */
export const WARNING = `⚠`

/**
 * Lightning bolt - indicates type coercion or transformation.
 * Used when automatic type conversions occur.
 */
export const LIGHTNING = `⚡`

/**
 * Exclusion symbol - indicates type exclusion or prohibition.
 * Used when certain types are explicitly not allowed.
 */
export const EXCLUSION = `⊘`

/**
 * Empty set - indicates an empty type or no valid values.
 * Used when a type has no inhabitants (like never in certain contexts).
 */
export const EMPTY_SET = `∅`
