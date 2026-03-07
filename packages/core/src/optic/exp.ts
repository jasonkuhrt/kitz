import { Fn } from '#fn'
import type { Ts } from '#ts'
import { Either } from 'effect'
import type { Get } from './core.js'
import type * as Array_ from './lenses/array.js'
import type * as Awaited_ from './lenses/awaited.js'
import type * as Indexed_ from './lenses/indexed.js'
import type * as Parameter1_ from './lenses/parameter1.js'
import type * as Parameter2_ from './lenses/parameter2.js'
import type * as Parameter3_ from './lenses/parameter3.js'
import type * as Parameter4_ from './lenses/parameter4.js'
import type * as Parameter5_ from './lenses/parameter5.js'
import type * as Parameters_ from './lenses/parameters.js'
import type * as Property_ from './lenses/property.js'
import type * as Returned_ from './lenses/returned.js'
import type * as Tuple_ from './lenses/tuple.js'

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
 * Error when expression syntax is invalid.
 */
export type CompileErrorInvalidSyntax<$Exp extends string> = Ts.Err.StaticError<
  ['lens', 'exp', 'invalid-syntax'],
  { message: 'Invalid lens expression syntax'; expression: $Exp }
>

/**
 * Error when expression is empty.
 */
export type CompileErrorEmpty = Ts.Err.StaticError<
  ['lens', 'exp', 'empty'],
  { message: 'Lens expression cannot be empty' }
>

/**
 * Union of all compile errors.
 */
export type CompileError<$Exp extends string = string> =
  | CompileErrorInvalidSyntax<$Exp>
  | CompileErrorEmpty

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type-Level Compile
//
//
//
//

/**
 * Compile a lens expression string into an HKT pipeline.
 *
 * Returns `Either.Right<never, [...HKTs]>` on success,
 * or `Either.Left<CompileError, never>` on failure.
 *
 * @example
 * ```ts
 * type T1 = Compile<'.user.name'>
 * // Either.Right<never, [Property.$Get<'user'>, Property.$Get<'name'>]>
 *
 * type T2 = Compile<'#'>
 * // Either.Right<never, [Awaited.$Get]>
 *
 * type T3 = Compile<'invalid'>
 * // Either.Left<CompileErrorInvalidSyntax<'invalid'>, never>
 * ```
 */
// oxfmt-ignore
export type Compile<$Exp extends string> =
  $Exp extends ''                                         ? Either.Left<CompileErrorEmpty, never> :
  [ParseExp<$Exp>] extends [never]                        ? Either.Left<CompileErrorInvalidSyntax<$Exp>, never> :
  ParseExp<$Exp> extends readonly Fn.Kind.Kind[]          ? Either.Right<never, ParseExp<$Exp>> :
                                                            Either.Left<CompileErrorInvalidSyntax<$Exp>, never>

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Parser Implementation
//
//
//
//

/**
 * Parse an expression string into an HKT pipeline.
 * Returns a tuple of HKTs on success, or `never` on parse failure.
 */
// oxfmt-ignore
type ParseExp<$Exp extends string, $Acc extends readonly Fn.Kind.Kind[] = readonly []> =
  // Empty string - done parsing
  $Exp extends ''                                                     ? $Acc :

  // Property access: .identifier
  $Exp extends `.${infer __id__}${infer __rest__}`
    ? ParseIdentifier<__id__, __rest__> extends [infer __name__ extends string, infer __remaining__ extends string]
      ? ParseExp<__remaining__, readonly [...$Acc, Property_.$Get<__name__>]>
      : never :

  // Bracket access: ['key'] or [N] or [*]
  $Exp extends `[${infer __bracket__}`
    ? ParseBracket<__bracket__> extends [infer __lens__ extends Fn.Kind.Kind, infer __remaining__ extends string]
      ? ParseExp<__remaining__, readonly [...$Acc, __lens__]>
      : never :

  // Awaited: #
  $Exp extends `#${infer __rest__}`                                   ? ParseExp<__rest__, readonly [...$Acc, Awaited_.$Get]> :

  // Returned: >
  $Exp extends `>${infer __rest__}`                                   ? ParseExp<__rest__, readonly [...$Acc, Returned_.$Get]> :

  // Parameters: () or (N)
  $Exp extends `(${infer __paren__}`
    ? ParseParameters<__paren__> extends [infer __lens__ extends Fn.Kind.Kind, infer __remaining__ extends string]
      ? ParseExp<__remaining__, readonly [...$Acc, __lens__]>
      : never :

  // Indexed: :
  $Exp extends `:${infer __rest__}`                                   ? ParseExp<__rest__, readonly [...$Acc, Indexed_.$Get]> :

  // Invalid syntax
  never

/**
 * Parse an identifier from the start of a string.
 * Returns [identifier, remaining] or never.
 */
// oxfmt-ignore
type ParseIdentifier<$Start extends string, $Rest extends string> =
  // Collect identifier characters
  CollectIdentifier<$Start, $Rest> extends [infer __id__ extends string, infer __remaining__ extends string]
    ? __id__ extends '' ? never : [__id__, __remaining__]
    : never

/**
 * Collect identifier characters until a delimiter is reached.
 */
// oxfmt-ignore
type CollectIdentifier<$First extends string, $Rest extends string, $Acc extends string = ''> =
  // Check first character
  $First extends ''                       ? [`${$Acc}`, $Rest] :
  $First extends '.'                      ? [`${$Acc}`, `.${$Rest}`] :
  $First extends '['                      ? [`${$Acc}`, `[${$Rest}`] :
  $First extends '#'                      ? [`${$Acc}`, `#${$Rest}`] :
  $First extends '>'                      ? [`${$Acc}`, `>${$Rest}`] :
  $First extends '('                      ? [`${$Acc}`, `(${$Rest}`] :
  $First extends ':'                      ? [`${$Acc}`, `:${$Rest}`] :
  // Continue collecting from rest
  $Rest extends `${infer __next__}${infer __remaining__}`
    ? CollectIdentifier<__next__, __remaining__, `${$Acc}${$First}`>
    : [`${$Acc}${$First}`, '']

/**
 * Parse bracket content: ['key'], [N], or []
 */
// oxfmt-ignore
type ParseBracket<$Content extends string> =
  // Array element type: ] (empty bracket)
  $Content extends `]${infer __rest__}`                               ? [Array_.$Get, __rest__] :

  // Quoted property: 'key'] or "key"]
  $Content extends `'${infer __key__}']${infer __rest__}`             ? [Property_.$Get<__key__>, __rest__] :
  $Content extends `"${infer __key__}"]${infer __rest__}`             ? [Property_.$Get<__key__>, __rest__] :

  // Numeric index: N]
  $Content extends `${infer __idx__}]${infer __rest__}`
    ? ParseNumber<__idx__> extends infer __num__ extends number
      ? [Tuple_.$Get<__num__>, __rest__]
      : never :

  never

/**
 * Parse a number string into a number literal type.
 */
// oxfmt-ignore
type ParseNumber<$S extends string> =
  $S extends `${infer __num__ extends number}` ? __num__ : never

/**
 * Parse parameter access: ) or N)
 */
// oxfmt-ignore
type ParseParameters<$Content extends string> =
  // All parameters: )
  $Content extends `)${infer __rest__}`                               ? [Parameters_.$Get, __rest__] :

  // Indexed parameter: N)
  $Content extends `0)${infer __rest__}`                              ? [Parameter1_.$Get, __rest__] :
  $Content extends `1)${infer __rest__}`                              ? [Parameter2_.$Get, __rest__] :
  $Content extends `2)${infer __rest__}`                              ? [Parameter3_.$Get, __rest__] :
  $Content extends `3)${infer __rest__}`                              ? [Parameter4_.$Get, __rest__] :
  $Content extends `4)${infer __rest__}`                              ? [Parameter5_.$Get, __rest__] :

  never

/**
 * Type of a compiled HKT pipeline.
 */
export type CompiledPipeline = readonly Fn.Kind.Kind[]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Runtime Compile
//
//
//
//

/**
 * Runtime representation of a compiled lens.
 */
export type CompiledLens = {
  readonly get: (value: unknown) => unknown
}

/**
 * Runtime compile error.
 */
export interface RuntimeCompileError {
  readonly _tag: 'CompileError'
  readonly message: string
  readonly expression: string
}

/**
 * Compile a lens expression string into a runtime lens function.
 *
 * Returns `Either.Right` with a compiled lens on success,
 * or `Either.Left` with an error on failure.
 *
 * @example
 * ```ts
 * const result = compile('.user.name')
 * if (Either.isRight(result)) {
 *   const lens = result.right
 *   lens.get({ user: { name: 'Alice' } }) // 'Alice'
 * }
 * ```
 */
// oxfmt-ignore
export type CompileResult<$Exp extends string> =
  Compile<$Exp> extends Either.Left<infer __error__, never>   ? Either.Left<__error__, never> :
  Compile<$Exp> extends Either.Right<never, infer _>          ? Either.Right<never, CompiledLens> :
                                                                never

export const compile = <$expression extends string>(
  expression: $expression,
): CompileResult<$expression> => {
  if (expression === '') {
    return Either.left({
      _tag: 'CompileError',
      message: 'Lens expression cannot be empty',
      expression,
    }) as any
  }

  const getters: Array<(v: unknown) => unknown> = []
  let remaining: string = expression

  while (remaining.length > 0) {
    const parsed = parseNextSegment(remaining)
    if (parsed === null) {
      return Either.left({
        _tag: 'CompileError',
        message: `Invalid lens expression syntax at: ${remaining}`,
        expression,
      }) as any
    }
    getters.push(parsed.getter)
    remaining = parsed.remaining
  }

  const composedGet = (value: unknown): unknown => {
    let result = value
    for (const getter of getters) {
      result = getter(result)
    }
    return result
  }

  return Either.right({ get: composedGet }) as any
}

type ParsedSegment = { getter: (v: unknown) => unknown; remaining: string }

const parseNextSegment = (exp: string): ParsedSegment | null => {
  // Property access: .identifier
  if (exp.startsWith('.')) {
    const rest = exp.slice(1)
    const match = rest.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/)
    if (match && match[1]) {
      const key = match[1]
      return {
        getter: (v: unknown) => (v as any)[key],
        remaining: rest.slice(key.length),
      }
    }
    return null
  }

  // Bracket access: ['key'], ["key"], [N]
  if (exp.startsWith('[')) {
    const rest = exp.slice(1)

    // Single-quoted property: 'key']
    const singleQuoteMatch = rest.match(/^'([^']*)'\]/)
    if (singleQuoteMatch && singleQuoteMatch[1] !== undefined) {
      const key = singleQuoteMatch[1]
      return {
        getter: (v: unknown) => (v as any)[key],
        remaining: rest.slice(singleQuoteMatch[0].length),
      }
    }

    // Double-quoted property: "key"]
    const doubleQuoteMatch = rest.match(/^"([^"]*)"\]/)
    if (doubleQuoteMatch && doubleQuoteMatch[1] !== undefined) {
      const key = doubleQuoteMatch[1]
      return {
        getter: (v: unknown) => (v as any)[key],
        remaining: rest.slice(doubleQuoteMatch[0].length),
      }
    }

    // Numeric index: N]
    const numMatch = rest.match(/^(\d+)\]/)
    if (numMatch && numMatch[1]) {
      const idx = parseInt(numMatch[1], 10)
      return {
        getter: (v: unknown) => (v as any)[idx],
        remaining: rest.slice(numMatch[0].length),
      }
    }

    // Type-only syntax [] is rejected at value level
    return null
  }

  // Type-only syntax (#, >, (), :) rejected at value level

  return null
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • High-Level API
//
//
//
//

/**
 * Get a value from a data structure using a lens expression.
 *
 * @example
 * ```ts
 * const city = Lens.get('.user.address.city', data)
 * ```
 */
export const get = <$Exp extends string, $Data>(
  expression: $Exp,
  data: $Data,
): Get<$Exp, $Data> => {
  const compiled = compile(expression)
  if (Either.isLeft(compiled)) {
    throw new Error(`Lens compile error: ${(compiled.left as RuntimeCompileError).message}`)
  }
  return compiled.right.get(data) as any
}

/**
 * Curried getter - expression first, then data.
 * Ideal for functor map pipelines.
 *
 * @example
 * ```ts
 * const getCity = Lens.getWith('.user.address.city')
 * const city = getCity(data)
 *
 * // In pipelines
 * users.map(Lens.getWith('.address.city'))
 * ```
 */
export const getWith: {
  <$Exp extends string>(expression: $Exp): <$Data>(data: $Data) => Get<$Exp, $Data>
} = Fn.curry(get) as any

/**
 * Curried getter - data first, then expression.
 * Useful when binding to an object and extracting multiple paths.
 *
 * @example
 * ```ts
 * const fromUser = Lens.getOn(user)
 * const name = fromUser('.name')
 * const city = fromUser('.address.city')
 * ```
 */
export const getOn: {
  <$Data>(data: $Data): <$Exp extends string>(expression: $Exp) => Get<$Exp, $Data>
} = Fn.flipCurried(Fn.curry(get)) as any
