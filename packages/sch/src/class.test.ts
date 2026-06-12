import { Effect, Option, Result, Schema as S } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Class, TaggedClass } from './class.js'

class Order extends Class<Order>()('Order', {
  id: S.String,
  amount: S.Number,
}) {
  get doubled() {
    return this.amount * 2
  }
}

class Event extends TaggedClass<Event>()('Event', {
  name: S.String,
}) {}

describe('Class', () => {
  test('constructs and validates like Schema.Class', () => {
    const order = new Order({ id: 'a', amount: 2 })
    expect(order.id).toBe('a')
    expect(Order.make({ id: 'b', amount: 3 }).amount).toBe(3)
  })

  test('is narrows on instances and rejects non-matching values', () => {
    expect(Order.is(new Order({ id: 'a', amount: 2 }))).toBe(true)
    expect(Order.is({ id: 'a' })).toBe(false)
  })

  test('decode constructs instances of the final class, preserving members', () => {
    const order = Order.decodeSync({ id: 'a', amount: 21 })
    expect(order).toBeInstanceOf(Order)
    expect(order.doubled).toBe(42)
  })

  test('decode is effectful and typed', async () => {
    const order = await Effect.runPromise(Order.decode({ id: 'a', amount: 1 }))
    expect(order).toBeInstanceOf(Order)
    const failure = await Effect.runPromise(Effect.option(Order.decode({ id: 1 })))
    expect(Option.isNone(failure)).toBe(true)
  })

  test('encode roundtrips with decode', () => {
    const order = Order.decodeSync({ id: 'a', amount: 1 })
    expect(Order.decodeSync(Order.encodeSync(order))).toEqual(order)
  })

  test('equals compares by fields', () => {
    expect(Order.equals(new Order({ id: 'a', amount: 1 }), new Order({ id: 'a', amount: 1 }))).toBe(
      true,
    )
    expect(Order.equals(new Order({ id: 'a', amount: 1 }), new Order({ id: 'a', amount: 2 }))).toBe(
      false,
    )
  })

  test('decodeResult and encodeResult return Result values', () => {
    expect(Result.isSuccess(Order.decodeResult({ id: 'a', amount: 1 }))).toBe(true)
    expect(Result.isFailure(Order.decodeResult({ id: 1 }))).toBe(true)
    const order = Order.decodeSync({ id: 'a', amount: 1 })
    expect(Result.isSuccess(Order.encodeResult(order))).toBe(true)
  })

  test('$ is the class itself, usable in expression positions', () => {
    expect(Order.$).toBe(Order)
  })

  test('derivations are memoized per class', () => {
    expect(Order.decodeSync).toBe(Order.decodeSync)
    expect(Order.is).toBe(Order.is)
  })
})

describe('TaggedClass', () => {
  test('exposes the tag literal as a static', () => {
    expect(Event._tag).toBe('Event')
  })

  test('carries the _tag literal through construction and decode', () => {
    const event = new Event({ name: 'created' })
    expect(event._tag).toBe('Event')
    const decoded = Event.decodeSync({ _tag: 'Event', name: 'created' })
    expect(decoded).toBeInstanceOf(Event)
    expect(Event.is(decoded)).toBe(true)
  })

  test('rejects a wrong tag', () => {
    expect(Event.is({ _tag: 'Other', name: 'x' })).toBe(false)
  })
})
