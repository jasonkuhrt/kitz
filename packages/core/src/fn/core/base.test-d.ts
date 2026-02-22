import { Assert } from '#kitz/assert'
import { describe, test } from 'vitest'
import { _, fn1p, fn2p } from './_test.js'
import { bind } from './base.js'

const A = Assert.Type.exact.ofAs

describe('bind', () => {
  test('fn must have parameters', () => {
    bind(
      // @ts-expect-error
      fnNoParameters,
      _,
    )
  })
  test('binding parameters must match fn types', () => {
    bind(
      fn1p,
      // @ts-expect-error
      'invalid',
    )
  })
  test('bound fn invocation type checks', () => {
    A<() => void>().on(bind(fn1p, 1))
    A<(arg2: string) => void>().on(bind(fn2p, 1))
  })
})
