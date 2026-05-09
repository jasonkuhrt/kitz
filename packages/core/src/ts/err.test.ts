import { Assert } from '#kitz/assert'
import { expect, test } from 'bun:test'
import type * as Err from './err.js'

test('Show - formats error with padded keys', () => {
  interface E extends Err.StaticError<
    ['parse', 'param'],
    { message: 'Invalid param'; input: string }
  > {}
  type Expected = {
    ERROR_________: '.parse.param'
    message_______: 'Invalid param'
    input_________: string
  }
  Assert.exact.ofAs<Expected>().onAs<Err.Show<E>>()
})

test('Show - strips readonly from hierarchy', () => {
  interface E extends Err.StaticError<['domain'], { message: 'Error' }> {}
  type Expected = {
    ERROR_________: '.domain'
    message_______: 'Error'
  }
  Assert.exact.ofAs<Expected>().onAs<Err.Show<E>>()
})

test('Is - detects StaticError', () => {
  interface MyError extends Err.StaticError<['test']> {}
  type _result = Err.Is<MyError>
  Assert.exact.ofAs<true>().onAs<_result>()
  expect(true as _result).toBe(true)
})

test('Is - rejects non-error', () => {
  type _result = Err.Is<string>
  Assert.exact.ofAs<false>().onAs<_result>()
  expect(false as _result).toBe(false)
})
