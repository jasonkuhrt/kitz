import { Assert } from '#kitz/assert'
import { test } from 'vitest'
import { fn0p, fn1p, fn1pOptional, fn2p, fn2pOptional, fn3p } from './_test.js'
import { curry } from './curry.js'

const A = Assert.Type.exact.ofAs

test('cannot curry non-function', () => {
  // @ts-expect-error
  curry(0)
})

test('cannot curry 0 parameter function', () => {
  // @ts-expect-error
  curry(fn0p)
})

test('type checks', () => {
  A<(arg: number) => void>().on(curry(fn1p))
  A<(arg: number) => (arg2: string) => void>().on(curry(fn2p))
  A<(arg: number) => (arg2: string) => (arg3: boolean) => void>().on(curry(fn3p))
  A<(arg?: number | undefined) => void>().on(curry(fn1pOptional))
  A<(arg1?: number | undefined) => (arg2?: string | undefined) => void>().on(curry(fn2pOptional))
})
