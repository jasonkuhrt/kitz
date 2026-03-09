# Code Generation & Maximum Type Safety Research for Kitz

> Compiled: 2026-02-28
> Context: kitz monorepo, TypeScript on tsgo (Go-based TS compiler), Effect-based, pre-1.0

---

## 1. tsgo Status and API Landscape

### Current State (Feb 2026)

TypeScript 7 (codenamed "Corsa") is the Go-based rewrite of the TypeScript compiler. As of December 2025, near-complete type-checking parity has been achieved:

- **20,000 compiler test cases**, all but 74 produce identical errors between tsc 6.0 and tsgo 7.0
- The remaining 74 are known gaps: regex syntax checking, `isolatedDeclarations` errors, or intentional deprecations
- **Performance benchmarks** from the [December 2025 progress report](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/):

| Project    | tsc (6.0) | tsgo (7.0) | Speedup |
| ---------- | --------- | ---------- | ------- |
| Sentry     | 133.08s   | 16.25s     | 8.19x   |
| VSCode     | 89.11s    | 8.74s      | 10.2x   |
| TypeORM    | 15.80s    | 1.06s      | 9.88x   |
| Playwright | 9.30s     | 1.24s      | 7.51x   |

### API Situation

**Critical for kitz**: The tsgo API story is unresolved and actively under discussion.

- **No public Go API**: Microsoft considers a public Go API ["unlikely"](https://github.com/microsoft/typescript-go/discussions/481) due to the burden on internal codebase design.
- **IPC-based API**: The team is pursuing [message-passing over IPC](https://github.com/microsoft/typescript-go/discussions/455) rather than exposing internal Go APIs. Synchronous communication over standard I/O using a Node native module has shown promising results.
- **No plugin system**: The old method-patching approach from tsc won't work in Go. The team acknowledges Angular, Volar.js, and Svelte depend on current APIs and is open to designing proper hooks -- but nothing concrete exists yet.
- **Strada API dead in 7.0**: TypeScript 7.0 will NOT support the existing Strada API. Tools relying on the current `typescript` npm package API surface (linters, formatters, IDE extensions) will not work with Corsa directly.
- **Workaround**: Keep `typescript` for API-dependent tooling alongside `@typescript/native-preview` (tsgo) for type-checking.

### Breaking Changes in TypeScript 7

- `--strict` becomes the default
- `--target` defaults to latest stable ECMAScript (e.g. es2025)
- `--target es5` removed; es2015 is the new minimum
- `--baseUrl` removed
- `node10` module resolution deprecated
- `rootDir` default changes

### Type-Level Feature Parity

tsgo is a line-by-line port of tsc, including the ~50,000-line `checker.ts`. All type-level features (conditional types, mapped types, template literals, recursive types, variance annotations, `const` type parameters, `NoInfer`, `satisfies`) are supported identically. There are no known type-system divergences.

### Timeline

- **TypeScript 6.0**: Early-mid 2026 (last JavaScript-based release, patch-only servicing after)
- **TypeScript 7.0**: Mid-late 2026 (Go-based, targeting summer)
- **IPC API**: No public timeline, but it's a stated priority

### Implications for Kitz

1. **Type-level programming is safe**: All kitz type patterns (HKTs, conditional types, branded types, recursive types) work identically in tsgo. The 10x speedup directly benefits kitz's heavy type-level usage.
2. **Build-time codegen tools face uncertainty**: ts-morph and any tool using the TypeScript compiler API will break with tsgo. Plan codegen strategies that are compiler-API-independent.
3. **kitz is already on tsgo** (`"build": "tsgo -p tsconfig.build.json"`) -- ahead of the curve.

---

## 2. Code Generation Strategies

### 2a. Build-Time Codegen (Generate .ts Before Compilation)

**How it works**: A script runs before `tsc`/`tsgo`, reads some input (schema, config, type definitions), and writes `.ts` files that then get compiled normally.

**Examples**: Prisma (`prisma generate`), GraphQL Codegen, Drizzle ORM, openapi-typescript

**Implementation approaches**:

- **Template strings**: Simple string interpolation to produce `.ts` source. Fast, no dependencies.
- **ts-morph / AST**: Use `ts-morph` to programmatically construct TypeScript AST nodes. More robust but **depends on the tsc API**, which will break with tsgo.
- **Handlebars/EJS templates**: Template files with holes filled from data. Good for repetitive structures.

**Kitz feasibility**: HIGH. This is the most practical approach today.

```typescript
// Example: generate typed enum modules from a registry
// scripts/generate-enums.ts
import fs from 'node:fs'

interface EnumDef {
  name: string
  members: Record<string, string>
}

function generateEnum(def: EnumDef): string {
  const entries = Object.entries(def.members)
  return `
/** @generated - DO NOT EDIT */
export const ${def.name} = {
${entries.map(([k, v]) => `  ${k}: '${v}',`).join('\n')}
} as const

export type ${def.name} = typeof ${def.name}[keyof typeof ${def.name}]
`
}
```

**Recommendation**: Use plain template-string codegen (no ts-morph dependency). Output `.ts` files to a `generated/` directory. This approach:

- Is compiler-API-independent (survives tsgo transition)
- Has zero runtime cost
- Produces tree-shakeable output
- Can be verified by tsgo type-checking

### 2b. Macro-Like Transforms (Compile-Time Code Transformation)

**How it works**: A compiler plugin or bundler plugin transforms source code during compilation.

**Current landscape**:

- **Babel macros**: `babel-plugin-macros`, `codegen.macro` -- transform at Babel compilation. kitz doesn't use Babel.
- **SWC plugins**: Written in Rust/WASM, 20-70x faster than Babel. But SWC is a transpiler, not a type-checker.
- **TypeScript transformer plugins**: Depend on tsc's compiler API -- dead path with tsgo.

**Kitz feasibility**: LOW. No stable path for tsgo-compatible compile-time transforms. The tsgo team has not committed to a plugin API. Avoid building infrastructure on this.

### 2c. Type-Driven Codegen (Extract Types to Generate Runtime Code)

**How it works**: Read type information from compiled `.d.ts` files or the checker, then generate runtime validators/serializers/etc.

**Examples**: `ts-auto-guard`, `typia` (compile-time type-to-validator), `zod-to-ts`

**Challenge with tsgo**: Tools like `typia` use tsc's transformer API. This is the exact API that won't exist in tsgo.

**Alternative approach for kitz**: Since kitz already uses Effect Schema (runtime types), the flow can be reversed -- generate types FROM schemas rather than schemas from types. This is already kitz's pattern with `Schema.TaggedClass`.

**Kitz feasibility**: MEDIUM. The "schema-first" approach (Effect Schema -> derived types) already works. Going the other direction (types -> runtime code) is blocked by the tsgo API gap.

### 2d. Template-Based Codegen (Template Literal DSLs)

**How it works**: Use TypeScript template literal types to create type-safe DSLs that are validated at the type level.

**This is a type-safety technique, not a codegen technique**. Template literals enable:

- Route pattern typing: `"/api/${string}/posts/${number}"`
- SQL query typing: tagged template literals with inferred result types
- Event name typing: `"on${Capitalize<EventName>}"`

**Kitz feasibility**: HIGH. Already partially used in `@kitz/core/str/tpl`. See Section 3d for details.

### 2e. IDE-Time Codegen (Editor Commands/Refactorings)

**How it works**: VS Code extensions or TypeScript language service plugins generate code on demand.

**Current state**: VS Code has built-in refactoring support. Extensions like [TypeScript Essential Plugins](https://github.com/zardoy/typescript-vscode-plugins) add custom code actions. Custom TypeScript language service plugins can add completions, refactorings, and diagnostics.

**Challenge with tsgo**: Language service plugins depend on the tsc API. The tsgo language service is a separate process communicating via IPC.

**Kitz feasibility**: LOW for custom plugins (tsgo API uncertainty). However, Claude Code and AI-assisted development effectively replace this -- the `kitz-functions` and `kitz-data-modeling` skills already serve this purpose.

### Codegen Strategy Recommendation for Kitz

| Strategy                    | Feasibility | tsgo-Safe | Tree-Shake Safe | Recommendation          |
| --------------------------- | ----------- | --------- | --------------- | ----------------------- |
| Build-time template codegen | HIGH        | YES       | YES             | **Primary strategy**    |
| Macro transforms            | LOW         | NO        | Varies          | Avoid                   |
| Type-driven codegen         | MEDIUM      | Partial   | YES             | Schema-first only       |
| Template literal DSLs       | HIGH        | YES       | YES             | Use for type-level      |
| IDE-time codegen            | LOW         | NO        | N/A             | Use Claude Code instead |

---

## 3. Type Safety Frontiers

### 3a. Higher-Kinded Types (HKTs)

#### How Effect Does It

Effect uses a clever encoding based on TypeScript's `this` type in interfaces. The [canonical explanation](https://dev.to/effect/encoding-of-hkts-in-typescript-5c3) describes three components:

**1. Base HKT interface:**

```typescript
interface HKT {
  readonly _A?: unknown
  readonly type?: unknown
}
```

**2. Kind type helper (the magic):**

```typescript
type Kind<F extends HKT, A> = F extends { readonly type: unknown }
  ? (F & { readonly _A: A })['type']
  : { readonly _F: F; readonly _A: () => A }
```

When you intersect `F` with `{ readonly _A: A }`, the `this` reference inside F's `type` property automatically resolves to the updated type.

**3. Concrete implementations:**

```typescript
interface ArrayHKT extends HKT {
  readonly type: Array<this['_A']>
}

// Multi-parameter (Effect<R, E, A>):
interface EffectHKT extends HKT3 {
  readonly type: Effect<this['_R'], this['_E'], this['_A']>
}
```

**4. Type class definitions:**

```typescript
interface Mappable<F extends HKT> {
  readonly map: <R, E, A, B>(self: Kind<F, R, E, A>, f: (a: A) => B) => Kind<F, R, E, B>
}
```

#### Kitz's Current HKT Implementation

Kitz already has its own HKT encoding in `packages/core/src/fn/kind.ts`:

```typescript
// Simpler than Effect's -- uses parameters/return pattern
export type Apply<$Kind, $Args> = ($Kind & { parameters: $Args })['return']

export interface Kind<$Params = unknown, $Return = unknown> {
  parameters: $Params
  return: $Return
}

// Private kinds using symbols for encapsulation
export interface Private {
  [PrivateKindReturn]: unknown
  [PrivateKindParameters]: unknown
}
```

Plus type-level composition:

```typescript
// Left-to-right pipe for kinds
export type Pipe<$Kinds extends readonly Kind[], $Input> =
  $Kinds extends readonly [infer F extends Kind, ...infer R extends readonly Kind[]]
    ? Pipe<R, Apply<F, [$Input]>>
    : $Input

// Short-circuiting pipe with Either
export type PipeRight<$Input, $Kinds extends readonly Kind[]> = ...
```

#### Alternative: hkt-core

[hkt-core](https://github.com/Snowflyt/hkt-core) is a micro-library providing a standardized HKT implementation. It supports:

- Classical type constructors (`Kind<F, T>`)
- Type-level functions (`TypeA -> TypeB`)
- Generic type-level functions
- Zero-cost abstractions

**Cross-reference to typeclasses**: HKTs are the foundation for typeclasses. Without HKTs, you can't write `Mappable<F>` generically. Kitz's Kind system is the prerequisite for any typeclass system (TRAITOR or otherwise).

#### Performance Characteristics

HKT encodings using intersection + indexed access are very fast in TypeScript. The key overhead is:

- Each `Kind` application creates one intersection type
- Type caching means repeated applications of the same kind are free
- The depth limit (1000 for tail-recursive types) is the primary constraint

### 3b. Dependent Types via Template Literals

Template literal types enable encoding value-level constraints at the type level:

```typescript
// Route parameters
type Route<T extends string> = T extends `${infer Start}:${infer Param}/${infer Rest}`
  ? { [K in Param]: string } & Route<Rest>
  : T extends `${infer Start}:${infer Param}`
    ? { [K in Param]: string }
    : {}

type Params = Route<'/users/:id/posts/:postId'>
// { id: string } & { postId: string }

// Numeric ranges (pseudo-dependent types)
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type HexDigit = Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f'
type HexColor = `#${HexDigit}${HexDigit}${HexDigit}${HexDigit}${HexDigit}${HexDigit}`

// CSS units
type CSSLength = `${number}${'px' | 'em' | 'rem' | 'vh' | 'vw' | '%'}`
```

**Kitz relevance**: Template literal types are used in `@kitz/core/str/tpl`. They're excellent for string-based DSLs but have limits:

- Combinatorial explosion with large unions
- No arithmetic on extracted numbers
- Recursion depth limits apply

### 3c. Branded Types

Effect provides `Brand.nominal` and `Brand.refined` using a unique symbol pattern:

```typescript
const BrandTypeId: unique symbol = Symbol.for('effect/Brand')

// Zero runtime cost -- the brand exists only at the type level
type UserId = number & Brand.Brand<'UserId'>
const UserId = Brand.nominal<UserId>()

// With validation
type PositiveInt = number & Brand.Brand<'PositiveInt'>
const PositiveInt = Brand.refined<PositiveInt>(
  (n) => Number.isInteger(n) && n > 0,
  (n) => Brand.error(`Expected positive integer, got ${n}`),
)

// Composable
const PositiveInt = Brand.all(Int, Positive)
```

**Kitz pattern**: Kitz already uses branded types through Effect Schema:

```typescript
class MyType extends Schema.TaggedClass<MyType>()('MyType', {
  field: Schema.String,
}) {
  static is = Schema.is(MyType)
}
```

The `_tag` field is effectively a brand. For primitive-level branding, Effect's `Brand` module is the right tool.

**Cross-reference to typeclasses**: Branded types can serve as "witnesses" for typeclass instances. A `Branded<"Ord">` type could prove that a value has an `Ord` instance.

### 3d. Type-Level Computation

TypeScript's type system is accidentally Turing-complete. Key capabilities and limits:

**Recursion limits:**

- Tail recursion depth: **1000** (hard limit, unchangeable)
- Non-tail recursive depth: **50** (much lower)
- Type instantiation depth: ~500 before "excessively deep" errors

**Workarounds:**

1. **Tail recursion with accumulator**: Use a result accumulator to keep recursion tail-call-optimizable
2. **Deferred instantiation**: Put recursive refs in object properties (not directly in conditionals) to defer instantiation
3. **Loop unrolling**: Process 2-4 elements per recursion step
4. **Named type caching**: Extract intermediate types to named aliases for caching

```typescript
// Bad: non-tail recursive
type Length<T extends any[]> =
  T extends [any, ...infer Rest] ? 1 + Length<Rest> : 0  // hits depth limit fast

// Good: tail recursive with accumulator
type Length<T extends any[], Acc extends any[] = []> =
  T extends [any, ...infer Rest] ? Length<Rest, [...Acc, any]> : Acc['length']
```

**Performance-safe patterns:**

- Prefer interfaces over intersection types for extension
- Use named type aliases (enables caching)
- Avoid deeply nested conditional types when mapped types suffice
- Limit union size to <12 members for O(n^2) comparison types

### 3e. Opaque Types (Nominal Typing)

Multiple patterns exist, from simplest to most robust:

```typescript
// 1. Intersection brand (most common)
type UserId = string & { readonly __brand: unique symbol }

// 2. Unique symbol brand (Effect's approach -- stronger)
declare const BrandSymbol: unique symbol
type UserId = string & { readonly [BrandSymbol]: { readonly UserId: 'UserId' } }

// 3. Class-based (runtime nominal, zero-cost structurally)
class UserId {
  private readonly __nominal!: void
  constructor(readonly value: string) {}
}
```

**Kitz approach**: Use Effect's Brand module for pure type-level brands. Use Schema.TaggedClass for runtime-discriminated types. The combination gives both structural and nominal safety.

### 3f. Variance Annotations

TypeScript 4.7+ provides explicit variance declarations:

```typescript
// Covariant: can substitute subtype
interface Producer<out T> {
  get(): T
}

// Contravariant: can substitute supertype
interface Consumer<in T> {
  accept(value: T): void
}

// Invariant: exact type required
interface Container<in out T> {
  get(): T
  set(value: T): void
}
```

**Benefits:**

- Errors surface at declaration site, not call site
- Enables compiler optimizations (skip structural checking when variance is known)
- Self-documenting: variance is part of the public API contract

**Kitz relevance**: HIGH. Variance annotations on Effect types (Effect<out A, out E, out R>) are already used. Kitz's own generic types should add them. The `@kitz/core/ts/variance-phantom.ts` module already has utilities:

```typescript
// From kitz: phantom variance markers
export type Co<T> = ...   // covariant
export type Contra<T> = ... // contravariant
```

### 3g. `const` Type Parameters

`<const T>` (TypeScript 5.0+) forces literal inference:

```typescript
// Without const: T inferred as string[]
declare function createRoute<T extends string[]>(paths: T): T
createRoute(['users', 'posts']) // string[]

// With const: T inferred as readonly ["users", "posts"]
declare function createRoute<const T extends readonly string[]>(paths: T): T
createRoute(['users', 'posts']) // readonly ["users", "posts"]
```

**Kitz relevance**: Essential for the data-modeling patterns. `as const satisfies` is already used in lookup tables. `const` type parameters should be used in factory functions.

### 3h. `NoInfer`

`NoInfer<T>` (TypeScript 5.4+) blocks inference at specific positions:

```typescript
// Problem: TS infers T from both parameters, causing widening
declare function createFSM<T extends string>(initial: T, states: T[]): void
createFSM('idle', ['idle', 'loading', 'error'])
// T = "idle" | "loading" | "error" -- OK, but fragile

// Solution: NoInfer blocks inference from states
declare function createFSM<T extends string>(initial: T, states: NoInfer<T>[]): void
createFSM('idle', ['idle', 'loading', 'error'])
// T = "idle" -- inferred only from initial
```

**Kitz relevance**: HIGH for API design. When a function takes both a "definition" parameter and a "usage" parameter, use `NoInfer` on the usage side to force inference from the definition.

### 3i. `satisfies`

`satisfies` (TypeScript 4.9+) validates a type without widening:

```typescript
// as const + satisfies = literal types + exhaustiveness
const config = {
  port: 3000,
  host: 'localhost',
  debug: true,
} as const satisfies Readonly<{
  port: number
  host: string
  debug: boolean
}>

// config.port is 3000, not number
// config.host is "localhost", not string
// Missing fields caught at compile time
```

**Kitz already uses this pattern** extensively in lookup tables (`stateFromTag` example in data-modeling skill). It's the primary mechanism for exhaustiveness checking without widening.

---

## 4. Tree-Shaking Preservation

### Core Principles

1. **ESM is mandatory**: Only ES modules support tree-shaking. kitz already uses `"type": "module"` and ESM exports.

2. **`sideEffects: false`**: kitz's `package.json` already declares `"sideEffects": false`. This tells bundlers the entire package is safe to tree-shake.

3. **Functions over methods**: Methods on prototypes/classes cannot be tree-shaken. Only module-level named exports can be eliminated.

### How Effect Handles This (and Where It Fails)

**Effect's design philosophy** (from the [Effect docs](https://effect.website/docs/getting-started/building-pipelines/)):

> Functions are tree shakeable, while methods are not. When functions are used in the Effect ecosystem, only the functions that are actually imported and used in your application will be included in the final bundled code. In contrast, methods are attached to objects or prototypes, and they cannot be easily tree shaken.

**The dual API pattern** enables this:

```typescript
// Data-last (for pipe) -- tree-shakeable
pipe(effect, Effect.map(fn))

// Data-first (direct) -- also tree-shakeable
Effect.map(effect, fn)
```

Both are module-level function exports, both are shakeable. The pipe function itself is a small fixed cost.

**Where Effect fails at tree-shaking:**

- Class methods on Effect instances (`effect.pipe(...)`) -- the `pipe` method and its implementation chain aren't shakeable
- The Effect runtime itself is large and not easily shakeable
- `Schema.TaggedClass` creates class instances with prototype methods -- those methods aren't shakeable

### Patterns That Preserve Tree-Shaking

```typescript
// GOOD: Named function exports
export const map = <A, B>(self: Array<A>, f: (a: A) => B): Array<B> => ...
export const filter = <A>(self: Array<A>, f: (a: A) => boolean): Array<A> => ...

// GOOD: Namespace re-exports (bundlers handle these)
export * as Arr from './arr.js'

// BAD: Class with methods
export class MyArray<A> {
  map(f: (a: A) => A): MyArray<A> { ... }      // not shakeable
  filter(f: (a: A) => boolean): MyArray<A> { ... } // not shakeable
}

// BAD: Module-level side effects
const _registry = new Map()  // side effect -- blocks shaking of entire module
export const register = (name: string) => _registry.set(name, true)
```

### kitz-Specific Module Structure

kitz's current structure is already well-optimized:

```
packages/core/
  package.json          # "sideEffects": false
  src/
    arr/
      _.ts              # internal barrel (namespace imports #arr)
      __.ts             # public barrel (export * as Arr)
      arr.ts            # implementation
    fn/
      _.ts
      __.ts
      kind.ts           # HKT utilities
```

Each module is a small, focused file. Barrel files use re-exports (`export *`), which bundlers handle correctly for tree-shaking. The `#arr` subpath imports are package-internal and resolved at build time.

### `/*#__PURE__*/` Annotations

For function calls that bundlers can't statically prove pure:

```typescript
// Without annotation: bundler must keep this (might have side effects)
const result = someFunction()

// With annotation: bundler can safely remove if result is unused
const result = /*#__PURE__*/ someFunction()
```

Effect uses this extensively for its module construction. kitz should use it for any module-level initialization.

### Recommendations for kitz

1. **Continue the function-first approach**: kitz's `On`/`With` curried variants are already shakeable functions
2. **Avoid class methods for public API**: Use static factory functions instead
3. **Keep modules granular**: Current `_.ts`/`__.ts` structure is good
4. **Add `/*#__PURE__*/`** to any module-level `const` initialization that calls a function
5. **Test with bundle analysis**: Use `esbuild --bundle --analyze` to verify tree-shaking

---

## 5. JSDoc Quality Standards

### What Makes JSDoc Exceptional

Studied libraries: Effect, Zod, fp-ts, Ramda, TypeBox, es-toolkit.

**Common patterns in high-quality JSDoc:**

1. **One-line summary + detailed description**: First sentence is a complete thought. Paragraphs follow for complexity.

2. **`@example` with runnable code**: Not pseudocode. Actual imports, actual function calls, actual expected results.

3. **`@since` for API stability tracking**: Effect uses this extensively.

4. **`@category` for grouping**: Enables TypeDoc to organize exports by domain.

5. **`@see` with `{@link}`**: Cross-references to related functions/types.

### Machine-Readable JSDoc for LLMs

For AI assistants to effectively use JSDoc:

````typescript
/**
 * Split a string into an array of substrings.
 *
 * Returns the segments between occurrences of `separator`. If `separator`
 * is not found, returns a single-element array containing the original string.
 *
 * @param value - The string to split
 * @param separator - The delimiter pattern
 * @returns Array of substrings
 *
 * @example Basic usage
 * ```ts
 * import { Str } from '@kitz/core'
 *
 * Str.split("a,b,c", ",")
 * // => ["a", "b", "c"]
 * ```
 *
 * @example Empty separator
 * ```ts
 * Str.split("abc", "")
 * // => ["a", "b", "c"]
 * ```
 *
 * @example No match
 * ```ts
 * Str.split("abc", ",")
 * // => ["abc"]
 * ```
 *
 * @since 0.1.0
 * @category String Operations
 * @see {@link splitWith} for the curried data-last variant
 * @see {@link join} for the inverse operation
 */
````

**Key principles for LLM readability:**

- Examples are the most important element -- LLMs learn API usage from examples
- Parameter descriptions should state constraints, not restate the name
- The first sentence should be a complete, standalone description
- `@see` links create a navigable graph of related concepts

### Automated JSDoc Verification

**1. eslint-plugin-tsdoc / eslint-plugin-jsdoc:**
Validate syntax, enforce required tags, check `@param`/`@returns` alignment with actual signatures.

**2. doc-vitest (vite-plugin-doctest):**
[doc-vitest](https://github.com/ssssota/doc-vitest) extracts `@example` code blocks and runs them as Vitest tests:

````typescript
/**
 * @example
 * ```ts @import.meta.vitest
 * expect(add(1, 2)).toBe(3)
 * ```
 */
export function add(a: number, b: number) {
  return a + b
}
````

Setup in `vitest.config.ts`:

```typescript
import { doctest } from 'vite-plugin-doctest'

export default defineConfig({
  plugins: [doctest()],
  test: {
    includeSource: ['./src/**/*.[jt]s?(x)'],
  },
})
```

Limitations: no type-checking assertions, no lifecycle hooks, no static imports (use dynamic).

**3. generate-jsdoc-example-tests:**
[generate-jsdoc-example-tests](https://github.com/SacDeNoeuds/generate-jsdoc-example-tests) generates test files from `@example` tags. More flexible than doc-vitest but requires a generation step.

### Structured Metadata in JSDoc

JSDoc supports arbitrary structured data through custom tags and markdown:

````typescript
/**
 * Compute the absolute value of a number.
 *
 * @param value - The number to make non-negative
 * @returns The absolute value
 *
 * @example
 * ```ts
 * Num.abs(-5) // => 5
 * Num.abs(3)  // => 3
 * ```
 *
 * @complexity O(1)
 * @pure
 * @law abs(x) >= 0
 * @law abs(abs(x)) === abs(x)
 * @category Arithmetic
 * @since 0.1.0
 */
````

Custom tags like `@complexity`, `@pure`, and `@law` aren't standard but are preserved in TypeDoc output and are machine-parseable.

### TSDoc vs JSDoc

[TSDoc](https://tsdoc.org/) standardizes the loose conventions of JSDoc:

- Defines tag semantics precisely
- `@link` instead of ambiguous auto-hyperlinking after `@see`
- `@param` without type annotations (types come from TypeScript)
- `eslint-plugin-tsdoc` validates conformance

**Recommendation for kitz**: Use TSDoc conventions (no type annotations in JSDoc, `{@link}` for references) with eslint-plugin-tsdoc for validation. Consider doc-vitest for example verification.

---

## 6. Performance-Safe Type Patterns

### TypeScript Performance Wiki Recommendations

From the [official TypeScript Performance wiki](https://github.com/microsoft/Typescript/wiki/Performance):

**1. Prefer interfaces over intersection types:**

```typescript
// Fast: flat object type, cached relationships
interface Foo extends Bar, Baz {
  x: number
}

// Slow: intersection can't be cached
type Foo = Bar & Baz & { x: number }
```

**2. Use explicit return type annotations:**

```typescript
// Slow: compiler must infer complex return type
export const transform = <T>(input: T) => /* complex expression */

// Fast: compiler trusts the annotation
export const transform = <T>(input: T): TransformResult<T> => /* ... */
```

**3. Name complex types (enable caching):**

```typescript
// Slow: anonymous type re-computed every time
type Result = T extends string ? Uppercase<T> : T extends number ? `${T}` : never

// Fast: named alias is cached
type StringCase<T> = T extends string ? Uppercase<T> : never
type NumberStr<T> = T extends number ? `${T}` : never
type Result = StringCase<T> | NumberStr<T>
```

**4. Limit union sizes:**
Union comparison is O(n^2). With >12 members, consider a shared base interface:

```typescript
// Slow with many variants
type Event = ClickEvent | ScrollEvent | KeyEvent | ... // 20+ variants

// Fast: shared base
interface BaseEvent { type: string; timestamp: number }
interface ClickEvent extends BaseEvent { type: "click"; x: number; y: number }
```

**5. Enable `strictFunctionTypes`:**
Allows the compiler to infer variance from type parameter usage, avoiding expensive structural member comparison.

### Conditional Types vs Overloads: Performance

- **Conditional types**: Deferred evaluation until generic resolved. Single implementation body. Can cause deep type instantiation chains.
- **Overloads**: Evaluated eagerly per call site. Multiple signatures but simpler per-signature. Better IDE error messages.

**kitz convention** (from kitz-functions skill): Prefer conditional types over overloads for type mappings:

```typescript
type Abs<T extends number> =
  T extends Negative ? Positive :
  T extends NonPositive ? NonNegative :
  NonNegative

const abs = <T extends number>(value: T): Abs<T> => ...
```

This is correct for kitz's use case. The conditional type is shallow (2 levels) and well-named.

### Recursive Type Depth Strategies

| Technique              | Max Depth | Speed  | Complexity |
| ---------------------- | --------- | ------ | ---------- |
| Tail recursion         | ~1000     | Fast   | Low        |
| Non-tail recursion     | ~50       | Slow   | Low        |
| Loop unrolling (2x)    | ~2000     | Medium | Medium     |
| Deferred instantiation | ~1000+    | Medium | High       |

```typescript
// Tail-recursive tuple builder (common in kitz-style libraries)
type BuildTuple<N extends number, T, Acc extends T[] = []> = Acc['length'] extends N
  ? Acc
  : BuildTuple<N, T, [...Acc, T]>

type FiveStrings = BuildTuple<5, string>
// [string, string, string, string, string]
```

### tsgo-Specific Performance Notes

tsgo's 7-10x speedup applies to ALL type checking, including complex type-level computation. This means:

- Recursive types that were slow in tsc become fast in tsgo
- Complex conditional types that caused IDE lag become responsive
- Type instantiation limits remain the same (they're semantic, not performance-based)

**Implication for kitz**: The performance budget for type-level computation effectively increased 7-10x. Patterns that were "too expensive" in tsc may now be viable. However, the depth limits (1000 tail-recursive, 50 non-tail) are unchanged.

---

## 7. Cross-References: Typeclasses / TRAITOR

### How These Areas Connect to Typeclasses

A typeclass system in TypeScript needs:

1. **HKTs** (Section 3a): To express `Functor<F>` where `F` is a type constructor. Kitz's `Kind` module provides this.

2. **Instance registration**: A way to say "Array has a Functor instance." Approaches:
   - **Module-level constants**: `export const ArrayFunctor: Functor<ArrayHKT> = { map: ... }` (tree-shakeable)
   - **Global registry interface**: Use declaration merging to register instances (not tree-shakeable)
   - **Implicit resolution via generics**: Pass instances as parameters (most tree-shakeable, most verbose)

3. **Type-level instance lookup**: Given a concrete type, resolve its typeclass instance at the type level.

4. **Branded witnesses** (Section 3c): Prove that a type satisfies a constraint at the type level.

5. **Variance** (Section 3f): Typeclass instances must respect variance. A `Functor<Array>` should be covariant in its element type.

### Ad-Hoc Polymorphism Patterns

```typescript
// Pattern 1: Explicit dictionary passing (fp-ts style)
interface Ord<A> {
  compare: (x: A, y: A) => -1 | 0 | 1
}

const numberOrd: Ord<number> = {
  compare: (x, y) => (x < y ? -1 : x > y ? 1 : 0),
}

const sort =
  <A>(ord: Ord<A>) =>
  (arr: A[]): A[] =>
    [...arr].sort(ord.compare)
sort(numberOrd)([3, 1, 2]) // [1, 2, 3]

// Pattern 2: Module-scoped instances (Effect style)
// Instances are module-level exports, consumers import what they need
import { Order } from 'effect'
const NumberOrder = Order.number
pipe([3, 1, 2], Array.sort(NumberOrder))

// Pattern 3: Registration + lookup (requires codegen or declaration merging)
interface TypeClassRegistry {
  // Filled by declaration merging
}
declare module './typeclass-registry' {
  interface TypeClassRegistry {
    'Ord/number': Ord<number>
  }
}
```

### Feasibility Assessment for kitz

| Component                   | Status            | Difficulty | Tree-Shakeable              |
| --------------------------- | ----------------- | ---------- | --------------------------- |
| HKT encoding                | DONE (fn/kind.ts) | --         | Yes                         |
| Type-level Kind application | DONE              | --         | Yes (type-only)             |
| Kind composition/Pipe       | DONE              | --         | Yes (type-only)             |
| Typeclass interfaces        | TODO              | Low        | Yes                         |
| Instance definitions        | TODO              | Low        | Yes (module-level consts)   |
| Instance derivation         | TODO              | Medium     | Depends on approach         |
| Implicit resolution         | BLOCKED           | High       | No (needs language support) |

**Recommended approach**: Follow Effect's model -- typeclass instances as module-level function exports, passed explicitly. This maximizes tree-shaking and works with tsgo. Avoid global registries or declaration merging for instances (not tree-shakeable, hard to reason about).

---

## 8. Key Resources

### tsgo / TypeScript 7

- [TypeScript 7 December 2025 Progress](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
- [typescript-go GitHub Repository](https://github.com/microsoft/typescript-go)
- [API Story Discussion #455](https://github.com/microsoft/typescript-go/discussions/455)
- [Go API Discussion #481](https://github.com/microsoft/typescript-go/discussions/481)
- [Effective TypeScript: 2025 Recap](https://effectivetypescript.com/2025/12/19/ts-2025/)
- [State of TypeScript 2026](https://devnewsletter.com/p/state-of-typescript-2026/)

### HKTs and Typeclasses

- [Effect: Encoding HKTs in TypeScript](https://dev.to/effect/encoding-of-hkts-in-typescript-5c3)
- [hkt-core Library](https://github.com/Snowflyt/hkt-core)
- [TypeScript HKT Proposal #55280](https://github.com/microsoft/TypeScript/issues/55280)
- [Typeclasses in TypeScript](https://paulgray.net/typeclasses-in-typescript/)
- [Ad-hoc polymorphism in TypeScript](https://medium.com/@dmkolesnikov/ad-hoc-polymorphism-in-typescript-with-implicit-context-5c11dd668dd)

### Tree-Shaking and Module Design

- [Effect: Building Pipelines (Dual API)](https://effect.website/docs/getting-started/building-pipelines/)
- [Novel Technique for Tree-Shakable Libraries (Correttore)](https://softwaremill.com/a-novel-technique-for-creating-ergonomic-and-tree-shakable-typescript-libraries/)
- [Tree-Shaking Reference Guide (Smashing)](https://www.smashingmagazine.com/2021/05/tree-shaking-reference-guide/)

### Type Safety

- [Effect: Branded Types](https://effect.website/docs/code-style/branded-types/)
- [TypeScript Performance Wiki](https://github.com/microsoft/Typescript/wiki/Performance)
- [NoInfer Utility Type](https://www.totaltypescript.com/noinfer)
- [Template Literal Types (Type-Level TypeScript)](https://type-level-typescript.com/template-literal-types)
- [Breaking TypeScript's Recursion Limits](https://herringtondarkholme.github.io/2023/04/30/typescript-magic/)
- [Type-Level Arithmetic](https://softwaremill.com/implementing-advanced-type-level-arithmetic-in-typescript-part-2/)

### JSDoc and Documentation

- [TSDoc Standard](https://tsdoc.org/)
- [eslint-plugin-tsdoc](https://tsdoc.org/pages/packages/eslint-plugin-tsdoc/)
- [doc-vitest (Doctest for Vitest)](https://github.com/ssssota/doc-vitest)
- [generate-jsdoc-example-tests](https://github.com/SacDeNoeuds/generate-jsdoc-example-tests)
- [Deno: How to Document JavaScript](https://deno.com/blog/document-javascript-package)

### Code Generation

- [ts-morph](https://ts-morph.com/) (note: tsc API dependency, future uncertain with tsgo)
- [GraphQL Code Generator](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript)
- [babel-plugin-codegen](https://github.com/kentcdodds/babel-plugin-codegen)
