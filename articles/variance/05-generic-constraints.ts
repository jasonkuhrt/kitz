/**
 * Generic Constraints: Any vs Unknown
 *
 * Shows why generic constraints often need `any` for flexibility.
 */

// ❌ Problem: Generic constraint with unknown
interface BadWrapper<T extends (...args: unknown[]) => unknown> {
  fn: T
  callCount: number
}

// Specific function types
type StringToNumber = (s: string) => number
type NumberPairToBoolean = (a: number, b: number) => boolean

// Try to use with specific functions
// @ts-expect-error - Type 'StringToNumber' does not satisfy the constraint
type BadWrapped1 = BadWrapper<StringToNumber> // Error!

// @ts-expect-error - Type 'NumberPairToBoolean' does not satisfy the constraint
type BadWrapped2 = BadWrapper<NumberPairToBoolean> // Error!

// ✅ Solution: Generic constraint with any
interface GoodWrapper<T extends (...args: any[]) => any> {
  fn: T
  callCount: number
}

// Now it works with any function type
type GoodWrapped1 = GoodWrapper<StringToNumber> // ✅ OK
type GoodWrapped2 = GoodWrapper<NumberPairToBoolean> // ✅ OK

// Implementation
function createWrapper<T extends (...args: any[]) => any>(fn: T): GoodWrapper<T> {
  let callCount = 0

  const wrapped = ((...args: Parameters<T>) => {
    callCount++
    return fn(...args)
  }) as T

  return {
    fn: wrapped,
    get callCount() {
      return callCount
    },
  }
}

// Usage with specific functions
const lengthWrapper = createWrapper((s: string) => s.length)
const sumWrapper = createWrapper((a: number, b: number) => a + b)

console.log(lengthWrapper.fn('hello')) // 5
console.log(sumWrapper.fn(3, 4)) // 7

// Complex example: Function composition
// ❌ With unknown - too restrictive
type BadCompose<A, B, C> = {
  f: (b: B) => C
  g: (a: unknown) => B // Forces g to accept unknown!
  composed: (a: A) => C
}

// ✅ With proper generics
type GoodCompose<A, B, C> = {
  f: (b: B) => C
  g: (a: A) => B
  composed: (a: A) => C
}

function compose<A, B, C>(f: (b: B) => C, g: (a: A) => B): (a: A) => C {
  return (a: A) => f(g(a))
}

// Works with any compatible functions
const parseAndDouble = compose(
  (n: number) => n * 2,
  (s: string) => parseInt(s),
)

console.log(parseAndDouble('21')) // 42

// Advanced: Conditional types with function constraints
type ExtractReturn<T> = T extends (...args: any[]) => infer R ? R : never
type ExtractParams<T> = T extends (...args: infer P) => any ? P : never

// These work because we use 'any' in the constraint
type Return1 = ExtractReturn<(s: string) => number> // number
type Params1 = ExtractParams<(a: string, b: number) => void> // [string, number]

// Practical: Event handler registry
type EventHandlers = {
  [K: string]: (...args: any[]) => void
}

const handlers: EventHandlers = {
  click: (x: number, y: number) => console.log(`Click at ${x},${y}`),
  keypress: (key: string) => console.log(`Key: ${key}`),
  resize: (width: number, height: number) => console.log(`Resize to ${width}x${height}`),
}

// Can store any function that returns void
handlers.custom = (data: { id: string }) => console.log(data.id) // ✅ Works
