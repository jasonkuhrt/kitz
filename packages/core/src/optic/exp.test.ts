import { Assert } from '#kitz/assert'
import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  type Compile,
  compile,
  type CompileError,
  type CompileErrorEmpty,
  type CompileErrorInvalidSyntax,
} from './exp.js'
import type * as Array from './lenses/array.js'
import type * as Awaited from './lenses/awaited.js'
import type * as Indexed from './lenses/indexed.js'
import type * as Parameter1 from './lenses/parameter1.js'
import type * as Parameters from './lenses/parameters.js'
import type * as Property from './lenses/property.js'
import type * as Returned from './lenses/returned.js'
import type * as Tuple from './lenses/tuple.js'

const A = Assert.Type

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Property Access
//

describe('property access', () => {
  test('.name', () => {
    const result = compile('.name')
    expect(Result.isSuccess(result)).toBe(true)
    A.exact.ofAs<Result.Success<never, readonly [Property.$Get<'name'>]>>().onAs<Compile<'.name'>>()
  })

  test('.user.address.city', () => {
    const result = compile('.user.address.city')
    expect(Result.isSuccess(result)).toBe(true)
    A.exact
      .ofAs<
        Result.Success<
          never,
          readonly [Property.$Get<'user'>, Property.$Get<'address'>, Property.$Get<'city'>]
        >
      >()
      .onAs<Compile<'.user.address.city'>>()
  })

  test("['weird.name']", () => {
    const result = compile("['weird.name']")
    expect(Result.isSuccess(result)).toBe(true)
    A.exact
      .ofAs<Result.Success<never, readonly [Property.$Get<'weird.name'>]>>()
      .onAs<Compile<"['weird.name']">>()
  })

  test(".user['my.key'].value", () => {
    const result = compile(".user['my.key'].value")
    expect(Result.isSuccess(result)).toBe(true)
    A.exact
      .ofAs<
        Result.Success<
          never,
          readonly [Property.$Get<'user'>, Property.$Get<'my.key'>, Property.$Get<'value'>]
        >
      >()
      .onAs<Compile<".user['my.key'].value">>()
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Awaited (#) - Type-Level Only
//

describe('awaited (#) - type-level only', () => {
  test('# type-level compiles', () => {
    A.exact.ofAs<Result.Success<never, readonly [Awaited.$Get]>>().onAs<Compile<'#'>>()
  })

  test('.data# type-level compiles', () => {
    A.exact
      .ofAs<Result.Success<never, readonly [Property.$Get<'data'>, Awaited.$Get]>>()
      .onAs<Compile<'.data#'>>()
  })

  test('# rejected at value-level', () => {
    const result = compile('#')
    expect(Result.isFailure(result)).toBe(true)
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Returned (>) - Type-Level Only
//

describe('returned (>) - type-level only', () => {
  test('> type-level compiles', () => {
    A.exact.ofAs<Result.Success<never, readonly [Returned.$Get]>>().onAs<Compile<'>'>>()
  })

  test('># type-level compiles', () => {
    A.exact
      .ofAs<Result.Success<never, readonly [Returned.$Get, Awaited.$Get]>>()
      .onAs<Compile<'>#'>>()
  })

  test('.handler># type-level compiles', () => {
    A.exact
      .ofAs<
        Result.Success<never, readonly [Property.$Get<'handler'>, Returned.$Get, Awaited.$Get]>
      >()
      .onAs<Compile<'.handler>#'>>()
  })

  test('> rejected at value-level', () => {
    const result = compile('>')
    expect(Result.isFailure(result)).toBe(true)
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Parameters - Type-Level Only
//

describe('parameters - type-level only', () => {
  test('() type-level compiles', () => {
    A.exact.ofAs<Result.Success<never, readonly [Parameters.$Get]>>().onAs<Compile<'()'>>()
  })

  test('(0) type-level compiles', () => {
    A.exact.ofAs<Result.Success<never, readonly [Parameter1.$Get]>>().onAs<Compile<'(0)'>>()
  })

  test('>(0) type-level compiles', () => {
    A.exact
      .ofAs<Result.Success<never, readonly [Returned.$Get, Parameter1.$Get]>>()
      .onAs<Compile<'>(0)'>>()
  })

  test('() rejected at value-level', () => {
    const result = compile('()')
    expect(Result.isFailure(result)).toBe(true)
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Array ([]) - Type-Level Only
//

describe('array ([]) - type-level only', () => {
  test('[] type-level compiles', () => {
    A.exact.ofAs<Result.Success<never, readonly [Array.$Get]>>().onAs<Compile<'[]'>>()
  })

  test('.items[] type-level compiles', () => {
    A.exact
      .ofAs<Result.Success<never, readonly [Property.$Get<'items'>, Array.$Get]>>()
      .onAs<Compile<'.items[]'>>()
  })

  test('[] rejected at value-level', () => {
    const result = compile('[]')
    expect(Result.isFailure(result)).toBe(true)
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Tuple ([N])
//

describe('tuple ([N])', () => {
  test('[0]', () => {
    const result = compile('[0]')
    expect(Result.isSuccess(result)).toBe(true)
    A.exact.ofAs<Result.Success<never, readonly [Tuple.$Get<0>]>>().onAs<Compile<'[0]'>>()
  })

  test('[2]', () => {
    const result = compile('[2]')
    expect(Result.isSuccess(result)).toBe(true)
    A.exact.ofAs<Result.Success<never, readonly [Tuple.$Get<2>]>>().onAs<Compile<'[2]'>>()
  })

  test('.callbacks[0]', () => {
    const result = compile('.callbacks[0]')
    expect(Result.isSuccess(result)).toBe(true)
    A.exact
      .ofAs<Result.Success<never, readonly [Property.$Get<'callbacks'>, Tuple.$Get<0>]>>()
      .onAs<Compile<'.callbacks[0]'>>()
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Indexed (:) - Type-Level Only
//

describe('indexed (:) - type-level only', () => {
  test(': type-level compiles', () => {
    A.exact.ofAs<Result.Success<never, readonly [Indexed.$Get]>>().onAs<Compile<':'>>()
  })

  test('.data: type-level compiles', () => {
    A.exact
      .ofAs<Result.Success<never, readonly [Property.$Get<'data'>, Indexed.$Get]>>()
      .onAs<Compile<'.data:'>>()
  })

  test(': rejected at value-level', () => {
    const result = compile(':')
    expect(Result.isFailure(result)).toBe(true)
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Complex Compositions - Type-Level Only
//

describe('complex compositions - type-level only', () => {
  test('.callbacks[0]># type-level compiles', () => {
    A.exact
      .ofAs<
        Result.Success<
          never,
          readonly [Property.$Get<'callbacks'>, Tuple.$Get<0>, Returned.$Get, Awaited.$Get]
        >
      >()
      .onAs<Compile<'.callbacks[0]>#'>>()
  })

  test('.users[].name type-level compiles', () => {
    A.exact
      .ofAs<
        Result.Success<never, readonly [Property.$Get<'users'>, Array.$Get, Property.$Get<'name'>]>
      >()
      .onAs<Compile<'.users[].name'>>()
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Error Cases
//

describe('error cases', () => {
  test('empty string', () => {
    const result = compile('')
    expect(Result.isFailure(result)).toBe(true)
    A.exact.ofAs<Result.Failure<CompileErrorEmpty, never>>().on(result)
  })

  test('invalid syntax: no leading dot', () => {
    const result = compile('invalid')
    expect(Result.isFailure(result)).toBe(true)
    A.sub.ofAs<Result.Failure<CompileErrorInvalidSyntax<'invalid'>, never>>().on(result)
  })

  test('invalid syntax: double dot', () => {
    const result = compile('..')
    expect(Result.isFailure(result)).toBe(true)
    A.sub.ofAs<Result.Failure<CompileErrorInvalidSyntax<'..'>, never>>().on(result)
  })

  test('invalid syntax: unclosed bracket', () => {
    const result = compile('[0')
    expect(Result.isFailure(result)).toBe(true)
    A.sub.ofAs<Result.Failure<CompileErrorInvalidSyntax<'[0'>, never>>().on(result)
  })
})
