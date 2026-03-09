import { Assert } from '#kitz/assert'
import { Optic } from '#optic'
import { describe, expect, test } from 'vitest'

const A = Assert.Type

// Test data
const user = { name: 'Alice', address: { city: 'NYC' } }
const users = [{ name: 'Alice' }, { name: 'Bob' }]
const indexed = { data: { a: 1, b: 2 } as Record<string, number> }
const tuple = ['first', 'second'] as const

type User = typeof user
type Users = typeof users
type Indexed = typeof indexed
type Tuple = typeof tuple

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Optic.get (uncurried)
//

describe('Optic.get - uncurried', () => {
  test('.name', () => {
    const result = Optic.get('.name', user)
    expect(result).toBe('Alice')
    A.exact.ofAs<Optic.Get<'.name', User>>().on(result)
    A.exact.ofAs<string>().on(result)
  })

  test('.address.city', () => {
    const result = Optic.get('.address.city', user)
    expect(result).toBe('NYC')
    A.exact.ofAs<Optic.Get<'.address.city', User>>().on(result)
    A.exact.ofAs<string>().on(result)
  })

  test("['weird.name']", () => {
    const data = { 'weird.name': 'value' }
    const result = Optic.get("['weird.name']", data)
    expect(result).toBe('value')
    A.exact.ofAs<Optic.Get<"['weird.name']", typeof data>>().on(result)
    A.exact.ofAs<string>().on(result)
  })

  test('[0]', () => {
    const result = Optic.get('[0]', tuple)
    expect(result).toBe('first')
    A.exact.ofAs<Optic.Get<'[0]', Tuple>>().on(result)
    A.exact.ofAs<'first'>().on(result)
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Optic.getWith (curried, expression first)
//

describe('Optic.getWith - curried', () => {
  test('creates reusable getter', () => {
    const getName = Optic.getWith('.name')
    const result = getName(user)
    expect(result).toBe('Alice')
    A.exact.ofAs<string>().on(result)
  })

  test('pipeline usage', () => {
    const results = users.map(Optic.getWith('.name'))
    expect(results).toEqual(['Alice', 'Bob'])
    A.exact.ofAs<string[]>().on(results)
  })

  test('nested path', () => {
    const getCity = Optic.getWith('.address.city')
    const result = getCity(user)
    expect(result).toBe('NYC')
    A.exact.ofAs<string>().on(result)
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Optic.getOn (curried, data first)
//

describe('Optic.getOn - inverse curried', () => {
  test('binds to object for multiple extractions', () => {
    const fromUser = Optic.getOn(user)
    const name = fromUser('.name')
    const city = fromUser('.address.city')
    expect(name).toBe('Alice')
    expect(city).toBe('NYC')
    A.exact.ofAs<string>().on(name)
    A.exact.ofAs<string>().on(city)
  })

  test('tuple access', () => {
    const fromTuple = Optic.getOn(tuple)
    const first = fromTuple('[0]')
    const second = fromTuple('[1]')
    expect(first).toBe('first')
    expect(second).toBe('second')
    A.exact.ofAs<'first'>().on(first)
    A.exact.ofAs<'second'>().on(second)
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type-Level Only
//

describe('Optic.Get - type-level only', () => {
  test('.items[]', () => {
    type Result = Optic.Get<'.items[]', { items: number[] }>
    A.exact.ofAs<number>().onAs<Result>()
  })

  test('.data:', () => {
    type Result = Optic.Get<'.data:', Indexed>
    A.exact.ofAs<number>().onAs<Result>()
  })

  test('.users[].name', () => {
    type Result = Optic.Get<'.users[].name', { users: Users }>
    A.exact.ofAs<string>().onAs<Result>()
  })
})

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Static Error Detection
//

// test('value-level get rejects invalid property', () => {
//   // @ts-expect-error - .bad does not exist on User, should be caught by parameter guard
//   Optic.get('.bad', user)
// })
