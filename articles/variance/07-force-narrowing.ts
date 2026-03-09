/**
 * Forcing Type Narrowing with Unknown
 *
 * Shows how `unknown` forces consumers to properly handle types.
 */

// API that returns unknown to force narrowing
function parseJSON(text: string): unknown {
  return JSON.parse(text)
}

// ❌ Cannot use without narrowing
const data1 = parseJSON('{"x": 42}')
// @ts-expect-error - Object is of type 'unknown'
console.log(data1.x) // Error! Must narrow first

// ✅ Proper usage with narrowing
const data2 = parseJSON('{"x": 42}')
if (typeof data2 === 'object' && data2 !== null && 'x' in data2) {
  console.log((data2 as any).x) // OK after checking
}

// Better: Type predicate functions
interface Point {
  x: number
  y: number
}

function isPoint(value: unknown): value is Point {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    typeof (value as any).x === 'number' &&
    typeof (value as any).y === 'number'
  )
}

const data3 = parseJSON('{"x": 10, "y": 20}')
if (isPoint(data3)) {
  console.log(data3.x + data3.y) // 30 - TypeScript knows it's a Point
}

// Force handling of different cases
type Result<T> = { success: true; value: T } | { success: false; error: string }

function tryParse(input: string): Result<unknown> {
  try {
    return { success: true, value: JSON.parse(input) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// Must handle both cases
const result = tryParse('{"valid": true}')
if (result.success) {
  // result.value is unknown, must narrow
  const value = result.value
  if (typeof value === 'object' && value !== null && 'valid' in value) {
    console.log('Valid:', (value as any).valid)
  }
} else {
  console.error('Parse error:', result.error)
}

// Advanced: Schema validation pattern
interface Schema<T> {
  parse(value: unknown): T
  safeParse(value: unknown): Result<T>
  is(value: unknown): value is T
}

// Example schema for a User type
const UserSchema: Schema<User> = {
  parse(value: unknown): User {
    if (!this.is(value)) {
      throw new Error('Invalid user data')
    }
    return value
  },

  safeParse(value: unknown): Result<User> {
    try {
      return { success: true, value: this.parse(value) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  is(value: unknown): value is User {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'name' in value &&
      typeof (value as any).id === 'string' &&
      typeof (value as any).name === 'string'
    )
  },
}

interface User {
  id: string
  name: string
}

// Usage forces proper validation
const rawData = parseJSON('{"id": "123", "name": "Alice"}')
const parsed = UserSchema.safeParse(rawData)

if (parsed.success) {
  console.log(parsed.value.name) // Alice - properly typed as User
} else {
  console.error('Invalid user:', parsed.error)
}

// Pattern: Unknown in, specific out
class DataProcessor {
  // Accept any data
  process(data: unknown): string {
    // Force handling of different types
    if (typeof data === 'string') {
      return `String: ${data.toUpperCase()}`
    } else if (typeof data === 'number') {
      return `Number: ${data.toFixed(2)}`
    } else if (Array.isArray(data)) {
      return `Array[${data.length}]`
    } else if (typeof data === 'object' && data !== null) {
      return `Object with ${Object.keys(data).length} keys`
    } else {
      return 'Unknown type'
    }
  }
}

const processor = new DataProcessor()
console.log(processor.process('hello')) // String: HELLO
console.log(processor.process(42.7)) // Number: 42.70
console.log(processor.process([1, 2, 3])) // Array[3]
console.log(processor.process({ a: 1 })) // Object with 1 keys
