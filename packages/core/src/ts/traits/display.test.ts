import { Type as A } from '#kitz/assert/assert'
import { Ts } from '#ts'
import { describe, test } from 'vitest'

// Alias for Ts.Display to make test cases less verbose
type D<T, Fallback extends string | undefined = undefined> = Ts.Display<T, Fallback>

describe('Primitives and Literals', () => {
  test('string', () => {
    A.exact.ofAs<'string'>().onAs<D<string>>()
    A.exact.ofAs<"'hello'">().onAs<D<'hello'>>()
    // todo: should use template literal backticks instead actually
    A.exact.ofAs<`'template${string}'`>().onAs<D<`template${string}`>>()
  })

  test('number', () => {
    A.exact.ofAs<'number'>().onAs<D<number>>()
    A.exact.ofAs<'123'>().onAs<D<123>>()
    A.exact.ofAs<'0.5'>().onAs<D<0.5>>()
    A.exact.ofAs<'-10'>().onAs<D<-10>>()
  })

  test('boolean', () => {
    A.exact.ofAs<'boolean'>().onAs<D<boolean>>()
    A.exact.ofAs<'true'>().onAs<D<true>>()
    A.exact.ofAs<'false'>().onAs<D<false>>()
  })

  test('bigint', () => {
    A.exact.ofAs<'bigint'>().onAs<D<bigint>>()
    A.exact.ofAs<'100n'>().onAs<D<100n>>()
    A.exact.ofAs<'-20n'>().onAs<D<-20n>>()
  })

  test('null and undefined', () => {
    A.exact.ofAs<'null'>().onAs<D<null>>()
    A.exact.ofAs<'undefined'>().onAs<D<undefined>>()
  })

  test('symbol', () => {
    A.exact.ofAs<'symbol'>().onAs<D<symbol>>()
    const mySymbol = Symbol('description')
    type MySymbolType = typeof mySymbol
    A.exact.ofAs<'symbol'>().onAs<D<MySymbolType>>() // Description is not part of the type string
  })
})

describe('Common Object Types', () => {
  test('Promise', () => {
    A.exact.ofAs<'Promise<any>'>().onAs<D<Promise<any>>>()
    A.exact.ofAs<'Promise<string>'>().onAs<D<Promise<string>>>()
    A.exact.ofAs<'Promise<number>'>().onAs<D<Promise<number>>>()
    A.exact.ofAs<'Promise<undefined>'>().onAs<D<Promise<undefined>>>()
    A.exact.ofAs<'Promise<void>'>().onAs<D<Promise<void>>>()
  })

  test('Array', () => {
    A.exact.ofAs<'Array<any>'>().onAs<D<any[]>>()
    A.exact.ofAs<'Array<unknown>'>().onAs<D<unknown[]>>() // unknown is not any
    A.exact.ofAs<'ReadonlyArray<Date>'>().onAs<D<readonly Date[]>>()
    // todo: tuples
    // A.exact.ofAs<'ReadonlyArray<Date,RegExp>'>().onAs<Display<readonly [Date, RegExp]>>()
  })

  test('Date', () => {
    A.exact.ofAs<'Date'>().onAs<D<Date>>()
  })

  test('RegExp', () => {
    A.exact.ofAs<'RegExp'>().onAs<D<RegExp>>()
  })

  test('Function', () => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    A.exact.ofAs<'Function'>().onAs<D<Function>>()
    A.exact.ofAs<'Function'>().onAs<D<() => void>>()
    A.exact.ofAs<'Function'>().onAs<D<(a: string, b: number) => boolean>>()
    class MyClass {
      method() {}
    }
    A.exact.ofAs<'Function'>().onAs<D<typeof MyClass>>() // Class constructor
    A.exact.ofAs<'Function'>().onAs<D<MyClass['method']>>()
  })
})

describe('General Object, any, unknown, never, and Fallbacks', () => {
  test('object', () => {
    A.exact.ofAs<'object'>().onAs<D<object>>()
    A.exact.ofAs<'object'>().onAs<D<{ a: number }>>()
    A.exact.ofAs<'object'>().onAs<D<Record<string, any>>>()
    A.exact.ofAs<'object'>().onAs<D<NonNullable<unknown>>>() // NonNullable<unknown> is {}
  })
  test('unknown', () => {
    A.exact.ofAs<'unknown'>().onAs<D<unknown>>()
  })
  test('never', () => {
    A.exact.ofAs<'never'>().onAs<D<never>>()
  })
})

describe('Union Types', () => {
  test('union of primitives', () => {
    // union order is not deterministic so we have to be a bit loose here.
    A.sub.ofAs<'number | null' | 'null | number'>().onAs<D<number | null>>()
  })

  test('union including any, unknown, never', () => {
    A.exact.ofAs<'any'>().onAs<D<any | 'literal'>>() // any overtakes literal
    A.exact.ofAs<'unknown'>().onAs<D<unknown | 'literal'>>() // unknown overtakes literal
    A.exact.ofAs<"'literal'">().onAs<D<never | 'literal'>>() // never is dropped from unions
  })
})

// Custom type for extensibility testing
interface Box<T> {
  __brand: 'Box'
  value: T
}

// Register custom Handler via declaration merging
// This demonstrates how users can extend Display for their own types
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      _testBox: $Type extends Box<infer __value__> ? `Box<${D<__value__>}>` : never
    }
  }
}

describe('Display Handlers Extensibility', () => {
  test('custom types can be registered via Handlers', () => {
    // The Box handler above demonstrates the extensibility pattern
    // In real usage, users would augment in a .d.ts file
    A.exact.ofAs<'Box<string>'>().onAs<D<Box<string>>>()
    A.exact.ofAs<'Box<number>'>().onAs<D<Box<number>>>()
    A.exact.ofAs<'Box<Array<boolean>>'>().onAs<D<Box<boolean[]>>>()
  })

  test('without handler, custom types fall back to object', () => {
    // Type without a registered handler
    interface Unregistered {
      foo: string
    }
    A.exact.ofAs<'object'>().onAs<D<Unregistered>>()
  })
})

describe('Fallback Parameter', () => {
  test('fallback with non-primitive types', () => {
    A.exact.ofAs<'CustomObject'>().onAs<D<{ x: 1 }, 'CustomObject'>>()
    A.exact.ofAs<'CustomDate'>().onAs<D<Date, 'CustomDate'>>()
    A.exact.ofAs<'CustomPromise'>().onAs<D<Promise<string>, 'CustomPromise'>>()
    A.exact.ofAs<'CustomArray'>().onAs<D<any[], 'CustomArray'>>()
  })

  test('fallback is ignored for primitive types', () => {
    A.exact.ofAs<'string'>().onAs<D<string, 'CustomString'>>()
    A.exact.ofAs<'123'>().onAs<D<123, 'CustomNumber'>>()
    A.exact.ofAs<'true'>().onAs<D<true, 'CustomBoolean'>>()
    A.exact.ofAs<'100n'>().onAs<D<100n, 'CustomBigInt'>>()
    A.exact.ofAs<'null'>().onAs<D<null, 'CustomNull'>>()
    A.exact.ofAs<'undefined'>().onAs<D<undefined, 'CustomUndefined'>>()
  })

  test('fallback with object', () => {
    A.exact.ofAs<'FallbackForUnknown'>().onAs<D<{ a: 1 }, 'FallbackForUnknown'>>()
  })
})
