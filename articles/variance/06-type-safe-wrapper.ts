/**
 * Type-Safe Wrapper Pattern
 *
 * Shows how to safely wrap `any` internals with `unknown` externals.
 */

// Internal storage uses any for flexibility
class FlexibleStore {
  private items: Record<string, any> = {}

  // Public API uses unknown for safety
  set(key: string, value: unknown): void {
    this.items[key] = value
  }

  get(key: string): unknown {
    return this.items[key]
  }

  // Type-safe retrieval with runtime check
  getAs<T>(key: string, validator: (value: unknown) => value is T): T | undefined {
    const value = this.items[key]
    return validator(value) ? value : undefined
  }

  // Unsafe internal method (not exposed)
  private getUnsafe(key: string): any {
    return this.items[key]
  }
}

// Type guards for safe retrieval
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

interface User {
  id: string
  name: string
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).name === 'string'
  )
}

// Usage
const store = new FlexibleStore()

// Can store anything
store.set('count', 42)
store.set('name', 'Alice')
store.set('user', { id: '123', name: 'Bob' })

// Must handle unknown when retrieving
const value1 = store.get('count') // unknown
// console.log(value1 + 1)  // Error! Can't use unknown

// Safe retrieval with type guards
const count = store.getAs('count', isNumber)
if (count !== undefined) {
  console.log(count + 1) // 43 - TypeScript knows it's a number
}

const name = store.getAs('name', isString)
if (name !== undefined) {
  console.log(name.toUpperCase()) // ALICE
}

const user = store.getAs('user', isUser)
if (user !== undefined) {
  console.log(user.name) // Bob
}

// Advanced: Generic cache with type mapping
class TypedCache {
  private cache = new Map<string, any>()

  // Store with type information
  set<K extends string, V>(key: K, value: V): void {
    this.cache.set(key, value)
  }

  // Retrieve as unknown (safe default)
  get(key: string): unknown {
    return this.cache.get(key)
  }

  // Typed retrieval with explicit type
  getTyped<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined
  }

  // With default value
  getOrDefault<T>(key: string, defaultValue: T): T {
    const value = this.cache.get(key)
    return value !== undefined ? value : defaultValue
  }
}

// Even safer: Registry with type map
interface TypeMap {
  user: User
  count: number
  flag: boolean
}

class TypedRegistry {
  private data: Record<string, any> = {}

  set<K extends keyof TypeMap>(key: K, value: TypeMap[K]): void {
    this.data[key] = value
  }

  get<K extends keyof TypeMap>(key: K): TypeMap[K] | undefined {
    return this.data[key]
  }
}

const registry = new TypedRegistry()
registry.set('user', { id: '1', name: 'Alice' }) // ✅ Type-checked
registry.set('count', 42) // ✅ Type-checked
// @ts-expect-error - Type '"invalid"' is not assignable to type 'number'
registry.set('count', 'invalid') // Error! Wrong type

const registryUser = registry.get('user') // User | undefined
const registryCount = registry.get('count') // number | undefined
