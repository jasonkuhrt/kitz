/**
 * Common Pitfalls and How to Avoid Them
 *
 * Examples of mistakes when working with variance and unknown.
 */

// Pitfall 1: Using unknown for function parameters in generics
// ❌ Wrong
interface BadGenericWrapper<T extends (x: unknown) => any> {
  wrapped: T
}

// @ts-expect-error - Type '(n: number) => number' is not assignable
type BadWrapped = BadGenericWrapper<(n: number) => number> // Error!

// ✅ Correct
interface GoodGenericWrapper<T extends (x: any) => any> {
  wrapped: T
}

type GoodWrapped = GoodGenericWrapper<(n: number) => number> // Works!

// Pitfall 2: Expecting unknown to make APIs "safer" everywhere
// ❌ Wrong - Makes API unusable
class BadAPI {
  // Too restrictive - only accepts handlers for unknown
  on(event: string, handler: (data: unknown) => void): void {
    // ...
  }
}

const badApi = new BadAPI()
// @ts-expect-error - Type '(n: number) => void' is not assignable
badApi.on('count', (n: number) => console.log(n)) // Error!

// ✅ Correct - Flexible registration, safe usage
class GoodAPI {
  private handlers: Map<string, (data: any) => void> = new Map()

  on(event: string, handler: (data: any) => void): void {
    this.handlers.set(event, handler)
  }

  // Emit returns unknown to force narrowing
  emit(event: string, data: unknown): void {
    const handler = this.handlers.get(event)
    if (handler) handler(data)
  }
}

// Pitfall 3: Forgetting variance in method storage
// ❌ Wrong
type MethodMap = {
  [key: string]: (input: unknown) => unknown
}

const methods: MethodMap = {
  // @ts-expect-error - Type '(s: string) => number' is not assignable
  strlen: (s: string) => s.length, // Error!
}

// ✅ Correct
type FlexibleMethodMap = {
  [key: string]: (input: any) => any
}

const flexibleMethods: FlexibleMethodMap = {
  strlen: (s: string) => s.length, // Works!
  double: (n: number) => n * 2, // Works!
}

// Pitfall 4: Overly strict array types
// ❌ Wrong
const processors: Array<(x: unknown) => void> = [
  // @ts-expect-error - Type '(s: string) => void' is not assignable
  (s: string) => console.log(s.length), // Error!
  // @ts-expect-error - Type '(n: number) => void' is not assignable
  (n: number) => console.log(n * 2), // Error!
]

// ✅ Correct for storage
const flexibleProcessors: Array<(x: any) => void> = [
  (s: string) => console.log(s.length), // Works!
  (n: number) => console.log(n * 2), // Works!
]

// Pitfall 5: Misunderstanding unknown in conditional types
type ExtractArg<T> = T extends (arg: infer A) => any ? A : never

// These work as expected
type Arg1 = ExtractArg<(s: string) => void> // string
type Arg2 = ExtractArg<(n: number) => void> // number
type Arg3 = ExtractArg<(x: unknown) => void> // unknown

// But be careful with constraints
// ❌ Wrong constraint
type BadExtract<T extends (arg: unknown) => any> = T extends (arg: infer A) => any ? A : never

// @ts-expect-error - Type '(s: string) => void' does not satisfy the constraint
type BadResult = BadExtract<(s: string) => void> // Error!

// ✅ Correct constraint
type GoodExtract<T extends (arg: any) => any> = T extends (arg: infer A) => any ? A : never

type GoodResult = GoodExtract<(s: string) => void> // string

// Pitfall 6: Thinking any is always bad
// Sometimes any is the right choice for infrastructure

// ✅ Registry pattern needs any
class Registry {
  private items: Record<string, any> = {} // ✅ Correct

  register(key: string, value: any): void {
    // ✅ Correct
    this.items[key] = value
  }

  get(key: string): unknown {
    // ✅ Return unknown for safety
    return this.items[key]
  }
}

// ✅ Middleware pattern needs any
type Middleware = (req: any, res: any, next: () => void) => void

const middlewares: Middleware[] = [
  (req: { user?: string }, res, next) => {
    if (!req.user) res.status(401)
    else next()
  },
  (req, res: { json: (data: any) => void }, next) => {
    res.json({ ok: true })
  },
]

// Summary: Know when to use each
// - unknown: Force narrowing, safe returns, public APIs
// - any: Infrastructure, registries, generic constraints
