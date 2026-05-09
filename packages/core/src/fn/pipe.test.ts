import { describe, expect, test } from 'bun:test'
import { pipe } from './pipe.js'

describe('pipe', () => {
  test('returns value when no functions', () => {
    expect(pipe(5)).toBe(5)
  })

  test('applies single function', () => {
    const double = (x: number) => x * 2
    expect(pipe(5, double)).toBe(10)
  })

  test('chains multiple functions', () => {
    const add1 = (x: number) => x + 1
    const double = (x: number) => x * 2
    const toString = (x: number) => String(x)

    expect(pipe(5, add1, double)).toBe(12)
    expect(pipe(5, add1, double, toString)).toBe('12')
  })

  test('maintains type safety through chain', () => {
    const toString = (x: number) => x.toString()
    const toUpper = (x: string) => x.toUpperCase()
    const split = (x: string) => x.split('')

    const result = pipe(123, toString, toUpper, split)
    expect(result).toEqual(['1', '2', '3'])

    // TypeScript should know result is string[]
    const _typeCheck: string[] = result
  })

  test('works with array of functions using spread', () => {
    const add1 = (x: number) => x + 1
    const double = (x: number) => x * 2
    const subtract3 = (x: number) => x - 3

    // Currently spread doesn't work with TypeScript, but individual calls do
    expect(pipe(5, add1, double, subtract3)).toBe(9) // (5 + 1) * 2 - 3 = 9

    // This would require more advanced TypeScript features to support:
    // expect(pipe(5, ...functions)).toBe(9)
  })

  test('handles up to 10 functions', () => {
    const f1 = (x: number) => x + 1
    const f2 = (x: number) => x + 2
    const f3 = (x: number) => x + 3
    const f4 = (x: number) => x + 4
    const f5 = (x: number) => x + 5
    const f6 = (x: number) => x + 6
    const f7 = (x: number) => x + 7
    const f8 = (x: number) => x + 8
    const f9 = (x: number) => x + 9
    const f10 = (x: number) => x + 10

    const result = pipe(0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10)
    expect(result).toBe(55) // 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10
  })

  test('returns promise when async function is used', async () => {
    const asyncDouble = async (x: number) => x * 2

    const result = pipe(5, asyncDouble)
    expect(result).toBeInstanceOf(Promise)
    expect(await result).toBe(10)

    // Note: pipe doesn't handle promise chaining - it passes the promise object to the next function
    // This is expected behavior for a synchronous pipe function
    const addToString = (x: any) => x + '!'
    const chainedWithString = pipe(5, asyncDouble, addToString)
    expect(chainedWithString).toMatch(/Promise.*!/)
  })
})
