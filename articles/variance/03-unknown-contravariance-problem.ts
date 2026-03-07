/**
 * The Unknown Contravariance Problem
 *
 * This demonstrates why `unknown` in parameter positions can be too restrictive
 * for generic infrastructure code.
 */

// Problem 1: Function type constraints with unknown
type Processor<T> = (value: T) => void

type StringProcessor = Processor<string>
type NumberProcessor = Processor<number>
type UnknownProcessor = Processor<unknown>

// Concrete implementations
const processString: StringProcessor = (s) => {
  console.log(`String length: ${s.length}`)
}

const processNumber: NumberProcessor = (n) => {
  console.log(`Number squared: ${n * n}`)
}

const processUnknown: UnknownProcessor = (value) => {
  // Must handle ANY possible value
  console.log(`Type: ${typeof value}`)
}

// ❌ Cannot assign specific processors to unknown processor
// @ts-expect-error - StringProcessor is not assignable to UnknownProcessor
const processor1: UnknownProcessor = processString // Error!

// @ts-expect-error - NumberProcessor is not assignable to UnknownProcessor
const processor2: UnknownProcessor = processNumber // Error!

// ✅ But can assign unknown processor to specific ones (contravariance)
const processor3: StringProcessor = processUnknown // OK!
const processor4: NumberProcessor = processUnknown // OK!

// Problem 2: Generic constraints
// ❌ Too restrictive - only accepts functions with unknown parameters
type BadGeneric<F extends (arg: unknown) => any> = {
  fn: F
  name: string
}

// @ts-expect-error - Type '(s: string) => void' is not assignable
const badExample: BadGeneric<typeof processString> = {
  // Error!
  fn: processString,
  name: 'string processor',
}

// ✅ Solution: Use any for generic constraints
type GoodGeneric<F extends (arg: any) => any> = {
  fn: F
  name: string
}

const goodExample: GoodGeneric<typeof processString> = {
  // Works!
  fn: processString,
  name: 'string processor',
}

// Problem 3: Function arrays/collections
// ❌ Cannot store specific functions
const badProcessors: Array<(x: unknown) => void> = [
  processUnknown, // ✅ OK
  // @ts-expect-error - Type '(s: string) => void' is not assignable
  processString, // Error!
  // @ts-expect-error - Type '(n: number) => void' is not assignable
  processNumber, // Error!
]

// ✅ Solution: Use any for collections
const goodProcessors: Array<(x: any) => void> = [
  processUnknown, // ✅ OK
  processString, // ✅ OK
  processNumber, // ✅ OK
]

// Problem 4: Higher-order functions
// ❌ Too restrictive
function badApply<T>(fn: (x: unknown) => T, value: any): T {
  return fn(value)
}

// @ts-expect-error - Argument of type '(s: string) => number' is not assignable
const result1 = badApply((s: string) => s.length, 'hello') // Error!

// ✅ Solution
function goodApply<T>(fn: (x: any) => T, value: any): T {
  return fn(value)
}

const result2 = goodApply((s: string) => s.length, 'hello') // Works!

// The key insight: unknown in parameter position means
// "this function MUST accept literally anything"
// which is more restrictive than we usually want
