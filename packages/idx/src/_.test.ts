import { describe, expect, test } from 'vitest'
import * as IdxModule from './_.js'
import { create, fromArray, Mode } from './idx.js'

describe('idx', () => {
  test('exports the Idx namespace', () => {
    expect(IdxModule.Idx.create).toBe(create)
    expect(IdxModule.Idx.fromArray).toBe(fromArray)
    expect(IdxModule.Idx.Mode).toBe(Mode)
  })

  test('stores primitive keys and compacts arrays after deletion', () => {
    const index = create<number, number>()

    expect(index.toMap()).toEqual(new Map())

    index.set(1)
    index.set(2)
    index.set(3)

    expect(index.get(2)).toBe(2)
    expect(index.getAt(3)).toBe(3)
    expect(index.delete(2)).toBe(true)
    expect(index.delete(2)).toBe(false)
    expect(index.toArray()).toEqual([1, 3])
    expect([...index.toMap().entries()]).toEqual([
      [1, 1],
      [3, 3],
    ])
  })

  test('supports explicit key functions and in-place replacement', () => {
    const index = create<{ id: number; name: string }, number>({
      key: (item) => item.id,
      mode: Mode.strong,
    })
    const alice = { id: 1, name: 'alice' }
    const aliceUpdated = { id: 1, name: 'alice-updated' }

    index.set(alice)
    index.set(aliceUpdated)
    index.setAt(2, { id: 2, name: 'bob' })

    expect(index.get(alice)).toEqual(aliceUpdated)
    expect(index.getAt(1)).toEqual(aliceUpdated)
    expect(index.deleteAt(2)).toBe(true)
    expect(index.toArray()).toEqual([aliceUpdated])
  })

  test('supports keyed construction from arrays', () => {
    const first = { id: 1 }
    const second = { id: 2 }
    const index = fromArray([first, second], { key: (item) => item.id })

    expect(index.get(first)).toBe(first)
    expect(index.getAt(2)).toBe(second)
    expect(index.toMap().get(1)).toBe(first)
    expect(index.deleteAt(1)).toBe(true)
    expect(index.toArray()).toEqual([second])
  })

  test('supports explicit weak storage mode for object keys', () => {
    const firstKey = { id: 1 }
    const secondKey = { id: 2 }
    const index = create<{ key: object; name: string }, object>({
      key: (item) => item.key,
      mode: Mode.weak,
    })

    index.set({ key: firstKey, name: 'first' })
    index.setAt(secondKey, { key: secondKey, name: 'second' })

    expect(index.getAt(firstKey)).toEqual({ key: firstKey, name: 'first' })
    expect(index.toMap().get(secondKey)).toEqual({ key: secondKey, name: 'second' })
  })
})
