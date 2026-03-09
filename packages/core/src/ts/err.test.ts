import { attest } from '@ark/attest'
import { test } from 'vitest'
import type * as Err from './err.js'

test('Show - formats error with padded keys', () => {
  interface E extends Err.StaticError<
    ['parse', 'param'],
    { message: 'Invalid param'; input: string }
  > {}
  attest({} as Err.Show<E>).type.toString.snap(`{
  ERROR_________: ".parse.param"
  message_______: "Invalid param"
  input_________: string
}`)
})

test('Show - strips readonly from hierarchy', () => {
  interface E extends Err.StaticError<['domain'], { message: 'Error' }> {}
  attest({} as Err.Show<E>).type.toString.snap(`{
  ERROR_________: ".domain"
  message_______: "Error"
}`)
})

test('Is - detects StaticError', () => {
  interface MyError extends Err.StaticError<['test']> {}
  type _result = Err.Is<MyError>
  attest<_result>(true as _result).equals(true)
})

test('Is - rejects non-error', () => {
  type _result = Err.Is<string>
  attest<_result>(false as _result).equals(false)
})
