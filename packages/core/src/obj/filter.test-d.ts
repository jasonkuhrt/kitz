import { Assert } from '#kitz/assert'
import { Obj } from '#obj'

const A = Assert.Type.exact.ofAs

// Test object for all tests
type TestObj = { a: string; b: number; c: boolean; d: string[] }
declare const testObj: TestObj

// Test 1: policyFilter with allow mode
{
  const result = Obj.policyFilter('allow', testObj, ['a', 'c'] as const)
  A<{ a: string; c: boolean }>().on(result)
}

// Test 2: policyFilter with deny mode
{
  const result = Obj.policyFilter('deny', testObj, ['a', 'c'] as const)
  A<{ b: number; d: string[] }>().on(result)
}

// Test 3: pick with predicate returns Partial<T>
{
  const result = Obj.pick(testObj, (key, value) => value !== 'hello')
  A<Partial<TestObj>>().on(result)

  // All properties are optional
  A<string | undefined>().on(result.a)
  A<number | undefined>().on(result.b)
  A<boolean | undefined>().on(result.c)
  A<string[] | undefined>().on(result.d)
}

// Test 4: partition type inference
{
  const result = Obj.partition(testObj, ['a', 'c'] as const)
  A<{ a: string; c: boolean }>().on(result.picked)
  A<{ b: number; d: string[] }>().on(result.omitted)
}

// Test 5: PolicyFilter type-level function
{
  type Allow = Obj.PolicyFilter<TestObj, 'a' | 'c', 'allow'>
  A<{ a: string; c: boolean }>().onAs<Allow>()

  type Deny = Obj.PolicyFilter<TestObj, 'a' | 'c', 'deny'>
  A<{ b: number; d: string[] }>().onAs<Deny>()

  type AllowEmpty = Obj.PolicyFilter<TestObj, never, 'allow'>
  A<{}>().onAs<AllowEmpty>()

  type DenyEmpty = Obj.PolicyFilter<TestObj, never, 'deny'>
  A<TestObj>().onAs<DenyEmpty>()
}

// Test 6: Edge cases
{
  // Empty object
  const empty = {}
  const allowEmpty = Obj.policyFilter('allow', empty, [])
  const denyEmpty = Obj.policyFilter('deny', empty, [])
  const pickEmpty = Obj.pick(empty, () => true)

  A<{}>().on(allowEmpty)
  A<{}>().on(denyEmpty)
  A<{}>().on(pickEmpty)

  // Single property object
  const single = { a: 1 }
  const allowSingle = Obj.policyFilter('allow', single, ['a'] as const)
  const denySingle = Obj.policyFilter('deny', single, ['a'] as const)
  const pickSingle = Obj.pick(single, () => true)

  A<{ a: number }>().on(allowSingle)
  A<{}>().on(denySingle)
  A<{ a?: number | undefined }>().on(pickSingle)
}

// Test 7: Complex nested object
{
  type ComplexObj = {
    nested: { a: string; b: number }
    array: string[]
    optional?: boolean | undefined
    readonly ro: string
  }
  const complexObj = {} as ComplexObj

  const picked = Obj.policyFilter('allow', complexObj, ['nested', 'optional'] as const)
  A<{ nested: { a: string; b: number }; optional?: boolean | undefined }>().on(picked)

  const omitted = Obj.policyFilter('deny', complexObj, ['nested', 'optional'] as const)
  A<{ array: string[]; readonly ro: string }>().on(omitted)

  const pickedFiltered = Obj.pick(complexObj, (key) => key !== 'array')
  A<Partial<ComplexObj>>().on(pickedFiltered)
}

// Test 8: Keys parameter type inference
{
  // With const assertion
  const keys1 = ['a', 'c'] as const
  const result1 = Obj.policyFilter('allow', testObj, keys1)
  A<{ a: string; c: boolean }>().on(result1)

  // Without const assertion (wider type)
  const keys2: (keyof TestObj)[] = ['a', 'c']
  const result2 = Obj.policyFilter('allow', testObj, keys2)
  // Result is a union of all possible picks
  A<Pick<TestObj, keyof TestObj>>().on(result2)
}
