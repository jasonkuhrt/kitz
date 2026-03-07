/**
 * Registry Pattern: Any vs Unknown
 *
 * Real-world example showing why registries need `any` for flexibility.
 */

// Domain types
interface User {
  id: string
  name: string
}

interface Product {
  sku: string
  price: number
}

// ❌ Registry with unknown - Too restrictive
interface BadRegistry {
  [key: string]: {
    process: (item: unknown) => unknown
    validate: (item: unknown) => boolean
  }
}

// Try to register specific handlers
const badRegistry: BadRegistry = {
  // @ts-expect-error - Type '(user: User) => { id: string; name: string; }' is not assignable
  user: {
    // Error! User is not unknown
    process: (user: User) => ({ ...user, processed: true }),
    validate: (user: User) => user.id.length > 0,
  },
  // @ts-expect-error - Type '(product: Product) => { sku: string; price: number; }' is not assignable
  product: {
    // Error! Product is not unknown
    process: (product: Product) => ({ ...product, tax: product.price * 0.1 }),
    validate: (product: Product) => product.price > 0,
  },
}

// ✅ Registry with any - Flexible
interface GoodRegistry {
  [key: string]: {
    process: (item: any) => any
    validate: (item: any) => boolean
  }
}

const goodRegistry: GoodRegistry = {
  user: {
    // ✅ Works!
    process: (user: User) => ({ ...user, processed: true }),
    validate: (user: User) => user.id.length > 0,
  },
  product: {
    // ✅ Works!
    process: (product: Product) => ({ ...product, tax: product.price * 0.1 }),
    validate: (product: Product) => product.price > 0,
  },
}

// Trait system example
type TraitImplementation = Record<string, (...args: any[]) => any>

// ❌ With unknown - can't store specific implementations
interface BadTraitRegistry {
  [trait: string]: {
    [domain: string]: {
      [method: string]: (...args: unknown[]) => unknown
    }
  }
}

// ✅ With any - can store any implementation
interface GoodTraitRegistry {
  [trait: string]: {
    [domain: string]: TraitImplementation
  }
}

const traitRegistry: GoodTraitRegistry = {
  Eq: {
    Array: {
      equals: (a: any[], b: any[]) => {
        return a.length === b.length && a.every((v, i) => v === b[i])
      },
    },
    String: {
      equals: (a: string, b: string) => a === b,
    },
    Number: {
      equals: (a: number, b: number) => a === b,
    },
  },
  Show: {
    Array: {
      show: (arr: any[]) => `[${arr.join(', ')}]`,
    },
    String: {
      show: (s: string) => `"${s}"`,
    },
  },
}

// Type-safe wrapper pattern
class TypeSafeRegistry {
  private registry: Record<string, any> = {}

  // Store with any (flexible)
  register(key: string, value: any): void {
    this.registry[key] = value
  }

  // Retrieve as unknown (safe)
  get(key: string): unknown {
    return this.registry[key]
  }

  // Type-safe retrieval with guard
  getAs<T>(key: string, guard: (value: unknown) => value is T): T | undefined {
    const value = this.registry[key]
    return guard(value) ? value : undefined
  }
}

// Usage
const reg = new TypeSafeRegistry()
reg.register('userHandler', (u: User) => u.name)
reg.register('productHandler', (p: Product) => p.price)

// Must narrow when retrieving
const handler = reg.get('userHandler') // unknown
if (typeof handler === 'function') {
  // Now we know it's a function
}
