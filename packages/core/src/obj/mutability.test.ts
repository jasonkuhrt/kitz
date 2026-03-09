import { Assert } from '#kitz/assert'
import { Obj } from '#obj'
import { Ts } from '#ts'
import { describe, expect, test } from 'vitest'

const immutableObj = Obj.toImmutable({ a: 1 })
type immutableObj = typeof immutableObj

const obj = { a: 1 }
type obj = typeof obj

const immutableArr = Obj.toImmutable([1, 2, 3])
type immutableArr = typeof immutableArr

const arr = [1, 2, 3]
type arr = typeof arr

describe('toImmutable', () => {
  test('returns frozen copy, original unchanged', () => {
    const result = Obj.toImmutable(obj)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(obj)).toBe(false)
    expect(result).not.toBe(obj)
    Assert.Type.exact.ofAs<immutableObj>().on(result)
  })

  test('works with arrays', () => {
    const result = Obj.toImmutable(arr)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(arr)).toBe(false)
    expect(result).not.toBe(arr)
    Assert.Type.exact.ofAs<immutableArr>().on(result)
  })
})

describe('toImmutableMut', () => {
  test('freezes in place and returns same reference', () => {
    const input = { a: 1 }
    const result = Obj.toImmutableMut(input)
    expect(Object.isFrozen(result)).toBe(true)
    expect(result).toBe(input)
    Assert.Type.exact.ofAs<immutableObj>().on(result)
  })
})

describe('clone', () => {
  test('frozen input: returns frozen clone', () => {
    const result = Obj.clone(immutableObj)
    expect(Object.isFrozen(result)).toBe(true)
    expect(result).not.toBe(immutableObj)
    Assert.Type.exact.ofAs<immutableObj>().on(result)
  })

  test('mutable input: returns mutable clone', () => {
    const result = Obj.clone(obj)
    expect(Object.isFrozen(result)).toBe(false)
    expect(result).not.toBe(obj)
    Assert.Type.exact.ofAs<obj>().on(result)
  })

  test('works with arrays', () => {
    const frozenResult = Obj.clone(immutableArr)
    expect(Object.isFrozen(frozenResult)).toBe(true)
    expect(frozenResult).not.toBe(immutableArr)

    const mutableResult = Obj.clone(arr)
    expect(Object.isFrozen(mutableResult)).toBe(false)
    expect(mutableResult).not.toBe(arr)
  })
})

describe('cloneToMut', () => {
  test('returns unfrozen clone, original unchanged', () => {
    const result = Obj.cloneToMut(immutableObj)
    expect(Object.isFrozen(result)).toBe(false)
    expect(Object.isFrozen(immutableObj)).toBe(true)
    expect(result).not.toBe(immutableObj)
    Assert.Type.exact.ofAs<obj>().on(result)
  })

  test('works with arrays', () => {
    const result = Obj.cloneToMut(immutableArr)
    expect(Object.isFrozen(result)).toBe(false)
    expect(Object.isFrozen(immutableArr)).toBe(true)
    expect(result).not.toBe(immutableArr)
    Assert.Type.exact.ofAs<arr>().on(result)
  })

  test('works on already mutable objects (creates clone)', () => {
    const result = Obj.cloneToMut(obj)
    expect(Object.isFrozen(result)).toBe(false)
    expect(result).not.toBe(obj)
    Assert.Type.exact.ofAs<obj>().on(result)
  })
})

describe('isImmutable', () => {
  test('runtime: detects frozen vs mutable objects', () => {
    expect(Obj.isImmutable(immutableObj)).toBe(true)
    expect(Obj.isImmutable(obj)).toBe(false)
  })

  test('type guard: narrows to Readonly type', () => {
    const input = Ts.as<obj>()
    if (Obj.isImmutable(input)) {
      Assert.Type.exact.ofAs<immutableObj>().on(input)
    }
  })

  test('type: detects readonly vs mutable types', () => {
    Assert.Type.exact.ofAs<true>().onAs<Obj.isImmutable<immutableObj>>()
    Assert.Type.exact.ofAs<false>().onAs<Obj.isImmutable<obj>>()
  })
})

describe('isMutable', () => {
  test('type: inverse of isImmutable', () => {
    Assert.Type.exact.ofAs<true>().onAs<Obj.isMutable<obj>>()
    Assert.Type.exact.ofAs<false>().onAs<Obj.isMutable<immutableObj>>()
  })
})

describe('inferImmutabilityMode', () => {
  test('returns immutable if any input is frozen', () => {
    const result = Obj.inferImmutabilityMode(immutableObj, obj)
    expect(result).toBe('immutable')
    expect(Obj.inferImmutabilityMode(obj, immutableObj)).toBe('immutable')
    expect(Obj.inferImmutabilityMode(immutableObj)).toBe('immutable')
    Assert.Type.exact.ofAs<'immutable' | 'mutable'>().on(result)
  })

  test('returns mutable only if all inputs are mutable', () => {
    expect(Obj.inferImmutabilityMode(obj, obj)).toBe('mutable')
    expect(Obj.inferImmutabilityMode(obj)).toBe('mutable')
  })
})

describe('forwardImmutability', () => {
  test('imm, mut: freezes output', () => {
    const output = { a: 1 } // fresh object (will be frozen)
    const result = Obj.forwardImmutability(immutableObj, output)
    expect(Object.isFrozen(result)).toBe(true)
    Assert.Type.exact.ofAs<immutableObj>().on(result)
  })

  test('imm, imm: returns output as-is (already frozen)', () => {
    const result = Obj.forwardImmutability(immutableObj, immutableObj)
    expect(Object.isFrozen(result)).toBe(true)
    Assert.Type.exact.ofAs<immutableObj>().on(result)
  })

  test('mut, mut: returns output as-is (not frozen)', () => {
    const input = { a: 1 } // fresh mutable object
    const result = Obj.forwardImmutability(input, input)
    expect(Object.isFrozen(result)).toBe(false)
    Assert.Type.exact.ofAs<obj>().on(result)
  })

  test('mut, imm: type error and runtime throw', () => {
    const input = { a: 1 } // fresh mutable object
    // @ts-expect-error - mutable input with immutable output is invalid
    expect(() => Obj.forwardImmutability(input, immutableObj)).toThrow(
      'forwardImmutability: mutable input with immutable output is likely a bug',
    )
  })

  test('works with arrays', () => {
    const output = [1, 2, 3] // fresh array (will be frozen)
    const result = Obj.forwardImmutability(immutableArr, output)
    expect(Object.isFrozen(result)).toBe(true)
    Assert.Type.exact.ofAs<immutableArr>().on(result)
  })
})
