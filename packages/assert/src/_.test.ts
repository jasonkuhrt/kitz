import { describe, expect, test } from 'vitest'
import * as AssertNamespace from './_.js'
import * as Assert from './__.js'
import { builder } from './builder-singleton.js'

describe('assert', () => {
  test('exports the recursive assertion builder namespace', () => {
    expect(AssertNamespace.Assert.any).toBe(Assert.any)
    expect(Assert.any).toBe(builder.any)
    expect(Assert.unknown).toBe(builder.unknown)
    expect(Assert.never).toBe(builder.never)
    expect(Assert.empty).toBe(builder.empty)
    expect(Assert.on).toBe(builder.on)
    expect(Assert.onAs).toBe(builder.onAs)
    expect(Assert.inferNarrow).toBe(builder.inferNarrow)
    expect(Assert.inferWide).toBe(builder.inferWide)
    expect(Assert.inferAuto).toBe(builder.inferAuto)
  })

  test('allows calling unary, binary, and extractor-driven assertion chains at runtime', () => {
    expect(Assert.any('value')).toBe(builder)
    expect(Assert.unknown({ value: true })).toBe(builder)
    expect(Assert.never(undefined)).toBe(builder)
    expect(Assert.empty([])).toBe(builder)
    expect(Assert.on({ value: 1 }).exact.string('text')).toBe(builder)
    expect(Assert.onAs<string>().equiv.number(1)).toBe(builder)
    expect(Assert.exact.of<string, string>('expected')('actual')).toBe(builder)
    expect(Assert.sub.of<number, number>(1)(2)).toBe(builder)
    expect(Assert.equiv.of<boolean, boolean>(true)(false)).toBe(builder)
    expect(Assert.not.exact.number(1)).toBe(builder)
    expect(Assert.array.exact.of<string[], string[]>(['a'])(['b'])).toBe(builder)
    expect(Assert.awaited.sub.of<Promise<string>, Promise<string>>(Promise.resolve('a'))).toBe(
      builder,
    )
    expect(Assert.returned.equiv.of<() => number, () => number>(() => 1)(() => 2)).toBe(builder)
    expect(
      Assert.parameter1.exact.of<(value: string) => void, (value: string) => void>(() => {}),
    ).toBe(builder)
    expect(
      Assert.parameters.sub.of<(a: string, b: number) => void, (a: string, b: number) => void>(
        () => {},
      ),
    ).toBe(builder)
  })

  test('supports builder settings helpers and nested namespaces', () => {
    expect(Assert.setInfer('auto')).toBe(builder)
    expect(Assert.extract('value')).toBe(builder)
    expect(
      Assert.parameter2.not.exact.of<
        (a: string, b: number) => void,
        (a: string, b: number) => void
      >(() => {}),
    ).toBe(builder)
    expect(
      Assert.parameter3.sub.of<
        (a: string, b: number, c: boolean) => void,
        (a: string, b: number, c: boolean) => void
      >(() => {}),
    ).toBe(builder)
    expect(
      Assert.parameter4.equiv.of<
        (a: string, b: number, c: boolean, d: bigint) => void,
        (a: string, b: number, c: boolean, d: bigint) => void
      >(() => {}),
    ).toBe(builder)
    expect(
      Assert.parameter5.not.sub.of<
        (a: string, b: number, c: boolean, d: bigint, e: symbol) => void,
        (a: string, b: number, c: boolean, d: bigint, e: symbol) => void
      >(() => {}),
    ).toBe(builder)
    expect(Assert.array.not.equiv.of<string[], string[]>(['a'])(['b'])).toBe(builder)
    expect(Assert.awaited.not.exact.of<Promise<number>, Promise<number>>(Promise.resolve(1))).toBe(
      builder,
    )
    expect(Assert.returned.not.sub.of<() => string, () => string>(() => 'value')).toBe(builder)
  })
})
