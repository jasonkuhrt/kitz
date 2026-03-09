# Kitz Vision Document

> The Definitive Strategic and Technical Vision for Kitz
>
> Compiled: 2026-02-28
> Status: Pre-1.0, Actively Developed
> Foundation: Effect, TypeScript (tsgo), pnpm Monorepo
> Target: Agentic-first, type-safe, tree-shakeable utility ecosystem

---

## Table of Contents

1. [Executive Vision](#1-executive-vision)
2. [The Competitive Landscape](#2-the-competitive-landscape)
3. [TRAITOR v2: Compile-Time Typeclasses](#3-traitor-v2-compile-time-typeclasses)
4. [The Tooling Constellation](#4-the-tooling-constellation)
5. [Code Generation Strategy](#5-code-generation-strategy)
6. [JSDoc as Infrastructure](#6-jsdoc-as-infrastructure)
7. [Type Safety Without Compromise](#7-type-safety-without-compromise)
8. [The Agentic-First Library](#8-the-agentic-first-library)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Risk Analysis](#10-risk-analysis)
11. [The Derivation Chain](#11-the-derivation-chain)

---

## 1. Executive Vision

### The 30-Second Pitch

Kitz is a type-safe, tree-shakeable utility ecosystem for TypeScript built on Effect. Where Effect gives you the runtime -- fibers, structured concurrency, error channels, dependency injection -- kitz gives you the types, the data structures, the patterns, and the tooling to make Effect development feel like writing in a language with a real type system. Kitz is what TypeScript's standard library should have been, designed from day one for AI-assisted development.

### The 5-Minute Pitch

TypeScript's ecosystem has a gap. You have Effect for structured programming, Zod for schema validation, tRPC for API type safety, and a hundred utility libraries for everything else. None of them talk to each other at the type level. None of them are designed for the world where AI agents write most of your code. None of them treat their type system as a first-class product.

Kitz fills that gap by providing:

**A unified type vocabulary.** When your `Arr` module, your `Str` module, your schema validation, your error types, and your service definitions all share the same type-level infrastructure -- higher-kinded types, branded types, variance annotations, compile-time dispatch -- everything composes. You don't need adapters between libraries. You don't need type assertion escape hatches. The types flow.

**Tooling that understands your code.** An MCP server that lets AI agents inspect your services, scaffold new modules, and explain type errors. An OxLint plugin that catches kitz-specific anti-patterns at lint time. An LSP server that provides completions, diagnostics, and refactorings aware of Effect patterns and kitz conventions. These aren't afterthoughts -- they're first-class products that make kitz qualitatively better than libraries that only ship `.d.ts` files.

**Agentic-first design.** Every function has JSDoc that is simultaneously human-readable, LLM-optimized, and machine-verifiable. Every module follows predictable conventions that AI agents can learn once and apply everywhere. Code generation scaffolds correct-by-construction modules. The entire library is designed so that an AI agent using kitz produces better code than a human using anything else.

### The Full Thesis

We are at an inflection point in how software gets written. AI agents are moving from "autocomplete that sometimes works" to "junior developers that always follow conventions." The libraries that win in this world are not the ones with the cleverest APIs -- they're the ones that make it easiest for agents to produce correct code.

This insight reshapes every design decision. JSDoc stops being documentation and becomes machine-readable metadata that drives code generation, lint rules, hover information, and MCP tool responses. Module conventions stop being aesthetic preferences and become protocols that agents follow to produce structurally correct code. Type-level programming stops being a flex and becomes a compile-time verification layer that catches AI-generated bugs before they run.

Kitz's thesis is that a library designed for this world -- where the primary consumer of your API surface is an AI agent, and the primary consumer of your type errors is an AI agent, and the primary consumer of your documentation is an AI agent -- looks fundamentally different from a library designed for human developers reading docs in a browser.

This does not mean kitz is hostile to humans. Quite the opposite: the same properties that make a library AI-friendly (predictable conventions, precise types, rich metadata, excellent error messages) make it human-friendly too. The difference is in priorities. When there's a trade-off between "slightly more ergonomic for a human typing code" and "significantly more predictable for an agent generating code," kitz chooses the latter.

The endgame is a development environment where you describe what you want in natural language, and an AI agent scaffolds a correct, type-safe, tree-shakeable, well-tested implementation using kitz primitives -- and the tooling verifies it's correct before you ever run it. Not because the agent is perfect, but because the library's design makes correctness the path of least resistance.

This is not a distant future. Kitz already builds with tsgo (7-10x faster than tsc). It already has Claude Code skills that scaffold modules and services. It already has a type-level trait system (Display) that proves compile-time dispatch works in TypeScript. The vision document you're reading maps the path from "already works" to "dominant platform."

### Why Not Just Use Effect?

This question deserves a direct answer. Effect provides `Array`, `String`, `Number`, `Record`, `Struct`, `Tuple`, `Option`, `Either`, `Cause`, `Exit`, `Fiber`, `Layer`, `Context`, `Schema`, `Match`, and dozens of other modules. Why does kitz exist?

Three reasons:

**1. Different design philosophy.** Effect's utility modules are designed to serve Effect's runtime. `Effect.Array.map` returns an `Array`, not an `Effect`. But the naming, organization, and conventions are optimized for the Effect ecosystem. Kitz's utility modules are designed as standalone building blocks that work whether or not you use Effect's runtime. You can use `Arr.filter`, `Str.split`, and `Obj.merge` in a plain TypeScript project. You can use them in an Express handler. You can use them in a React component. Effect's optional peer dependency means you get Effect-specific features when Effect is present, but nothing breaks when it's not.

**2. Type-level infrastructure.** Kitz provides type-level utilities that Effect does not: the HKT system (`Kind.Apply`, `Kind.Pipe`, `Kind.PipeRight`), the optic system (type-safe lenses and prisms), the Display trait (compile-time type-to-string conversion), and the proposed TRAITOR v2 typeclass system. These are foundational for a certain style of type-level programming that Effect intentionally does not pursue (Effect's type-level focus is on the Effect/Layer/Schema types, not on general-purpose type manipulation).

**3. Tooling ambition.** Effect's tooling is focused on the Effect developer experience (fiber inspector, span tracer, language service). Kitz's tooling ambition is broader: an MCP server for AI-assisted development, an OxLint plugin for convention enforcement, a codegen system for scaffolding, and an LSP server for editor intelligence. These tools serve anyone using kitz's patterns, not just Effect users.

In short: Effect is the runtime. Kitz is the utility layer and tooling ecosystem. They compose, they don't compete.

---

## 2. The Competitive Landscape

### Effect: The Foundation, Not the Competitor

Effect is kitz's runtime foundation. Kitz does not compete with Effect -- it extends it. Effect provides the execution model (fibers, structured concurrency), the error model (typed error channels), the dependency model (layers and services), and the data model (Option, Either, Cause, Exit). Kitz provides the utility layer on top: data structures (Arr, Str, Obj, Num), type-level utilities (HKTs, Display, optics), patterns (data modeling, curried functions), and the tooling ecosystem (MCP, LSP, lint).

The relationship is analogous to Scala's standard library sitting on top of the JVM, or Haskell's base library sitting on top of GHC's runtime. Effect is the runtime. Kitz is the library.

The risk of this positioning is that Effect could build all of this themselves. We address this in the Risk Analysis section. The short answer: Effect is focused on the runtime story, and building a comprehensive utility-and-tooling ecosystem is a different kind of project that benefits from a different kind of focus.

### fp-ts: The Predecessor

fp-ts proved that functional programming patterns could work in TypeScript. It introduced HKT encodings, typeclass hierarchies, and pipe-based programming to the TypeScript ecosystem. But fp-ts had two fundamental limitations: its HKT encoding was cumbersome (URI-based string tags), and it never solved tree-shaking. Importing any typeclass instance imported the entire typeclass module.

Kitz inherits fp-ts's ambition -- rich type-level programming, algebraic abstractions, composable utilities -- while learning from its failures. Kitz's HKT encoding (intersection-based, pioneered by Effect) is simpler and more performant. Kitz's module structure (fine-grained files, `sideEffects: false`, namespace re-exports) ensures tree-shaking works. And kitz's TRAITOR v2 proposal (Section 3) shows how to get typeclass-like dispatch without the runtime overhead that fp-ts required.

### Zod / Valibot: Schema Validation

Zod and Valibot own the "validate unknown data" space. Kitz does not compete here directly -- it uses Zod (as a dependency) and Effect Schema for its own validation needs. But kitz's type-level infrastructure (branded types, Display, optics) provides capabilities that schema libraries alone cannot: type-level transformations, compile-time dispatch, and deep structural lensing.

The interesting tension is that Zod 4 is moving toward Effect-like patterns (pipe-based API, better tree-shaking), while Effect Schema provides Zod-like capabilities with deeper Effect integration. Kitz sits at the intersection, using both where appropriate and adding type-level capabilities that neither provides.

### tRPC: API Type Safety

tRPC achieves remarkable DX through pure TypeScript type inference -- no code generation, no runtime overhead, just types flowing from server to client. This is the gold standard for "invisible tooling." Kitz learns from tRPC's lesson: **the best DX is no DX**. If kitz's type-level design is excellent, many features "just work" through TypeScript's existing tooling without any plugins or extensions.

But tRPC's scope is narrow (RPC type safety). Kitz's scope is broad (everything a TypeScript developer needs). The tooling constellation kitz proposes goes beyond what pure type inference can provide.

### Prisma: Database + Tooling

Prisma is the best prior art for "library that ships serious tooling." Prisma's Language Server, CLI, schema format, and code generator form an integrated system where each piece reinforces the others. The schema defines the types, the generator produces the client, the language server provides intelligence for the schema, and the CLI manages the lifecycle.

Kitz's tooling constellation follows this pattern: the JSDoc defines the metadata, the MCP server exposes it to agents, the LSP server provides intelligence in editors, and the lint rules enforce conventions. Each piece is useful alone, but together they create an integrated development experience.

### Tailwind CSS: The Tooling Gold Standard

Tailwind's architecture is the direct inspiration for kitz's tooling strategy. Tailwind ships a standalone LSP server as the core intelligence engine, with a thin VSCode extension wrapping it and other editors consuming the LSP directly. The LSP reads the Tailwind config, understands the class generation rules, and provides completions, diagnostics, and hover information.

Kitz should follow this architecture exactly: a standalone LSP server as the core, with thin editor-specific wrappers. This approach survived Tailwind's growth from a small utility to a dominant framework, and it will survive kitz's growth too.

---

## 3. TRAITOR v2: Compile-Time Typeclasses

This is the crown jewel of kitz's technical vision. The original TRAITOR system (June-November 2025) attempted runtime typeclass dispatch in TypeScript and was removed after five months because the complexity-to-value ratio was too high. But the core insight -- that TypeScript needs a mechanism for ad-hoc polymorphism -- remains valid. TRAITOR v2 is the answer, redesigned from scratch around a single principle: **everything happens at compile time.**

### 3.0 The Design Principles of TRAITOR v2

Before diving into the implementation, let's establish the non-negotiable design principles that TRAITOR v2 must satisfy. These come directly from the failure analysis of TRAITOR v1:

**Principle 1: Zero mandatory runtime cost.**
A typeclass that only needs type-level behavior must have zero runtime code. No proxies, no registries, no function calls, no bundle size impact. This rules out any design where trait registration has runtime side effects.

**Principle 2: Perfect tree-shaking at every tier.**
If a user imports `Eq` but not `Ord`, all `Ord`-related code must be eliminated by the bundler. This rules out shared registries, global dispatch tables, and any pattern where importing one trait pulls in others.

**Principle 3: No global mutable state.**
Module-level side effects that mutate shared state are forbidden. This rules out the TRAITOR v1 pattern where importing a module auto-registered trait instances.

**Principle 4: Incremental adoption.**
A user should be able to use Tier 1 without knowing Tier 2 or Tier 3 exist. Each tier is independently useful. This rules out designs where all three tiers are required for basic functionality.

**Principle 5: tsgo compatibility.**
Nothing in the design may depend on the TypeScript compiler API (Strada or otherwise). Everything must work with tsgo's standard type checker and standard LSP protocol. This rules out compiler plugins, transformer plugins, and any build-time type introspection.

**Principle 6: Extension without modification.**
Third-party libraries must be able to add typeclass instances for their own types without modifying kitz's source code. This requires an open-world extensibility mechanism.

With these principles in hand, let's see how each tier satisfies them.

### 3.1 What Display Proves

Three days after TRAITOR v1 was removed, the `Display<T>` trait was introduced as a lightweight, purely type-level successor. Display uses TypeScript's declaration merging as its dispatch mechanism:

```typescript
// The trait definition (packages/core/src/ts/traits/display.ts)
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      // Empty by default -- extended by domain modules
    }
  }
}

export type Display<$Type> =
  // ... primitive handling ...
  : [HandlersResult<$Type>] extends [never]
    ? $Type extends object ? 'object' : '?'
    : HandlersResult<$Type>
```

```typescript
// A domain registering its handler (in arr.ts or a co-located file)
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      Array: $Type extends readonly (infer E)[] ? `${Display<E>}[]` : never
    }
  }
}
```

This pattern has several remarkable properties:

1. **Zero runtime cost.** The entire dispatch happens in the type checker. No proxies, no registries, no function calls. The compiled JavaScript is empty.

2. **Perfect tree-shaking.** Since there is no runtime code, there is nothing to shake. The type-level trait adds exactly zero bytes to the bundle.

3. **Open extensibility.** Any module -- including third-party modules -- can register a handler by augmenting the `KITZ.Traits.Display.Handlers` interface. This is precisely the "open world" property of Haskell typeclasses.

4. **Compile-time coherence.** TypeScript's interface merging is additive -- you cannot remove a handler once registered. This prevents the "last-write-wins" problem that plagued TRAITOR v1's mutable registry.

5. **Structural dispatch.** The handler uses a conditional type (`$Type extends readonly (infer E)[] ? ... : never`) to match types structurally. This is more flexible than nominal dispatch -- it works with any array-like type, not just types explicitly registered.

Display proves that **declaration merging IS the dispatch mechanism** for compile-time typeclasses in TypeScript. TRAITOR v2 generalizes this pattern.

### 3.2 The HKT Foundation

TRAITOR v2 builds on kitz's existing HKT system in `packages/core/src/fn/kind.ts`. The core mechanism is intersection-based type application:

```typescript
// The HKT application mechanism
export type Apply<$Kind, $Args> = ($Kind & { parameters: $Args })['return']

// A Kind definition
export interface Kind<$Params = unknown, $Return = unknown> {
  parameters: $Params
  return: $Return
}

// A concrete kind (type-level function)
interface ArrayOf extends Kind {
  return: Array<this['parameters'][0]>
}

// Application
type StringArray = Apply<ArrayOf, [string]> // Array<string>
```

This encoding, pioneered by Effect and refined in kitz, supports:

- **Multi-parameter kinds**: `this['parameters']` is a tuple, so `this['parameters'][0]`, `this['parameters'][1]`, etc. give access to multiple type arguments.
- **Kind composition**: `Kind.Pipe<[Awaited, ArrayElement], Promise<string[]>>` applies kinds left-to-right.
- **Short-circuiting composition**: `Kind.PipeRight` uses `Either` to propagate type-level errors.
- **Private kinds**: Symbol-keyed interfaces prevent accidental access to kind internals.

For typeclasses, HKTs are essential. Without them, you cannot write `Functor<F>` where `F` is `Array` or `Option` or `Effect` -- you need the type constructor itself as a parameter, not an applied type.

### 3.3 The Three Tiers of TRAITOR v2

TRAITOR v2 is not a single mechanism but three complementary tiers, each with different trade-offs. A typeclass author chooses which tier(s) to support based on the use case.

#### Tier 1: Type-Level Only (Like Display)

**Cost:** Zero runtime. Zero bundle size. Zero dispatch overhead.
**Capability:** Type-level computation. No runtime behavior.
**Tree-shaking:** Perfect.
**Use case:** Type display, type classification, type transformation, compile-time validation.

This is the Display pattern generalized. A Tier 1 typeclass is a type-level function that dispatches based on the input type, using declaration merging for extensibility.

```typescript
// ═══════════════════════════════════════════════════════════════
// Tier 1 Example: Eq (type-level equality checking)
// ═══════════════════════════════════════════════════════════════

// The trait definition
declare global {
  namespace KITZ.Traits.Eq {
    /**
     * Registry of type-level equality implementations.
     *
     * Each handler maps a type to `true` (definitely equal)
     * or `false` (definitely not equal) or `never` (no opinion).
     *
     * $A and $B are the two types being compared.
     */
    interface Handlers<$A, $B> {
      // Extended by domain modules
    }
  }
}

/**
 * Type-level equality check.
 *
 * Returns `true` if $A and $B are structurally equal,
 * `false` if they are provably different, `boolean` if unknown.
 */
export type Eq<$A, $B> =
  // Identical types are always equal
  [$A] extends [$B] ? ([$B] extends [$A] ? true : _CheckHandlers<$A, $B>) : _CheckHandlers<$A, $B>

type _CheckHandlers<$A, $B> = [HandlersResult<$A, $B>] extends [never]
  ? false // No handler claims equality
  : HandlersResult<$A, $B>

type HandlersResult<$A, $B> = [keyof KITZ.Traits.Eq.Handlers<$A, $B>] extends [never]
  ? never
  : KITZ.Traits.Eq.Handlers<$A, $B>[keyof KITZ.Traits.Eq.Handlers<$A, $B>]
```

```typescript
// ═══════════════════════════════════════════════════════════════
// Tier 1 Example: TypeName (type classification)
// ═══════════════════════════════════════════════════════════════

declare global {
  namespace KITZ.Traits.TypeName {
    interface Handlers<$Type> {}
  }
}

/**
 * Get a compile-time string name for any type.
 * Like Display but for machine consumption, not human display.
 */
export type TypeName<$Type> = $Type extends string
  ? 'string'
  : $Type extends number
    ? 'number'
    : $Type extends boolean
      ? 'boolean'
      : $Type extends null
        ? 'null'
        : $Type extends undefined
          ? 'undefined'
          : $Type extends symbol
            ? 'symbol'
            : $Type extends bigint
              ? 'bigint'
              : [TypeNameHandlersResult<$Type>] extends [never]
                ? 'unknown'
                : TypeNameHandlersResult<$Type>

// Third-party extension
declare global {
  namespace KITZ.Traits.TypeName {
    interface Handlers<$Type> {
      Effect: $Type extends Effect.Effect<any, any, any> ? 'Effect' : never
      Option: $Type extends Option.Option<any> ? 'Option' : never
      Chunk: $Type extends Chunk.Chunk<any> ? 'Chunk' : never
    }
  }
}
```

```typescript
// ═══════════════════════════════════════════════════════════════
// Tier 1 Example: Serializable (type-level serialization check)
// ═══════════════════════════════════════════════════════════════

declare global {
  namespace KITZ.Traits.Serializable {
    /**
     * Handlers return the serialized type representation,
     * or never if the type is not serializable.
     */
    interface Handlers<$Type> {}
  }
}

/**
 * Check if a type is JSON-serializable and compute the serialized form.
 *
 * Returns the JSON-compatible type, or `never` if not serializable.
 */
export type Serializable<$Type> = $Type extends string | number | boolean | null
  ? $Type
  : $Type extends undefined
    ? never // undefined is not JSON-serializable
    : $Type extends Function
      ? never // functions are not JSON-serializable
      : $Type extends symbol
        ? never // symbols are not JSON-serializable
        : [SerializableHandlersResult<$Type>] extends [never]
          ? $Type extends object
            ? { [K in keyof $Type]: Serializable<$Type[K]> }
            : never
          : SerializableHandlersResult<$Type>

// Domain extension: Date serializes to string
declare global {
  namespace KITZ.Traits.Serializable {
    interface Handlers<$Type> {
      Date: $Type extends Date ? string : never
      Map: $Type extends Map<infer K, infer V> ? Array<[Serializable<K>, Serializable<V>]> : never
    }
  }
}
```

Tier 1 typeclasses are the workhorse of the system. They cover any situation where the "implementation" is a type-level computation: transforming types, classifying types, validating type relationships, and computing derived types. The key insight is that a surprising amount of what typeclasses do is inherently type-level -- you don't need runtime dispatch to ask "what does this type look like as a string?" or "is this type serializable?"

#### Tier 2: Explicit Instance Passing (Like Effect/fp-ts)

**Cost:** One extra argument per polymorphic call. No dispatch overhead.
**Capability:** Runtime behavior with type-safe polymorphism.
**Tree-shaking:** Perfect (instances are module-level exports, unused ones are eliminated).
**Use case:** Equality comparison, ordering, hashing, pretty-printing, serialization -- any operation that needs runtime behavior.

Tier 2 follows the fp-ts/Effect model: typeclass instances are plain objects, and polymorphic functions accept instances as explicit parameters. The type system ensures the correct instance is passed, and tree-shaking eliminates unused instances.

```typescript
// ═══════════════════════════════════════════════════════════════
// Tier 2 Foundation: Typeclass Interface Definitions
// ═══════════════════════════════════════════════════════════════

/**
 * The Eq typeclass: structural equality for a type A.
 *
 * Laws:
 * - Reflexivity: Eq.equals(a, a) === true
 * - Symmetry: Eq.equals(a, b) === Eq.equals(b, a)
 * - Transitivity: Eq.equals(a, b) && Eq.equals(b, c) => Eq.equals(a, c)
 *
 * @typeclass
 * @law reflexivity: (a: A) => Eq.equals(a, a) === true
 * @law symmetry: (a: A, b: A) => Eq.equals(a, b) === Eq.equals(b, a)
 * @law transitivity: (a: A, b: A, c: A) =>
 *   !(Eq.equals(a, b) && Eq.equals(b, c)) || Eq.equals(a, c)
 */
export interface Eq<in A> {
  readonly equals: (self: A, that: A) => boolean
}

/**
 * The Ord typeclass: total ordering for a type A.
 * Extends Eq -- anything orderable is also comparable for equality.
 *
 * @typeclass
 * @law reflexivity: (a: A) => Ord.compare(a, a) === 0
 * @law antisymmetry: (a: A, b: A) =>
 *   !(Ord.compare(a, b) <= 0 && Ord.compare(b, a) <= 0) || Eq.equals(a, b)
 * @law transitivity: (a: A, b: A, c: A) =>
 *   !(Ord.compare(a, b) <= 0 && Ord.compare(b, c) <= 0) || Ord.compare(a, c) <= 0
 * @law totality: (a: A, b: A) =>
 *   Ord.compare(a, b) <= 0 || Ord.compare(b, a) <= 0
 */
export interface Ord<in A> extends Eq<A> {
  readonly compare: (self: A, that: A) => -1 | 0 | 1
}

/**
 * The Hash typeclass: deterministic hashing for a type A.
 * Requires Eq -- equal values must hash to the same value.
 *
 * @typeclass
 * @law consistency: (a: A, b: A) =>
 *   !Eq.equals(a, b) || Hash.hash(a) === Hash.hash(b)
 */
export interface Hash<in A> extends Eq<A> {
  readonly hash: (self: A) => number
}

/**
 * The Show typeclass: human-readable string representation.
 *
 * Unlike Display (Tier 1, type-level only), Show operates at runtime
 * and can inspect actual values.
 *
 * @typeclass
 * @law roundtrip: ideally, parse(Show.show(a)) deepEquals a
 */
export interface Show<in A> {
  readonly show: (self: A) => string
}

/**
 * The Functor typeclass: structure-preserving mapping.
 *
 * @typeclass
 * @law identity: (fa: F<A>) => F.map(fa, identity) deepEquals fa
 * @law composition: (fa: F<A>, f: A => B, g: B => C) =>
 *   F.map(fa, compose(g, f)) deepEquals F.map(F.map(fa, f), g)
 */
export interface Functor<F extends Kind> {
  readonly map: <A, B>(self: Apply<F, [A]>, f: (a: A) => B) => Apply<F, [B]>
}

/**
 * The Foldable typeclass: structures that can be reduced to a summary value.
 *
 * @typeclass
 */
export interface Foldable<F extends Kind> {
  readonly reduce: <A, B>(self: Apply<F, [A]>, initial: B, f: (acc: B, a: A) => B) => B
}
```

```typescript
// ═══════════════════════════════════════════════════════════════
// Tier 2: Instance Definitions (module-level exports)
// ═══════════════════════════════════════════════════════════════

// --- String instances ---

/** @instance Eq<string> */
export const stringEq: Eq<string> = {
  equals: (self, that) => self === that,
}

/** @instance Ord<string> */
export const stringOrd: Ord<string> = {
  ...stringEq,
  compare: (self, that) => (self < that ? -1 : self > that ? 1 : 0),
}

/** @instance Hash<string> */
export const stringHash: Hash<string> = {
  ...stringEq,
  hash: (self) => {
    let h = 0
    for (let i = 0; i < self.length; i++) {
      h = ((h << 5) - h + self.charCodeAt(i)) | 0
    }
    return h
  },
}

/** @instance Show<string> */
export const stringShow: Show<string> = {
  show: (self) => JSON.stringify(self),
}

// --- Number instances ---

/** @instance Eq<number> */
export const numberEq: Eq<number> = {
  equals: (self, that) => self === that,
}

/** @instance Ord<number> */
export const numberOrd: Ord<number> = {
  ...numberEq,
  compare: (self, that) => (self < that ? -1 : self > that ? 1 : 0),
}

// --- Array instances (parameterized by element instance) ---

/**
 * Derive an Eq instance for arrays given an Eq instance for elements.
 *
 * @instance Eq<ReadonlyArray<A>> given Eq<A>
 */
export const arrayEq = <A>(elemEq: Eq<A>): Eq<ReadonlyArray<A>> => ({
  equals: (self, that) =>
    self.length === that.length && self.every((a, i) => elemEq.equals(a, that[i]!)),
})

/**
 * Derive an Ord instance for arrays (lexicographic ordering).
 *
 * @instance Ord<ReadonlyArray<A>> given Ord<A>
 */
export const arrayOrd = <A>(elemOrd: Ord<A>): Ord<ReadonlyArray<A>> => ({
  ...arrayEq(elemOrd),
  compare: (self, that) => {
    const len = Math.min(self.length, that.length)
    for (let i = 0; i < len; i++) {
      const cmp = elemOrd.compare(self[i]!, that[i]!)
      if (cmp !== 0) return cmp
    }
    return numberOrd.compare(self.length, that.length)
  },
})

/**
 * Functor instance for ReadonlyArray.
 *
 * @instance Functor<ArrayHKT>
 */
export const arrayFunctor: Functor<ArrayHKT> = {
  map: (self, f) => self.map(f),
}

/**
 * Foldable instance for ReadonlyArray.
 *
 * @instance Foldable<ArrayHKT>
 */
export const arrayFoldable: Foldable<ArrayHKT> = {
  reduce: (self, initial, f) => self.reduce(f, initial),
}

// The HKT witness for Array
interface ArrayHKT extends Kind {
  return: ReadonlyArray<this['parameters'][0]>
}
```

````typescript
// ═══════════════════════════════════════════════════════════════
// Tier 2: Polymorphic Functions Using Instances
// ═══════════════════════════════════════════════════════════════

/**
 * Sort an array using an Ord instance.
 *
 * @pure
 * @complexity O(n log n)
 *
 * @example
 * ```ts
 * import { Ord, sort } from '@kitz/core/typeclass'
 *
 * sort(numberOrd)([3, 1, 4, 1, 5]) // [1, 1, 3, 4, 5]
 * sort(stringOrd)(['banana', 'apple']) // ['apple', 'banana']
 * ```
 */
export const sort =
  <A>(ord: Ord<A>) =>
  (self: ReadonlyArray<A>): ReadonlyArray<A> =>
    [...self].sort(ord.compare)

/**
 * Remove duplicates from an array using an Eq instance.
 *
 * @pure
 * @complexity O(n^2)
 *
 * @example
 * ```ts
 * nub(numberEq)([1, 2, 1, 3, 2]) // [1, 2, 3]
 * ```
 */
export const nub =
  <A>(eq: Eq<A>) =>
  (self: ReadonlyArray<A>): ReadonlyArray<A> =>
    self.filter((a, i) => self.findIndex((b) => eq.equals(a, b)) === i)

/**
 * Group consecutive equal elements.
 *
 * @pure
 *
 * @example
 * ```ts
 * group(numberEq)([1, 1, 2, 2, 2, 1]) // [[1, 1], [2, 2, 2], [1]]
 * ```
 */
export const group =
  <A>(eq: Eq<A>) =>
  (self: ReadonlyArray<A>): ReadonlyArray<ReadonlyArray<A>> => {
    if (self.length === 0) return []
    const result: A[][] = [[self[0]!]]
    for (let i = 1; i < self.length; i++) {
      const current = self[i]!
      const lastGroup = result[result.length - 1]!
      if (eq.equals(lastGroup[0]!, current)) {
        lastGroup.push(current)
      } else {
        result.push([current])
      }
    }
    return result
  }

/**
 * Map over a structure and collect the results.
 *
 * This is a generic function that works with any Functor.
 *
 * @example
 * ```ts
 * // Works with arrays
 * fmap(arrayFunctor)([1, 2, 3], x => x * 2) // [2, 4, 6]
 *
 * // Works with Option (once Option has a Functor instance)
 * fmap(optionFunctor)(Option.some(5), x => x * 2) // Option.some(10)
 * ```
 */
export const fmap =
  <F extends Kind>(functor: Functor<F>) =>
  <A, B>(self: Apply<F, [A]>, f: (a: A) => B): Apply<F, [B]> =>
    functor.map(self, f)
````

Tier 2 is verbose but honest. The caller must name the instance they want. This has three major advantages:

1. **Perfect tree-shaking.** If you never import `stringHash`, it's eliminated. If you never import `arrayFunctor`, it's eliminated. There is no registry that pulls in everything.

2. **No ambiguity.** There's exactly one `Ord<string>` -- the one you imported. No coherence problems, no "which instance was registered last?" confusion.

3. **Composition is explicit.** `arrayEq(stringEq)` makes it clear that array equality depends on element equality. There's no magic resolution of nested instances.

The cost is verbosity. `sort(numberOrd)([3, 1, 2])` is more keystrokes than Haskell's `sort [3, 1, 2]`. This is where Tier 3 comes in.

#### Tier 3: Codegen-Assisted Dispatch (Build-Time Generated Lookup Tables)

**Cost:** A build step. Zero runtime dispatch overhead (static lookup table).
**Capability:** Automatic instance resolution without explicit passing.
**Tree-shaking:** Perfect (codegen produces only the instances you use).
**Use case:** Ergonomic API when explicit instance passing is too verbose.

Tier 3 is the ambitious tier. It uses build-time code generation to produce static lookup tables that map types to their instances. The key insight is that if you can enumerate the types in your program at build time, you can generate a static dispatch table that eliminates the need for both runtime dispatch AND explicit instance passing.

```typescript
// ═══════════════════════════════════════════════════════════════
// Tier 3: Codegen Input -- Typeclass Instance Registry
// ═══════════════════════════════════════════════════════════════

// The user declares instances in a config file or via JSDoc annotations.
// A build-time codegen step reads these declarations and produces a
// static lookup module.

// --- Input: kitz.typeclasses.ts (user-authored) ---

/**
 * @typeclass-instances
 *
 * This file declares which typeclass instances are available
 * for which types. The kitz codegen tool reads this file and
 * generates a static dispatch module.
 */
export const instances = {
  Eq: {
    string: () => import('./instances/string.js').then((m) => m.stringEq),
    number: () => import('./instances/number.js').then((m) => m.numberEq),
    boolean: () => import('./instances/boolean.js').then((m) => m.booleanEq),
    // Parameterized instances use factory functions
    'Array<*>': (elemEq: Eq<unknown>) =>
      import('./instances/array.js').then((m) => m.arrayEq(elemEq)),
  },
  Ord: {
    string: () => import('./instances/string.js').then((m) => m.stringOrd),
    number: () => import('./instances/number.js').then((m) => m.numberOrd),
  },
} as const
```

```typescript
// ═══════════════════════════════════════════════════════════════
// Tier 3: Codegen Output -- Static Dispatch Module
// ═══════════════════════════════════════════════════════════════

// --- Generated: __generated__/typeclass-dispatch.ts ---

/** @generated - DO NOT EDIT. Generated by kitz codegen. */

import { arrayEq, arrayOrd } from '../instances/array.js'
import { booleanEq } from '../instances/boolean.js'
import { numberEq, numberOrd } from '../instances/number.js'
import { stringEq, stringOrd } from '../instances/string.js'

// Static lookup tables -- tree-shakeable because they're plain imports
// Only the instances that are actually used survive tree-shaking.

/**
 * Resolve an Eq instance for a known type.
 *
 * This function is generated at build time from the typeclass
 * instance registry. It provides zero-overhead dispatch by
 * using a static lookup table.
 *
 * @generated
 */
export function eqFor<A>(witness: TypeWitness<A>): Eq<A> {
  switch (witness.tag) {
    case 'string':
      return stringEq as Eq<A>
    case 'number':
      return numberEq as Eq<A>
    case 'boolean':
      return booleanEq as Eq<A>
    case 'Array':
      return arrayEq(eqFor(witness.inner)) as Eq<A>
  }
}

/**
 * Resolve an Ord instance for a known type.
 * @generated
 */
export function ordFor<A>(witness: TypeWitness<A>): Ord<A> {
  switch (witness.tag) {
    case 'string':
      return stringOrd as Ord<A>
    case 'number':
      return numberOrd as Ord<A>
    case 'Array':
      return arrayOrd(ordFor(witness.inner)) as Ord<A>
  }
}

// Type witnesses -- compile-time proof that a type has an instance
interface TypeWitness<A> {
  readonly tag: string
  readonly inner?: TypeWitness<unknown>
}

// Pre-built witnesses for common types
export const string_: TypeWitness<string> = { tag: 'string' }
export const number_: TypeWitness<number> = { tag: 'number' }
export const boolean_: TypeWitness<boolean> = { tag: 'boolean' }
export const array_ = <A>(inner: TypeWitness<A>): TypeWitness<A[]> => ({
  tag: 'Array',
  inner,
})
```

```typescript
// ═══════════════════════════════════════════════════════════════
// Tier 3: User Code -- Ergonomic API
// ═══════════════════════════════════════════════════════════════

import { array_, eqFor, nub, number_, ordFor, sort, string_ } from '@kitz/core'

// Short, readable, zero-dispatch-overhead
const sortedNumbers = sort(ordFor(number_))([3, 1, 4, 1, 5])
const uniqueStrings = nub(eqFor(string_))(['a', 'b', 'a', 'c'])
const sortedStringArrays = sort(ordFor(array_(string_)))([
  ['b', 'a'],
  ['a', 'a'],
])

// The type witness is the only "extra" thing -- and it's tiny, descriptive,
// and compiler-verified. It's not "passing an instance" -- it's naming
// the type you're working with.
```

**Thinking out loud about Tier 3 alternatives:**

We considered several approaches for Tier 3 before arriving at type witnesses:

1. **Runtime typeof detection** (like TRAITOR v1): Rejected because it defeats tree-shaking and adds runtime overhead. The fundamental problem is that `typeof` cannot distinguish `string[]` from `number[]` -- both are `"object"`.

2. **TypeScript compiler plugin that injects instances**: Rejected because the tsgo API doesn't exist and may never support plugins.

3. **Branded type witnesses**: We considered using `Brand<"Eq">` tokens as proof that a type has an instance. This works at the type level but doesn't provide a runtime dispatch path.

4. **Module-level auto-import**: A codegen step that analyzes imports and inserts the correct instance. Rejected because it modifies user code, which is fragile and hard to debug.

5. **Type witnesses** (chosen): Small, descriptive values that name the type and resolve to the correct instance via a static switch. The witness is both a runtime dispatch key and a compile-time type proof. It's explicit enough to be debuggable, implicit enough to not feel like boilerplate.

The key trade-off in Tier 3 is between "zero extra syntax" (which requires either compiler support or runtime dispatch) and "minimal extra syntax" (type witnesses). Given the constraint that tree-shaking must never be compromised and tsgo may never have a plugin API, type witnesses are the best available compromise.

### 3.4 How TRAITOR v2 Differs from Prior Art

**vs. Haskell Typeclasses:**

Haskell's instance resolution is fully automatic -- the compiler finds the right instance based on the type at the call site. This is possible because GHC has access to the full type at compile time and can search the instance database. TypeScript's type system cannot do this search. TRAITOR v2's Tier 1 approximates it at the type level (via declaration merging), and Tier 3 approximates it at the value level (via type witnesses), but neither achieves the full "just works" experience of Haskell.

The advantage TRAITOR v2 has over Haskell is that Tier 2 (explicit instances) is always available as an escape hatch. In Haskell, when the instance resolver picks the wrong instance, you have limited options (newtypes, `TypeApplications`). In TRAITOR v2, you just pass the instance you want.

**vs. Rust Traits:**

Rust monomorphizes trait calls at compile time -- each `sort::<i32>()` becomes a specialized function with no dispatch overhead. TRAITOR v2 cannot monomorphize (TypeScript is not compiled that way), but Tier 2 and Tier 3 achieve zero-dispatch-overhead through explicit passing and static lookup tables respectively, which is the closest TypeScript can get.

Rust's coherence rules (one impl per type per trait) are enforced by the compiler. TRAITOR v2's Tier 1 gets coherence-like behavior from interface merging (properties must not conflict), but Tiers 2 and 3 allow multiple instances for the same type (e.g., ascending vs. descending `Ord<number>`). This is a feature, not a bug -- newtypes are expensive in Rust, while having two `Ord` instances for the same type is natural in kitz.

**vs. Scala Implicits / Given Instances:**

Scala's given instances are resolved at compile time through lexical scope search. This is the most flexible approach -- you can shadow instances locally. TRAITOR v2 cannot do scope-based resolution (TypeScript has no mechanism for it), but Tier 2's explicit passing achieves the same effect: you choose which instance to use at each call site.

**vs. fp-ts / Effect Typeclass Modules:**

fp-ts and Effect use Tier 2 exclusively -- explicit instance passing everywhere. TRAITOR v2 extends this with Tier 1 (compile-time-only dispatch for type-level operations) and Tier 3 (codegen-assisted dispatch for value-level operations). This means kitz can offer the same guarantees as fp-ts/Effect (perfect tree-shaking, no magic) while also offering a more ergonomic API when the user wants it.

### 3.5 Declaration Merging as the Dispatch Mechanism

The deepest technical insight of TRAITOR v2 is that TypeScript's declaration merging IS the typeclass dispatch mechanism. This deserves unpacking.

In Haskell, the compiler maintains an instance database. When you write `show x`, the compiler looks up `Show` in the database, finds the instance matching `x`'s type, and resolves the call. The instance database is populated by `instance` declarations scattered across modules.

In TypeScript, the type checker maintains a merged view of all interfaces with the same name. When you write `KITZ.Traits.Display.Handlers<MyType>`, the type checker looks up `Handlers`, finds the merged interface including all declaration-merged properties, and evaluates each one against `MyType`. Properties that return `never` (because their conditional type doesn't match) are filtered out. Properties that return a value are the "matching instances."

The structural parallel is exact:

| Haskell                                  | TypeScript (TRAITOR v2 Tier 1)                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `class Show a where show :: a -> String` | `namespace Display { interface Handlers<$Type> {} }`                           |
| `instance Show Int where show = ...`     | `interface Handlers<$Type> { Int: $Type extends number ? ... : never }`        |
| `instance Show [a] where show xs = ...`  | `interface Handlers<$Type> { Array: $Type extends (infer E)[] ? ... : never }` |
| Compiler searches instance database      | Type checker evaluates merged interface                                        |
| Instance found at compile time           | Conditional type resolves at check time                                        |
| Coherence: one instance per type         | Additive merging: properties can't conflict                                    |

The key property that makes this work is that TypeScript's interface merging is **open** and **additive**. Any module can add a property to `Handlers`. No module can remove or override a property. This gives us the "open world" property of typeclasses (extensibility) with a form of coherence (no silent overwriting).

The limitation is that this only works at the type level. Declaration merging doesn't produce runtime code. For runtime behavior, you need Tier 2 or Tier 3.

### 3.6 Tree-Shaking Across All Tiers

Tree-shaking is the non-negotiable constraint. Let's verify each tier:

**Tier 1 (type-level only):**
Zero runtime code generated. Nothing to shake. The declaration merging exists only in `.d.ts` files and type-checking. Bundle size impact: exactly zero.

**Tier 2 (explicit instances):**
Each instance is a module-level `const` export. Unused instances are eliminated by the bundler. Example:

```typescript
// If the user imports only stringEq and numberOrd:
import { numberOrd } from '@kitz/core/typeclass/number'
import { stringEq } from '@kitz/core/typeclass/string'

// Then stringOrd, stringHash, stringShow, numberEq, numberHash, etc.
// are all eliminated. Each file exports independent constants.
```

The key is that instances are not registered in a shared data structure. They're independent exports from independent modules. Bundlers can analyze the import graph and eliminate everything not transitively imported.

**Tier 3 (codegen-assisted):**
The generated dispatch function uses `switch` statements and direct imports. Bundlers can analyze switch cases and eliminate unreachable branches when the input is known. However, the generated `eqFor` function itself imports all Eq instances (string, number, boolean, array). If you import `eqFor`, all Eq instances come with it.

To preserve fine-grained tree-shaking in Tier 3, the codegen should produce per-type modules:

```typescript
// Generated: __generated__/eq/string.ts
import { stringEq } from '../../instances/string.js'
export const eq = stringEq

// Generated: __generated__/eq/array.ts
import { arrayEq } from '../../instances/array.js'
export const eq = <A>(elemEq: Eq<A>) => arrayEq(elemEq)

// User imports only what they need
import { eq as arrayEq_ } from './__generated__/eq/array.js'
import { eq as stringEq_ } from './__generated__/eq/string.js'
```

This is more granular than a single `eqFor` function, but it's still less verbose than Tier 2 because the codegen handles the boilerplate of connecting type witnesses to instances. The trade-off between granularity and convenience can be tuned per project.

### 3.7 The Role of Branded Types and Variance Annotations

Branded types and variance annotations serve specific roles in TRAITOR v2:

**Branded types as instance witnesses:**

A branded type can serve as compile-time proof that a type has a particular typeclass instance:

```typescript
// A brand proving that a type A has an Eq instance
type HasEq<A> = A & { readonly [EqBrand]: Eq<A> }
declare const EqBrand: unique symbol

// Once branded, the Eq instance is statically known
function processEqValues<A>(values: HasEq<A>[]): boolean {
  const eq = values[0]![EqBrand] // Type-safe access to the instance
  return values.every((v, i) => i === 0 || eq.equals(values[i - 1]!, v))
}
```

This pattern is possible but introduces complexity that may not be worth the ergonomic benefit. TRAITOR v2 recommends brands primarily for Domain types (via Effect Schema's `TaggedClass`) rather than for typeclass instances.

**Variance annotations for typeclass interfaces:**

Typeclass interfaces should use variance annotations to communicate their type parameter usage:

```typescript
// Eq consumes A values (contravariant)
interface Eq<in A> {
  readonly equals: (self: A, that: A) => boolean
}

// Functor produces B values (covariant in the output)
interface Functor<F extends Kind> {
  readonly map: <A, B>(self: Apply<F, [A]>, f: (a: A) => B) => Apply<F, [B]>
}
```

The `in` annotation on `Eq<in A>` tells TypeScript that `Eq<Animal>` is assignable to `Eq<Dog>` (contravariant: a function that compares any animal can compare dogs). This enables correct subtype relationships between instances and helps the type checker optimize.

### 3.8 The TRAITOR v2 Namespace Convention

All TRAITOR v2 traits use a global namespace convention with two tiers:

```typescript
// Tier 1 (type-level) traits live in the global namespace
declare global {
  namespace KITZ.Traits {
    namespace Display {
      interface Handlers<$Type> {}
    }
    namespace Eq {
      interface Handlers<$A, $B> {}
    }
    namespace TypeName {
      interface Handlers<$Type> {}
    }
    namespace Serializable {
      interface Handlers<$Type> {}
    }
  }
}

// Tier 2 (value-level) traits live in normal module exports
// No global namespace needed -- instances are just objects
export interface Eq<in A> { ... }
export interface Ord<in A> extends Eq<A> { ... }
export interface Hash<in A> extends Eq<A> { ... }
export interface Show<in A> { ... }
export interface Functor<F extends Kind> { ... }
```

The naming is intentional: `KITZ.Traits` (uppercase) for the global namespace, `Eq` / `Ord` / etc. (PascalCase) for the trait interfaces. This avoids collisions with user types and makes the trait system instantly recognizable in code.

### 3.9 Concrete Design: A Complete Typeclass From Trait to Usage

Let's trace a complete example -- the `Monoid` typeclass -- through all three tiers:

```typescript
// ═══════════════════════════════════════════════════════════════
// Monoid Typeclass: A Complete Example
// ═══════════════════════════════════════════════════════════════

// ── Tier 1: Type-Level ──────────────────────────────────────

/**
 * Type-level check: does type $A have a Monoid structure?
 *
 * Returns the identity element's type, or `never` if $A is not a monoid.
 */
declare global {
  namespace KITZ.Traits.Monoid {
    interface Handlers<$Type> {
      // Built-in registrations
      string: $Type extends string ? '' : never
      number: $Type extends number ? 0 : never
      Array: $Type extends readonly (infer E)[] ? readonly [] : never
    }
  }
}

type IsMonoid<$A> = [
  KITZ.Traits.Monoid.Handlers<$A>[keyof KITZ.Traits.Monoid.Handlers<$A>],
] extends [never]
  ? false
  : true

// ── Tier 2: Runtime Instances ───────────────────────────────

/**
 * Monoid<A>: A type A with an associative binary operation and an identity element.
 *
 * @typeclass
 * @law leftIdentity: (a: A) => Monoid.combine(Monoid.empty, a) equals a
 * @law rightIdentity: (a: A) => Monoid.combine(a, Monoid.empty) equals a
 * @law associativity: (a: A, b: A, c: A) =>
 *   Monoid.combine(Monoid.combine(a, b), c) equals
 *   Monoid.combine(a, Monoid.combine(b, c))
 */
interface Monoid<A> {
  readonly empty: A
  readonly combine: (self: A, that: A) => A
}

// String monoid (concatenation)
const stringMonoid: Monoid<string> = {
  empty: '',
  combine: (self, that) => self + that,
}

// Number monoid (addition)
const numberAddMonoid: Monoid<number> = {
  empty: 0,
  combine: (self, that) => self + that,
}

// Number monoid (multiplication) -- same type, different instance!
const numberMulMonoid: Monoid<number> = {
  empty: 1,
  combine: (self, that) => self * that,
}

// Array monoid (concatenation)
const arrayMonoid = <A>(): Monoid<ReadonlyArray<A>> => ({
  empty: [],
  combine: (self, that) => [...self, ...that],
})

// Polymorphic function using Monoid
const fold =
  <A>(monoid: Monoid<A>) =>
  (values: ReadonlyArray<A>): A =>
    values.reduce(monoid.combine, monoid.empty)

// ── Tier 3: Codegen Dispatch ────────────────────────────────

// Generated: __generated__/monoid-dispatch.ts
import { arrayMonoid } from '../instances/array.js'
import { numberAddMonoid } from '../instances/number.js'
import { stringMonoid } from '../instances/string.js'

function monoidFor<A>(witness: TypeWitness<A>): Monoid<A> {
  switch (witness.tag) {
    case 'string':
      return stringMonoid as Monoid<A>
    case 'number':
      return numberAddMonoid as Monoid<A>
    case 'Array':
      return arrayMonoid() as Monoid<A>
    default:
      throw new Error(`No Monoid instance for ${witness.tag}`)
  }
}

// ── Usage Across All Tiers ──────────────────────────────────

// Tier 1: Type-level check
type _test1 = IsMonoid<string> // true
type _test2 = IsMonoid<number> // true
type _test3 = IsMonoid<Date> // false
type _test4 = IsMonoid<string[]> // true

// Tier 2: Explicit instance passing
const result1 = fold(stringMonoid)(['hello', ' ', 'world'])
// result1: 'hello world'

const result2 = fold(numberMulMonoid)([2, 3, 4])
// result2: 24

const result3 = fold(arrayMonoid<number>())([[1, 2], [3], [4, 5]])
// result3: [1, 2, 3, 4, 5]

// Tier 3: Witness-based dispatch
const result4 = fold(monoidFor(string_))(['a', 'b', 'c'])
// result4: 'abc'

const result5 = fold(monoidFor(number_))([1, 2, 3])
// result5: 6 (addition, the default Monoid for number)
```

Note that Tier 2 allows `numberMulMonoid` as an alternative to `numberAddMonoid`, while Tier 3's `monoidFor(number_)` always resolves to the default (addition). This is the fundamental trade-off: Tier 3 is more convenient but less flexible. When you need a non-default instance, drop to Tier 2.

### 3.10 Summary: Why TRAITOR v2 Succeeds Where v1 Failed

| Failure mode of v1                         | How v2 addresses it                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Runtime dispatch overhead                  | Tier 1: zero runtime. Tier 2: direct call. Tier 3: static switch.      |
| Tree-shaking broken                        | All three tiers preserve tree-shaking. No global registry.             |
| 3,200 lines of infrastructure for 3 traits | Tier 1 is ~50 lines per trait. Tier 2 is ~10 lines per instance.       |
| Global mutable state                       | Tier 1: immutable interface merging. Tier 2/3: module-level constants. |
| Three-month stagnation (not used)          | Tiers are independent. Ship Tier 1 first (Display already works).      |
| No coherence guarantees                    | Tier 1: interface merging prevents overwriting. Tier 2: explicit.      |
| Complexity for contributors                | Each tier is simple independently. No need to understand all three.    |

---

## 4. The Tooling Constellation

### 4.1 Architecture: The Tailwind Model

Kitz's tooling follows the Tailwind CSS architecture: a **core intelligence engine** that understands kitz's type system, module conventions, and patterns, wrapped by **thin adapters** for different environments:

```
              ┌─────────────────────────────┐
              │     kitz Intelligence Core    │
              │                               │
              │  - Type analysis              │
              │  - Pattern detection           │
              │  - Code generation templates   │
              │  - Convention knowledge         │
              │  - JSDoc metadata parsing      │
              └───────┬───────────────────────┘
                      │
        ┌─────────────┼─────────────────┐
        │             │                 │
┌───────┴───────┐ ┌──┴──────────┐ ┌───┴────────────┐
│  MCP Server   │ │ LSP Server  │ │  OxLint Plugin  │
│               │ │             │ │                  │
│ AI agents     │ │ Editors     │ │  Build/CI        │
│ Claude Code   │ │ VSCode      │ │  Static analysis │
│ Cursor         │ │ Zed        │ │                  │
│ Windsurf       │ │ Neovim     │ │                  │
└───────────────┘ └─────────────┘ └──────────────────┘
        │             │                 │
        │        ┌────┴────┐            │
        │        │ Editor  │            │
        │        │Wrappers │            │
        │        │         │            │
        │        │ VSCode  │            │
        │        │ Zed     │            │
        │        │         │            │
        │        └─────────┘            │
        │                               │
  ┌─────┴───────────────────────────────┴─────┐
  │           Rolldown/Vite Plugin             │
  │                                             │
  │  Build-time optimization                    │
  │  Pure annotations, import rewriting         │
  └─────────────────────────────────────────────┘
```

The intelligence core is a TypeScript library (likely an Effect-based service) that:

- Parses and understands kitz module conventions (`_.ts`, `__.ts`, barrel files)
- Reads JSDoc metadata (custom tags like `@typeclass`, `@pure`, `@law`, `@complexity`)
- Analyzes type-level patterns (HKTs, branded types, typeclass instances)
- Knows kitz's convention vocabulary (curried variants, data-first/data-last, namespace re-exports)
- Provides code generation templates for common scaffolding tasks

Each adapter exposes the intelligence through a protocol appropriate to its environment:

- **MCP Server**: Exposes tools, resources, and prompts via the Model Context Protocol
- **LSP Server**: Exposes completions, diagnostics, hover info, and refactorings via LSP
- **OxLint Plugin**: Exposes lint rules via the ESLint-compatible API
- **Rolldown Plugin**: Exposes build-time transforms via the Rollup-compatible API
- **Editor Extensions**: Thin wrappers adding editor-specific UI (VSCode decorations, Zed slash commands)

### 4.2 MCP Server: The AI Multiplier

The MCP server is the highest-ROI investment in the tooling constellation because it directly multiplies the effectiveness of AI-assisted development -- which is kitz's primary audience.

**Resources (read-only data for agent context):**

```
kitz://packages                    - List all packages in the workspace
kitz://packages/{name}             - Package metadata, exports, dependencies
kitz://packages/{name}/modules     - All modules in a package with public API
kitz://packages/{name}/modules/{m} - Detailed API of a specific module
kitz://packages/{name}/services    - Effect services defined in a package
kitz://packages/{name}/errors      - Error types with their schemas
kitz://packages/{name}/typeclasses - Typeclass instances provided by a package
kitz://conventions                 - All kitz conventions (from .claude/ rules)
```

These resources are the equivalent of giving an AI agent a map of the codebase. Instead of the agent grepping through files to understand the structure, it queries the MCP server and gets structured, up-to-date metadata. This is especially valuable for large monorepos where the agent would otherwise waste context window on exploration.

**Tools (actions the agent can invoke):**

```
kitz:scaffold-module    - Generate a new module with correct conventions
kitz:scaffold-service   - Generate an Effect service with layers and tests
kitz:scaffold-typeclass - Generate a new typeclass with all three tiers
kitz:check-conventions  - Verify a file follows kitz conventions
kitz:explain-error      - Parse a TypeScript error and explain in kitz terms
kitz:type-at-position   - Get the resolved type at a cursor position
kitz:lint-file          - Run kitz-specific lint rules on a file
```

**Prompts (reusable templates for consistent agent behavior):**

```
kitz:new-feature       - Guide for implementing a new feature end-to-end
kitz:debug-effect      - Structured debugging template for Effect errors
kitz:review-module     - Checklist for reviewing a kitz module
kitz:migrate-pattern   - Guide for migrating from one pattern to another
```

**Detailed resource examples:**

```typescript
// ═══════════════════════════════════════════════════════════════
// MCP Resource: kitz://packages/core/modules/arr
// ═══════════════════════════════════════════════════════════════

// When an agent queries this resource, it receives:
{
  "name": "Arr",
  "package": "@kitz/core",
  "path": "packages/core/src/arr/",
  "publicBarrel": "packages/core/src/arr/__.ts",
  "internalBarrel": "packages/core/src/arr/_.ts",
  "description": "Array utilities with immutable-first design",
  "exports": {
    "types": [
      {
        "name": "Unknown",
        "kind": "type-alias",
        "definition": "readonly unknown[]",
        "jsdoc": "Unknown readonly array type. Use as a constraint for immutable arrays."
      },
      {
        "name": "Any",
        "kind": "type-alias",
        "definition": "readonly any[]",
        "jsdoc": "Any readonly array type. Use as a constraint for immutable arrays."
      },
      {
        "name": "NonEmpty",
        "kind": "type-alias",
        "typeParams": ["$Type"],
        "definition": "readonly [$Type, ...readonly $Type[]]",
        "jsdoc": "Non-empty readonly array with at least one element."
      }
    ],
    "functions": [
      {
        "name": "is",
        "signature": "(value: unknown) => value is readonly any[]",
        "jsdoc": "Type guard for arrays.",
        "tags": { "pure": true, "complexity": "O(1)", "since": "0.1.0" }
      }
    ]
  },
  "displayHandler": {
    "registered": true,
    "handles": "readonly (infer E)[] -> `${Display<E>}[]`"
  }
}
```

```typescript
// ═══════════════════════════════════════════════════════════════
// MCP Resource: kitz://conventions
// ═══════════════════════════════════════════════════════════════

// When an agent queries this resource, it receives a structured
// representation of all kitz conventions:
{
  "moduleStructure": {
    "internalBarrel": {
      "filename": "_.ts",
      "purpose": "Internal barrel for package-scoped imports via #module",
      "pattern": "export * from './implementation.js'"
    },
    "publicBarrel": {
      "filename": "__.ts",
      "purpose": "Public barrel for external consumers",
      "pattern": "export * as ModuleName from './_.js'"
    },
    "implementation": {
      "location": "Same directory as barrels",
      "naming": "lowercase-with-hyphens.ts",
      "exports": "Named exports only, no default exports"
    },
    "tests": {
      "unit": "*.test.ts alongside implementation",
      "typeLevel": "*.test-d.ts for expectTypeOf assertions"
    }
  },
  "naming": {
    "types": "PascalCase",
    "values": "camelCase",
    "namespaces": "PascalCase (matching the module name)",
    "files": "lowercase, hyphens for multi-word",
    "packages": "@kitz/lowercase"
  },
  "patterns": {
    "currying": {
      "dataFirst": "fn(data, ...args) -- primary form",
      "dataLast": "fnWith(...args)(data) -- for pipe composition",
      "convention": "On suffix = curry first arg, With suffix = curry second arg"
    },
    "errors": {
      "base": "Err.TaggedContextualError from @kitz/core",
      "export": "export * as Errors from './errors.js'",
      "union": "export type All = Error1 | Error2 | ..."
    },
    "jsdoc": {
      "required": ["@param", "@returns", "@example", "@since", "@category"],
      "optional": ["@pure", "@complexity", "@law", "@see", "@typeclass", "@instance"]
    }
  }
}
```

```typescript
// ═══════════════════════════════════════════════════════════════
// MCP Tool: kitz:scaffold-module
// ═══════════════════════════════════════════════════════════════

// Input schema:
interface ScaffoldModuleInput {
  package: string // e.g., "core"
  name: string // e.g., "set"
  description: string // e.g., "Set operations for arrays"
  functions?: Array<{
    name: string
    description: string
    params: Array<{ name: string; type: string; description: string }>
    returnType: string
    pure?: boolean
    complexity?: string
  }>
}

// The tool generates:
// 1. packages/{package}/src/{name}/{name}.ts    -- implementation stubs
// 2. packages/{package}/src/{name}/_.ts          -- internal barrel
// 3. packages/{package}/src/{name}/__.ts         -- public barrel
// 4. packages/{package}/src/{name}/{name}.test.ts -- test file
// 5. Instructions for updating package.json imports/exports

// Example output for kitz:scaffold-module({ package: "core", name: "set" }):
//
// Created files:
//   packages/core/src/set/set.ts
//   packages/core/src/set/_.ts
//   packages/core/src/set/__.ts
//   packages/core/src/set/set.test.ts
//
// TODO: Add to packages/core/package.json:
//   imports: { "#set": "./build/set/_.js", "#set/*": "./build/set/*.js" }
//   exports: { "./set": "./build/set/__.js" }
```

```typescript
// ═══════════════════════════════════════════════════════════════
// MCP Tool: kitz:explain-error
// ═══════════════════════════════════════════════════════════════

// Input:
{
  "error": "Type 'Effect<string, never, never>' is not assignable to type 'Effect<string, HttpError, ConfigService>'. Type 'never' is not assignable to type 'HttpError'."
}

// Output:
{
  "summary": "Your Effect has unhandled error and service requirements.",
  "explanation": "The type checker expects an Effect that can fail with HttpError and requires ConfigService, but you're providing an Effect that has no errors (never) and no requirements (never). This usually means you're returning a pure Effect where a service-dependent one is expected.",
  "suggestion": "Check that your function:\n1. Uses Effect.gen with yield* to access ConfigService\n2. Maps or catches HttpError appropriately\n3. Returns the expected Effect type from the generator",
  "relatedDocs": [
    "https://effect.website/docs/getting-started/using-services/",
    "https://effect.website/docs/getting-started/error-management/"
  ],
  "codeExample": "const myEffect = Effect.gen(function*() {\n  const config = yield* ConfigService\n  const result = yield* httpCall(config.url)\n  return result\n}).pipe(Effect.catchTag('HttpError', handleError))"
}
```

**Implementation strategy:**

The MCP server should be implemented as an Effect-based service using the `@modelcontextprotocol/sdk` TypeScript SDK. It should:

1. Use kitz's own libraries for file system operations (`@kitz/fs`), data modeling (`@kitz/core`), and structured output (`@kitz/log`). This dogfoods the library and demonstrates its value.

2. Parse TypeScript files for structural information using tsgo's IPC API when available, falling back to regex-based heuristics for structural elements (exports, class definitions, JSDoc) when the API is not available. The regex fallback is acceptable because module conventions are predictable.

3. Cache parsed metadata aggressively. The workspace structure changes infrequently during a development session, so cache invalidation can be triggered by file system events.

4. Support both `stdio` transport (for local CLI use) and Streamable HTTP transport (for remote use, e.g., running the MCP server in a container).

**Feasibility assessment:**

The MCP server is immediately feasible because:

- The TypeScript SDK is stable and well-documented
- Kitz's conventions are predictable enough for regex-based parsing
- No dependency on the tsgo API for the initial version
- The hardest part (type introspection) can be deferred to a later version
- Resources and prompts add value even without tools

**Expected impact:**

An AI agent with the kitz MCP server can scaffold a correct module in one shot instead of three iterations. It can explain a type error in terms the developer understands instead of raw TypeScript diagnostics. It can verify conventions automatically instead of requiring manual review. Each of these saves minutes per interaction, compounding across hundreds of interactions per day.

### 4.3 OxLint Plugin: Static Analysis for Kitz Patterns

The OxLint plugin provides automated enforcement of kitz conventions and detection of kitz-specific anti-patterns. It uses the ESLint v9-compatible JS plugin API (stable since October 2025) with OxLint's `createOnce` optimization for performance.

**Pattern rules (no type information needed):**

```typescript
// @kitz/no-floating-effect
// Detect Effect.runPromise/runSync results that aren't awaited or assigned
{
  CallExpression(node) {
    if (isEffectRunCall(node) && !isConsumed(node)) {
      context.report({
        node,
        messageId: 'floatingEffect',
        data: { method: getMethodName(node) },
      })
    }
  }
}

// @kitz/require-error-tag
// Ensure custom errors extend TaggedContextualError or have _tag
{
  ClassDeclaration(node) {
    if (isErrorClass(node) && !hasTagField(node) && !extendsTaggedError(node)) {
      context.report({
        node,
        messageId: 'missingTag',
        data: { className: node.id?.name },
      })
    }
  }
}

// @kitz/barrel-convention
// Enforce _.ts (internal) and __.ts (public) barrel file conventions
{
  ExportAllDeclaration(node) {
    if (isBarrelFile(context.filename) && !followsBarrelConvention(node)) {
      context.report({
        node,
        messageId: 'barrelConvention',
      })
    }
  }
}

// @kitz/jsdoc-quality
// Enforce JSDoc standards: @example with runnable code, @since, @category
{
  'FunctionDeclaration, VariableDeclaration[parent.type="ExportNamedDeclaration"]'(node) {
    const jsdoc = getJSDoc(node)
    if (!jsdoc) {
      context.report({ node, messageId: 'missingJSDoc' })
      return
    }
    if (!hasTag(jsdoc, 'example')) {
      context.report({ node, messageId: 'missingExample' })
    }
    if (!hasTag(jsdoc, 'since')) {
      context.report({ node, messageId: 'missingSince' })
    }
  }
}

// @kitz/no-bare-throw
// Enforce using Effect error channels instead of throw statements
{
  ThrowStatement(node) {
    if (!isInCatchBlock(node)) {
      context.report({
        node,
        messageId: 'noThrow',
        suggest: [{
          messageId: 'useEffectFail',
          fix: (fixer) => generateEffectFailFix(fixer, node),
        }],
      })
    }
  }
}

// @kitz/service-naming
// Enforce service naming conventions (PascalCase, "Service" suffix optional)
{
  CallExpression(node) {
    if (isServiceDeclaration(node)) {
      const name = getServiceName(node)
      if (!isPascalCase(name)) {
        context.report({ node, messageId: 'serviceNaming', data: { name } })
      }
    }
  }
}
```

**Full rule implementation examples:**

```typescript
// ═══════════════════════════════════════════════════════════════
// Rule: @kitz/no-floating-effect (Complete Implementation)
// ═══════════════════════════════════════════════════════════════
//
// Detects Effect.runPromise, Effect.runSync, Effect.runFork, and
// similar run* calls whose return values are not consumed.
//
// BAD:
//   Effect.runPromise(myEffect)  // Promise returned but not awaited/assigned
//
// GOOD:
//   await Effect.runPromise(myEffect)
//   const result = Effect.runPromise(myEffect)
//   return Effect.runPromise(myEffect)

const noFloatingEffectRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unhandled Effect.run* results',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      floatingEffect:
        'Effect.{{ method }}() result is not consumed. ' +
        'Await, assign, or return the result to ensure the Effect runs.',
      floatingEffectSuggestion: 'Add await before Effect.{{ method }}()',
    },
    hasSuggestions: true,
    schema: [],
  },
  create(context) {
    const RUN_METHODS = new Set([
      'runPromise',
      'runPromiseExit',
      'runSync',
      'runSyncExit',
      'runFork',
    ])

    return {
      ExpressionStatement(node) {
        const expr = node.expression
        // Direct call: Effect.runPromise(...)
        if (
          expr.type === 'CallExpression' &&
          expr.callee.type === 'MemberExpression' &&
          expr.callee.object.type === 'Identifier' &&
          expr.callee.object.name === 'Effect' &&
          expr.callee.property.type === 'Identifier' &&
          RUN_METHODS.has(expr.callee.property.name)
        ) {
          context.report({
            node: expr,
            messageId: 'floatingEffect',
            data: { method: expr.callee.property.name },
            suggest: [
              {
                messageId: 'floatingEffectSuggestion',
                data: { method: expr.callee.property.name },
                fix(fixer) {
                  return fixer.insertTextBefore(expr, 'await ')
                },
              },
            ],
          })
        }
      },
    }
  },
}
```

```typescript
// ═══════════════════════════════════════════════════════════════
// Rule: @kitz/require-error-tag (Complete Implementation)
// ═══════════════════════════════════════════════════════════════
//
// Ensures all custom error classes have a `_tag` discriminant field.
// This is required for Effect's error matching (Effect.catchTag).
//
// BAD:
//   class MyError extends Error {
//     constructor(message: string) { super(message) }
//   }
//
// GOOD:
//   class MyError extends Data.TaggedError('MyError')<{}> {}
//   const MyError = Err.TaggedContextualError('MyError', ['kit'], { ... })

const requireErrorTagRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require _tag field on custom error classes',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingTag:
        'Error class "{{ className }}" is missing a _tag discriminant. ' +
        'Use Err.TaggedContextualError or Data.TaggedError to ensure ' +
        'the error can be matched with Effect.catchTag.',
    },
    schema: [],
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!node.superClass) return
        if (!isErrorSuperClass(node.superClass)) return

        const hasTag = node.body.body.some(
          (member) =>
            member.type === 'PropertyDefinition' &&
            member.key.type === 'Identifier' &&
            member.key.name === '_tag',
        )

        const superProvidesTag = isTaggedSuperClass(node.superClass)

        if (!hasTag && !superProvidesTag) {
          context.report({
            node: node.id || node,
            messageId: 'missingTag',
            data: { className: node.id?.name || 'anonymous' },
          })
        }
      },
    }
  },
}

function isErrorSuperClass(node) {
  if (node.type === 'Identifier') return /Error$/.test(node.name)
  if (node.type === 'MemberExpression') {
    return node.property.type === 'Identifier' && /Error$/.test(node.property.name)
  }
  if (node.type === 'CallExpression') return isErrorSuperClass(node.callee)
  return false
}

function isTaggedSuperClass(node) {
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    ['Data', 'Err'].includes(node.callee.object.name) &&
    node.callee.property.type === 'Identifier' &&
    ['TaggedError', 'TaggedContextualError', 'TaggedClass'].includes(node.callee.property.name)
  ) {
    return true
  }
  return false
}
```

```typescript
// ═══════════════════════════════════════════════════════════════
// Rule: @kitz/barrel-convention (Complete Implementation)
// ═══════════════════════════════════════════════════════════════
//
// Enforces kitz's two-tier barrel file convention:
//   _.ts  = internal barrel (re-exports everything)
//   __.ts = public barrel (re-exports as namespace)
//
// In _.ts:
//   GOOD: export * from './implementation.js'
//   BAD:  export { specific } from './implementation.js'
//
// In __.ts:
//   GOOD: export * as ModuleName from './_.js'
//   BAD:  export * from './_.js'

const barrelConventionRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce kitz barrel file conventions',
      category: 'Conventions',
      recommended: true,
    },
    messages: {
      publicBarrelMustNamespace:
        'Public barrel (__.ts) must use namespace re-exports: ' +
        "export * as ModuleName from './_.js'",
      internalBarrelPreferWildcard:
        'Internal barrel (_.ts) should use wildcard re-exports: ' +
        "export * from './implementation.js'",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename
    const isPublicBarrel = filename.endsWith('/__.ts')
    const isInternalBarrel = filename.endsWith('/_.ts') && !isPublicBarrel

    return {
      ExportAllDeclaration(node) {
        if (isPublicBarrel && !node.exported) {
          context.report({ node, messageId: 'publicBarrelMustNamespace' })
        }
      },
      ExportNamedDeclaration(node) {
        if (isInternalBarrel && node.source && node.specifiers?.length > 0) {
          context.report({ node, messageId: 'internalBarrelPreferWildcard' })
        }
      },
    }
  },
}
```

```typescript
// ═══════════════════════════════════════════════════════════════
// Rule: @kitz/jsdoc-quality (Complete Implementation)
// ═══════════════════════════════════════════════════════════════
//
// This is the lint rule that powers the "JSDoc as Infrastructure"
// vision. It ensures every exported symbol has machine-readable
// metadata.
//
// Required for all public exports:
//   - First-line summary (non-empty)
//   - @param for each parameter
//   - @returns
//   - @example with at least one code block
//   - @since version tag
//   - @category for TypeDoc grouping
//
// Recommended (warn, not error):
//   - @pure for side-effect-free functions
//   - @complexity for non-trivial algorithms
//   - @see for related functions

const jsdocQualityRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce kitz JSDoc quality standards',
      category: 'Documentation',
      recommended: true,
    },
    messages: {
      missingJSDoc: 'Exported symbol "{{ name }}" is missing JSDoc.',
      missingSummary: 'JSDoc for "{{ name }}" is missing a summary line.',
      missingExample: 'JSDoc for "{{ name }}" is missing @example.',
      missingSince: 'JSDoc for "{{ name }}" is missing @since.',
      missingCategory: 'JSDoc for "{{ name }}" is missing @category.',
    },
    schema: [],
  },
  create(context) {
    function checkExportedNode(node, name) {
      const jsdoc = context.sourceCode.getJSDocComment?.(node)
      if (!jsdoc) {
        context.report({ node, messageId: 'missingJSDoc', data: { name } })
        return
      }
      const text = jsdoc.value
      if (!hasSummaryLine(text)) {
        context.report({ node, messageId: 'missingSummary', data: { name } })
      }
      if (!text.includes('@example')) {
        context.report({ node, messageId: 'missingExample', data: { name } })
      }
      if (!text.includes('@since')) {
        context.report({ node, messageId: 'missingSince', data: { name } })
      }
      if (!text.includes('@category')) {
        context.report({ node, messageId: 'missingCategory', data: { name } })
      }
    }
    return {
      'ExportNamedDeclaration > FunctionDeclaration'(node) {
        checkExportedNode(node, node.id?.name || 'anonymous')
      },
      'ExportNamedDeclaration > VariableDeclaration'(node) {
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier') {
            checkExportedNode(node, decl.id.name)
          }
        }
      },
    }
  },
}

function hasSummaryLine(text) {
  const lines = text.split('\n').map((l) => l.replace(/^\s*\*?\s?/, '').trim())
  return lines.some((l) => l.length > 0 && !l.startsWith('@'))
}
```

**Dual compatibility with ESLint:**

OxLint's `createOnce` API is performance-optimized but not ESLint-compatible out of the box. The `eslintCompatPlugin` wrapper makes kitz's rules work in both:

```typescript
import { eslintCompatPlugin } from '@oxlint/plugins'

// The plugin works in OxLint natively and in ESLint via the compat wrapper
export default eslintCompatPlugin({
  rules: {
    'no-floating-effect': noFloatingEffectRule,
    'require-error-tag': requireErrorTagRule,
    'barrel-convention': barrelConventionRule,
    'jsdoc-quality': jsdocQualityRule,
    'no-bare-throw': noBareThrowRule,
    'service-naming': serviceNamingRule,
  },
})
```

**IDE integration:**

As of early 2026, OxLint JS plugin diagnostics do not yet appear in editors (the OxLint VSCode extension only shows built-in Rust rule diagnostics). This is planned functionality. In the meantime, the rules provide value in CI and local `oxlint` runs.

**Future: type-aware rules:**

OxLint's type-aware linting (via `tsgolint`) is in alpha. When the JS plugin API gains type access, kitz can add:

- `@kitz/exhaustive-error-handling` -- Verify all error types in an Effect are handled
- `@kitz/layer-completeness` -- Check that all required services are provided
- `@kitz/service-dependency-cycle` -- Detect circular service dependencies

These require type information to work and are the most valuable rules long-term. Building the pattern-based rules now establishes the plugin infrastructure so type-aware rules can be added incrementally.

### 4.4 TS Language Service Plugin / Standalone LSP

The LSP provides editor intelligence: completions, diagnostics, hover information, code actions, and refactorings. The implementation strategy accounts for the tsgo transition:

**Phase 1: TS Language Service Plugin (works with TS <= 6.0)**

Follow Effect's approach: wrap `getSemanticDiagnostics`, `getCompletionsAtPosition`, and `getQuickInfoAtPosition`. This provides immediate value but only works with the Strada API.

Features:

- **Completions**: When typing `Effect.`, show kitz-specific completions with JSDoc snippets
- **Diagnostics**: Warn about floating effects, missing error tags, convention violations
- **Hover enrichment**: Show simplified type signatures for complex Effect types, include JSDoc from kitz modules
- **Refactorings**: pipe-to-gen conversion, data-first to data-last, extract service

The intelligence layer (what to complete, what to diagnose, what to show on hover) is implemented as a pure module with no dependency on the TS language service API. This separation is critical for Phase 2.

**Phase 2: Standalone LSP Server (works with tsgo / TS 7+)**

When tsgo arrives, migrate the integration layer from the Strada API to a standalone LSP server. The intelligence layer ports directly because it was designed without coupling to the Strada API.

The standalone LSP:

- Communicates with tsgo via standard LSP (tsgo speaks LSP natively)
- Adds kitz-specific intelligence on top of tsgo's responses
- Works with every editor that supports LSP (VSCode, Zed, Neovim, Helix, etc.)
- Is the long-term architecture for kitz editor intelligence

**Concrete LSP feature examples:**

```typescript
// ═══════════════════════════════════════════════════════════════
// LSP Feature: Hover Enrichment for Effect Types
// ═══════════════════════════════════════════════════════════════

// When hovering over a complex Effect type like:
//   Effect.Effect<UserProfile, HttpError | ParseError, ConfigService | DatabaseService>
//
// Standard TS shows the raw type. Kitz's LSP enriches it to:
//
// ┌──────────────────────────────────────────────────────┐
// │ Effect<UserProfile, HttpError | ParseError,          │
// │        ConfigService | DatabaseService>               │
// │                                                       │
// │ Success: UserProfile                                  │
// │ Errors:  HttpError, ParseError                        │
// │ Requires: ConfigService, DatabaseService              │
// │                                                       │
// │ This effect needs 2 services to be provided:          │
// │   - ConfigService (from @myapp/config)                │
// │   - DatabaseService (from @myapp/database)            │
// │                                                       │
// │ It may fail with 2 error types:                       │
// │   - HttpError: Network request failure                │
// │   - ParseError: JSON parsing failure                  │
// └──────────────────────────────────────────────────────┘
```

```typescript
// ═══════════════════════════════════════════════════════════════
// LSP Feature: Completions for Kitz Patterns
// ═══════════════════════════════════════════════════════════════

// When typing inside an Effect.gen generator:
//
//   const program = Effect.gen(function*() {
//     const config = yield* |  <-- cursor here
//   })
//
// Kitz LSP offers completions for all available services in scope:
//   ConfigService      (from @myapp/config)
//   DatabaseService    (from @myapp/database)
//   LoggerService      (from @myapp/logger)
//
// Each completion includes the service's type signature and JSDoc.

// When typing a kitz utility:
//
//   Arr.|  <-- cursor here
//
// Kitz LSP provides categorized completions:
//   -- Predicates --
//   is          (value: unknown) => value is readonly any[]
//   isEmpty     (value: readonly any[]) => value is readonly []
//   isNonEmpty  (value: readonly any[]) => value is NonEmpty
//
//   -- Transformations --
//   map         <A, B>(self: readonly A[], f: (a: A) => B) => B[]
//   filter      <A>(self: readonly A[], f: (a: A) => boolean) => A[]
//   flatMap     <A, B>(self: readonly A[], f: (a: A) => B[]) => B[]
//
//   -- Types --
//   Any         readonly any[]
//   NonEmpty    readonly [any, ...readonly any[]]
//   Empty       readonly []
```

```typescript
// ═══════════════════════════════════════════════════════════════
// LSP Feature: Refactoring - Pipe to Gen
// ═══════════════════════════════════════════════════════════════

// Before (pipe style):
const result = pipe(
  getUser(id),
  Effect.flatMap((user) =>
    pipe(
      getProfile(user.profileId),
      Effect.map((profile) => ({ user, profile })),
    ),
  ),
  Effect.catchTag('NotFound', () => Effect.succeed(null)),
)

// After (gen style, produced by kitz:pipe-to-gen refactoring):
const result = Effect.gen(function* () {
  const user = yield* getUser(id)
  const profile = yield* getProfile(user.profileId)
  return { user, profile }
}).pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))

// The refactoring:
// 1. Identifies the pipe chain
// 2. Extracts flatMap/map chains into yield* expressions
// 3. Preserves error handling (catchTag stays in pipe)
// 4. Generates a clean gen function
// 5. Maintains type safety (the transformation is semantically equivalent)
```

```typescript
// ═══════════════════════════════════════════════════════════════
// LSP Feature: Diagnostics for Kitz Anti-Patterns
// ═══════════════════════════════════════════════════════════════

// Diagnostic: Unused Effect value
//
// const fetchData = Effect.tryPromise(() => fetch(url))
//        ^^^^^^^^
// Warning: Effect value assigned but never used.
// Effects are lazy - this won't execute unless you run it.
// Suggestion: Did you mean to yield* this in a generator?

// Diagnostic: Layer not provided
//
// Effect.runPromise(program)
//                   ^^^^^^^
// Error: Effect requires services that are not provided:
//   - ConfigService
//   - DatabaseService
// Suggestion: Provide layers before running:
//   pipe(program, Effect.provide(AppLayer))

// Diagnostic: Error type not handled
//
// const result: Effect<User, never, never> = program
//                            ^^^^^
// Warning: Error type narrowed to never but program can fail with:
//   - HttpError
//   - ParseError
// Suggestion: Handle errors explicitly:
//   pipe(program, Effect.catchAll(handleError))
```

**The intelligence core implementation:**

The shared intelligence core is an Effect service that both the LSP and MCP server consume:

```typescript
// ═══════════════════════════════════════════════════════════════
// The Kitz Intelligence Core (Shared Service)
// ═══════════════════════════════════════════════════════════════

import { Context, Effect, Layer, Stream } from 'effect'

// The service interface
class KitzIntelligence extends Context.Tag('KitzIntelligence')<
  KitzIntelligence,
  {
    // Module discovery
    readonly getPackages: () => Effect.Effect<PackageInfo[]>
    readonly getModules: (pkg: string) => Effect.Effect<ModuleInfo[]>
    readonly getModuleApi: (pkg: string, mod: string) => Effect.Effect<ApiInfo>

    // JSDoc analysis
    readonly getJSDoc: (file: string, symbol: string) => Effect.Effect<JSDocInfo>
    readonly getCustomTags: (file: string) => Effect.Effect<CustomTag[]>

    // Pattern detection
    readonly detectAntiPatterns: (file: string) => Effect.Effect<Diagnostic[]>
    readonly detectServices: (file: string) => Effect.Effect<ServiceInfo[]>

    // Convention checking
    readonly checkConventions: (file: string) => Effect.Effect<ConventionViolation[]>

    // Code generation
    readonly scaffoldModule: (opts: ScaffoldOpts) => Effect.Effect<GeneratedFile[]>
    readonly scaffoldService: (opts: ServiceOpts) => Effect.Effect<GeneratedFile[]>

    // File system watching
    readonly watchWorkspace: () => Stream.Stream<FileChangeEvent>
  }
>() {}

// The implementation uses regex-based parsing for module structure
// and JSDoc, with optional tsgo IPC integration for type information
const KitzIntelligenceLive = Layer.succeed(KitzIntelligence, {
  getPackages: () =>
    Effect.gen(function* () {
      // Scan packages/ directory
      // Parse each package.json
      // Build PackageInfo[]
    }),
  getModules: (pkg) =>
    Effect.gen(function* () {
      // Read package's src/ directory
      // Find __.ts files (public barrels)
      // Parse each for exported symbols
      // Extract JSDoc metadata
    }),
  // ... rest of implementation
})

// The MCP server consumes this service:
//   const mcpHandler = Effect.gen(function*() {
//     const intel = yield* KitzIntelligence
//     const modules = yield* intel.getModules('core')
//     return formatAsResource(modules)
//   })

// The LSP server consumes the same service:
//   const hoverHandler = Effect.gen(function*() {
//     const intel = yield* KitzIntelligence
//     const jsdoc = yield* intel.getJSDoc(file, symbol)
//     return formatAsHover(jsdoc)
//   })
```

**The Tailwind parallel:**

Tailwind's LSP server starts, reads the Tailwind config, builds an in-memory index of all possible classes, and responds to requests. Kitz's LSP server starts, reads the workspace's `tsconfig.json` and package.json files, builds an in-memory index of all kitz modules, their public APIs, and their JSDoc metadata, and responds to requests. The structural pattern is identical.

### 4.5 Rolldown/Vite Plugin: Build-Time Optimization

The Rolldown plugin is the lowest-priority item in the tooling constellation, but it provides measurable value for bundle-conscious users:

**Pure annotation helper (easy, high impact):**

Many kitz patterns involve function calls at module scope that bundlers conservatively keep:

```typescript
// Bundler sees a function call -- might have side effects
const MyService = Effect.Tag('MyService')

// With the plugin, this gets annotated:
const MyService = /*#__PURE__*/ Effect.Tag('MyService')
```

The plugin recognizes known-pure kitz/Effect patterns and adds `/*#__PURE__*/` annotations during the `transform` hook. This uses Rolldown's hook filters to only process relevant files:

```typescript
export function kitzPurePlugin(): Plugin {
  return {
    name: 'kitz-pure',
    transform: {
      filter: { id: /\.[jt]sx?$/ },
      handler(code, id) {
        // Regex-based detection of known-pure patterns
        // Effect.Tag, Effect.Service, Layer.succeed, Layer.provide, etc.
        return code.replace(
          /\b(Effect\.Tag|Effect\.Service|Layer\.succeed|Layer\.provide)\s*\(/g,
          '/*#__PURE__*/ $1(',
        )
      },
    },
  }
}
```

**Import path rewriting (medium effort, conditional need):**

If barrel imports (`import { Arr, Str, Num } from '@kitz/core'`) cause tree-shaking to fail, the plugin can rewrite them to direct imports:

```typescript
// Before
import { Arr, Str } from '@kitz/core'

// After (generated by plugin)
import { Arr } from '@kitz/core/arr'
import { Str } from '@kitz/core/str'
```

This is only needed if bundlers cannot handle kitz's `export * as Arr from './arr/__.js'` pattern. Modern bundlers (Rolldown, esbuild) handle this correctly, so this is a contingency rather than a requirement.

### 4.6 How the Tools Feed Each Other

The tooling constellation is not a collection of independent tools -- the tools reinforce each other:

1. **JSDoc quality (enforced by OxLint) feeds the MCP server.** The MCP server reads JSDoc to provide API descriptions to AI agents. If the JSDoc is high-quality (enforced by lint rules), the MCP server provides high-quality context.

2. **MCP server discoveries feed the LSP.** The MCP server's module index (built by parsing the workspace) is the same data the LSP needs for completions and hover info. They should share the intelligence core.

3. **OxLint rules inform LSP diagnostics.** The same anti-pattern detection logic runs in OxLint (for CI) and the LSP (for real-time editor feedback). The intelligence core provides the detection, both tools consume it.

4. **Codegen templates (used by MCP tools) are validated by OxLint rules.** When the MCP server scaffolds a module, the generated code should pass all lint rules. This is verified by running the lint rules on the generated code before returning it to the agent.

5. **The Rolldown plugin consumes JSDoc metadata.** The `/*#__PURE__*/` annotation logic can be guided by `@pure` JSDoc tags: if a function is marked `@pure` in its JSDoc, the plugin annotates its call sites.

This interconnection is the strategic advantage of building all tools from a shared intelligence core. Each tool added makes every other tool more valuable.

### 4.7 Editor Extensions: Thin Wrappers

**VSCode Extension:**

The VSCode extension wraps the LSP server and adds VSCode-specific features:

- Color decorators for branded type annotations
- Tree view showing the kitz module hierarchy
- Status bar indicator showing kitz version and diagnostics count
- Commands for scaffolding (invoking MCP tools from the command palette)
- WebView for visualizing service dependency graphs

These features use VSCode's extension API directly (no LSP equivalent). They're additive -- the extension works fine without them, but they improve the experience.

**Zed Extension:**

Zed's WASM-based extension system supports language server integration. The kitz Zed extension:

- Declares the kitz LSP server as a language server
- Provides slash commands for Zed's AI assistant (invoking MCP prompts)
- Sets up language configuration (comments, brackets, auto-close pairs)

Zed's extension API is narrower than VSCode's (no custom panels, no decorations), but the core LSP features (completions, diagnostics, hover) work identically because they come from the shared LSP server.

---

## 5. Code Generation Strategy

### 5.1 Build-Time Template Codegen as the Primary Approach

The research is clear: build-time template codegen is the only strategy that is simultaneously tsgo-safe, tree-shake-safe, and immediately feasible. Every other approach (macro transforms, compiler plugins, AST manipulation via ts-morph) depends on the TypeScript compiler API, which will not exist in tsgo.

Template codegen is simple: a script reads some input (configuration, schema definitions, type registries), generates `.ts` files using string interpolation, and outputs them to a known location. The generated files are then compiled by tsgo like any other source file.

```typescript
// ═══════════════════════════════════════════════════════════════
// Codegen Architecture
// ═══════════════════════════════════════════════════════════════

// Input: structured data describing what to generate
interface CodegenInput {
  readonly kind: 'module' | 'service' | 'typeclass' | 'test'
  readonly name: string
  readonly package: string
  readonly config: Record<string, unknown>
}

// Output: file path + content pairs
interface CodegenOutput {
  readonly files: ReadonlyArray<{
    readonly path: string
    readonly content: string
  }>
}

// The codegen pipeline
// 1. Read input (from config file, JSDoc tags, or CLI arguments)
// 2. Validate input against schema
// 3. Apply template to produce output files
// 4. Write output files
// 5. tsgo compiles them normally
```

### 5.2 What Gets Generated

**Typeclass instances (Tier 3 dispatch tables):**

When a project declares typeclass instances in a registry file, codegen produces:

- Static dispatch functions (`eqFor`, `ordFor`, `monoidFor`)
- Type witness constants (`string_`, `number_`, `array_`)
- Re-export modules for tree-shakeable per-type access

**Module scaffolds:**

When creating a new module in a kitz package, codegen produces:

- The implementation file (`module.ts`)
- The internal barrel (`_.ts`)
- The public barrel (`__.ts`)
- The test file (`module.test.ts`)
- The type test file (`module.test-d.ts`)
- Package.json `imports` and `exports` entries (via script, not codegen)

This is what the `creating-modules` Claude Code skill already does. Codegen formalizes it into a tool that the MCP server and CLI can invoke.

**Test boilerplate:**

For typeclass instances, codegen produces property-based tests verifying the typeclass laws:

```typescript
// Generated: __generated__/tests/eq-string.test.ts
/** @generated - DO NOT EDIT */
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { stringEq } from '../instances/string.js'

describe('Eq<string>', () => {
  it('satisfies reflexivity', () => {
    fc.assert(
      fc.property(fc.string(), (a) => {
        expect(stringEq.equals(a, a)).toBe(true)
      }),
    )
  })

  it('satisfies symmetry', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(stringEq.equals(a, b)).toBe(stringEq.equals(b, a))
      }),
    )
  })

  it('satisfies transitivity', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (a, b, c) => {
        if (stringEq.equals(a, b) && stringEq.equals(b, c)) {
          expect(stringEq.equals(a, c)).toBe(true)
        }
      }),
    )
  })
})
```

The law tests are generated directly from the `@law` JSDoc tags on the typeclass interface. The codegen reads the JSDoc, parses the law expressions, and produces fast-check properties. This closes the loop between documentation and verification: the laws in the JSDoc ARE the tests.

### 5.3 How Codegen Works with Tree-Shaking

Generated code must be tree-shakeable. This means:

1. **No side effects in generated files.** Every generated module is `sideEffects: false` compatible. No module-level function calls without `/*#__PURE__*/`.

2. **Granular modules.** Each generated file exports a small, focused set of symbols. The dispatch table for `Eq` instances is separate from the dispatch table for `Ord` instances.

3. **Dynamic imports for large dispatch tables.** If a project has hundreds of typeclass instances, the dispatch function can use dynamic imports to load instances lazily:

```typescript
// Generated: for projects with many instances
export async function eqFor<A>(witness: TypeWitness<A>): Promise<Eq<A>> {
  switch (witness.tag) {
    case 'string':
      return (await import('./instances/string.js')).stringEq as Eq<A>
    case 'MyCustomType':
      return (await import('./instances/custom.js')).customEq as Eq<A>
    // ...
  }
}
```

Dynamic imports are tree-shakeable in Rolldown/esbuild (unused branches are eliminated when the input is statically known).

### 5.4 The Role of JSDoc in Codegen

JSDoc custom tags drive code generation:

```typescript
/**
 * @typeclass Monoid
 * @law leftIdentity: (a: A) => combine(empty, a) === a
 * @law rightIdentity: (a: A) => combine(a, empty) === a
 * @law associativity: (a: A, b: A, c: A) =>
 *   combine(combine(a, b), c) === combine(a, combine(b, c))
 */
interface Monoid<A> {
  readonly empty: A
  readonly combine: (self: A, that: A) => A
}
```

The `@typeclass` tag tells the codegen that this interface is a typeclass definition. The `@law` tags provide the algebraic laws. The codegen reads this metadata and produces:

1. A Tier 1 type-level trait (global namespace with Handlers interface)
2. A Tier 3 dispatch function template (to be filled in by the user or a further codegen step)
3. Property-based test templates for each law
4. JSDoc for the generated code (including references back to the original definition)

This means the JSDoc IS the source of truth. The typeclass interface is the only thing the user writes. Everything else is derived.

### 5.5 Compiler-API Independence

The critical constraint is that codegen must work without the TypeScript compiler API, because tsgo may never expose one. This means:

- **No ts-morph.** No programmatic AST construction.
- **No type checker queries.** Cannot ask "what type is this expression?"
- **No declaration file parsing.** Cannot read `.d.ts` files as structured data.

Instead, codegen relies on:

- **String templates.** The simplest, most robust approach. Generated code is produced by string interpolation.
- **Regex-based parsing.** For reading JSDoc tags and interface definitions from `.ts` source files. This is fragile for arbitrary TypeScript but reliable for kitz's predictable conventions.
- **Schema-based input.** For structured inputs (typeclass registries, module configurations), the user provides a TypeScript or JSON file that the codegen reads as data.

When tsgo's IPC API becomes available, the codegen can optionally use it for type introspection (e.g., resolving type aliases, checking interface conformance). But the core codegen works without it.

---

## 6. JSDoc as Infrastructure

### 6.1 JSDoc Is Not Documentation

In kitz, JSDoc serves four audiences simultaneously:

1. **Human developers** reading code in their editor (hover information, inline documentation)
2. **AI agents** reasoning about API usage (the primary consumer in kitz's agentic-first model)
3. **Machines** extracting metadata for tooling (lint rules, MCP server, codegen, LSP)
4. **Verification systems** ensuring examples are correct (doc-vitest, generated law tests)

This multiplicity means JSDoc quality has outsized impact. A well-written JSDoc comment that includes `@example`, `@pure`, `@complexity`, and `@law` tags simultaneously improves hover information, AI agent accuracy, lint rule precision, code generation correctness, and test coverage. A poorly-written JSDoc comment degrades all five.

### 6.2 Custom Tags

Kitz introduces a set of custom JSDoc tags that go beyond the TSDoc standard. These tags are machine-parseable and feed into the tooling constellation:

````typescript
/**
 * Compute the absolute value of a number.
 *
 * Returns the non-negative magnitude of the input. For non-negative
 * inputs, returns the input unchanged. For negative inputs, returns
 * the negation.
 *
 * @param value - The number to make non-negative. Must be finite.
 * @returns The absolute value, always >= 0
 *
 * @example Basic usage
 * ```ts
 * import { Num } from '@kitz/core'
 *
 * Num.abs(-5)  // => 5
 * Num.abs(3)   // => 3
 * Num.abs(0)   // => 0
 * Num.abs(-0)  // => 0
 * ```
 *
 * @complexity O(1)
 * @pure
 * @law nonNegative: (x: number) => abs(x) >= 0
 * @law idempotent: (x: number) => abs(abs(x)) === abs(x)
 * @law triangle: (x: number, y: number) => abs(x + y) <= abs(x) + abs(y)
 *
 * @category Arithmetic
 * @since 0.1.0
 * @see {@link Num.sign} for extracting the sign
 * @see {@link Num.negate} for unconditional negation
 */
````

The custom tags and their consumers:

| Tag           | Consumed by                 | Purpose                             |
| ------------- | --------------------------- | ----------------------------------- |
| `@complexity` | MCP server, LSP hover       | Show algorithmic complexity         |
| `@pure`       | Rolldown plugin, OxLint     | Mark as side-effect-free            |
| `@law`        | Codegen, test generation    | Algebraic laws for property testing |
| `@typeclass`  | Codegen, MCP server         | Mark interface as a typeclass       |
| `@instance`   | Codegen, MCP server         | Mark value as a typeclass instance  |
| `@example`    | doc-vitest, MCP server, LSP | Runnable examples                   |
| `@since`      | MCP server, changelog       | API stability tracking              |
| `@category`   | MCP server, TypeDoc, LSP    | Logical grouping                    |
| `@see`        | LSP, MCP server             | Cross-references                    |

### 6.3 doc-vitest for Example Verification

Every `@example` in kitz should be a runnable test. [doc-vitest](https://github.com/ssssota/doc-vitest) (vite-plugin-doctest) extracts example code blocks and runs them as Vitest tests:

````typescript
/**
 * Split a string by a separator.
 *
 * @example
 * ```ts @import.meta.vitest
 * import { Str } from '@kitz/core'
 *
 * expect(Str.split('a,b,c', ',')).toEqual(['a', 'b', 'c'])
 * expect(Str.split('hello', '')).toEqual(['h', 'e', 'l', 'l', 'o'])
 * expect(Str.split('abc', ',')).toEqual(['abc'])
 * ```
 */
export const split = (value: string, separator: string): string[] => value.split(separator)
````

The `@import.meta.vitest` marker tells doc-vitest to extract this block as a test. The test runs in the same vitest environment as the rest of the test suite, with full access to imports and assertions.

Benefits:

- Examples never drift from implementation
- Every public API has at least one verified usage example
- AI agents can trust that examples are correct (they're tested)
- The test suite gets additional coverage "for free"

Limitations:

- No type-level assertions (only runtime behavior)
- No async lifecycle hooks
- Static imports not supported (use dynamic imports or pass through setup)

For type-level testing, kitz uses separate `.test-d.ts` files with `expectTypeOf` from vitest.

### 6.4 The Vision: Every Function is Machine-Readable

The endgame is that every public function in kitz has JSDoc that:

1. **Summarizes** in one sentence what the function does (human and LLM readable)
2. **Explains** edge cases, constraints, and behavior (human readable, LLM useful)
3. **Demonstrates** with runnable examples (LLM training data, doc-vitest verified)
4. **Declares** purity, complexity, and algebraic laws (machine parseable)
5. **Cross-references** related functions (MCP server and LSP navigable)
6. **Categorizes** for discoverability (TypeDoc grouping, MCP filtering)
7. **Versions** for stability tracking (changelog generation, migration tooling)

When all seven properties are present, the JSDoc transforms from "documentation" into "API metadata." The MCP server can answer questions like "give me all pure functions in the Arr module with O(n) complexity." The codegen can generate law tests without any additional input. The LSP can show meaningful hover information without parsing implementation code. The lint rules can verify that pure functions don't perform side effects.

This is not theoretical -- Effect already achieves properties 1, 2, 3, 6, and 7 for most of its API surface. Kitz adds properties 4 (purity, complexity, laws) and 5 (structured cross-references) to reach the full vision.

---

## 7. Type Safety Without Compromise

### 7.1 tsgo as a Type-Level Computation Budget Multiplier

The most underappreciated consequence of tsgo's 7-10x speedup is what it means for type-level computation. Type patterns that were "too expensive" in tsc -- causing IDE lag, slow builds, editor timeouts -- become viable in tsgo.

Consider kitz's HKT composition:

```typescript
// Kind.Pipe applies kinds left-to-right
type Result = Kind.Pipe<
  [
    ReturnedLens, // Extract return type
    AwaitedLens, // Unwrap Promise
    ArrayElementLens, // Extract element type
    NullableUnwrap, // Remove null/undefined
  ],
  () => Promise<(string | null)[]>
>
// Result: string
```

Each step in the pipeline creates intersection types and resolves conditional types. In tsc, a 4-step pipeline like this takes measurable time. In tsgo, it's instantaneous. This means kitz can offer deeper type-level computations without worrying about editor responsiveness.

But the speedup has limits. The hard limits in TypeScript's type system are **semantic**, not performance-based:

| Limit                       | Value       | tsgo helps?                 |
| --------------------------- | ----------- | --------------------------- |
| Tail-recursive depth        | 1000        | No (unchanged)              |
| Non-tail recursive depth    | ~50         | No (unchanged)              |
| Type instantiation depth    | ~500        | No (unchanged)              |
| Union comparison cost       | O(n^2)      | Yes (faster per comparison) |
| Conditional type evaluation | CPU-bound   | Yes (faster CPU)            |
| Interface merging           | Accumulated | Yes (faster accumulation)   |

The depth limits are semantic constraints in the type checker, not performance limits. Even tsgo hits them at the same depth. What tsgo enables is:

- More complex per-level computations (each level can do more work)
- Larger union types (O(n^2) comparison is 10x faster per comparison)
- More aggressive interface merging (the Display trait with hundreds of handlers)
- Faster IDE feedback on complex type expressions

### 7.2 Concrete Type Safety Techniques

**Branded types for domain safety:**

```typescript
// A file path is a string, but not every string is a file path
type FilePath = string & Brand.Brand<'FilePath'>
const FilePath = Brand.nominal<FilePath>()

// A positive integer is a number, but not every number is a positive integer
type PositiveInt = number & Brand.Brand<'PositiveInt'>
const PositiveInt = Brand.refined<PositiveInt>(
  (n) => Number.isInteger(n) && n > 0,
  (n) => Brand.error(`Expected positive integer, got ${n}`),
)

// Brands compose
type Port = PositiveInt & Brand.Brand<'Port'>
const Port = Brand.refined<Port>(
  (n) => PositiveInt(n) && n <= 65535,
  (n) => Brand.error(`Expected port number (1-65535), got ${n}`),
)
```

Branded types add zero runtime cost (the brand is erased at runtime) but prevent entire categories of bugs at compile time. A function that accepts `FilePath` cannot receive an arbitrary string -- the caller must explicitly brand it, which forces validation at the boundary.

**Const type parameters for literal preservation:**

```typescript
// Without const: routes is string[], losing literal information
const createRouter = <T extends string[]>(routes: T) => routes

// With const: routes is readonly ['users', 'posts'], preserving literals
const createRouter = <const T extends readonly string[]>(routes: T) => routes

const router = createRouter(['users', 'posts'] as const)
// router: readonly ['users', 'posts'] -- literal types preserved
```

Kitz should use `const` type parameters on any factory function where the input's literal type is meaningful to the output. This includes data modeling functions, configuration builders, and route definitions.

**NoInfer for inference control:**

```typescript
// Without NoInfer: T is inferred from both `initial` and `states`,
// potentially widening the type
const createFSM = <T extends string>(initial: T, states: T[]) => ({ initial, states })

// With NoInfer: T is inferred ONLY from `initial`, states are checked
const createFSM = <T extends string>(initial: T, states: NoInfer<T>[]) => ({ initial, states })

// Now this is a compile error:
createFSM('idle', ['idle', 'loading', 'typo_state'])
// Error: 'typo_state' is not assignable to 'idle'
```

`NoInfer` is essential for kitz's API design. When a function takes a "definition" parameter and a "usage" parameter, use `NoInfer` on the usage side to prevent the usage from widening the definition type.

**Variance annotations for API contracts:**

```typescript
// Effect types use variance extensively
interface Effect<out A, out E = never, out R = never> { ... }
//                out     out            out
// All three are covariant: Effect<Dog, DogError, DogService>
// is assignable to Effect<Animal, Error, Service>

// Kitz's typeclass interfaces declare their variance
interface Eq<in A> { ... }         // contravariant: consumes A
interface Ord<in A> extends Eq<A> { ... }  // contravariant: consumes A
interface Show<in A> { ... }       // contravariant: consumes A
interface Functor<F extends Kind> { ... }  // invariant: F is complex
```

Variance annotations serve three purposes:

1. Errors surface at the declaration site (where the variance conflict is) rather than at the call site (where the user is confused)
2. The compiler can optimize by skipping structural comparison when variance is known
3. They document the API contract: "Eq receives values of type A" vs "Functor produces values of type Apply<F, [A]>"

### 7.3 Performance-Safe Patterns

The TypeScript Performance Wiki and kitz's own experience identify patterns that are safe at scale:

**Prefer interfaces over intersection types:**

```typescript
// SLOW: intersection creates a new anonymous type every time
type Config = BaseConfig & { debug: boolean } & { port: number }

// FAST: interface extends creates a cached, flat type
interface Config extends BaseConfig {
  debug: boolean
  port: number
}
```

Kitz's codebase uses interfaces for extension and intersections only when necessary (brand types, conditional type results). This keeps the type graph shallow and cacheable.

**Name complex types (enable caching):**

```typescript
// SLOW: anonymous conditional type recomputed at every usage
type GetOutput<T> = T extends { output: infer O } ? O : never

// FAST: named type is computed once and cached
type HasOutput<T> = T extends { output: unknown } ? true : false
type ExtractOutput<T> = T extends { output: infer O } ? O : never
type GetOutput<T> = HasOutput<T> extends true ? ExtractOutput<T> : never
```

Kitz's Kind module already follows this pattern: `Apply`, `Pipe`, `PipeRight` are all named types that the checker caches.

**Tail-recursive types with accumulators:**

```typescript
// SLOW: non-tail recursive, hits depth limit at ~50
type Reverse<T extends any[]> = T extends [infer H, ...infer Rest] ? [...Reverse<Rest>, H] : []

// FAST: tail-recursive with accumulator, works to depth ~1000
type Reverse<T extends any[], Acc extends any[] = []> = T extends [infer H, ...infer Rest]
  ? Reverse<Rest, [H, ...Acc]>
  : Acc
```

All recursive types in kitz must use the tail-recursive accumulator pattern. The non-tail-recursive pattern is banned because its depth limit (~50) is too low for practical use.

### 7.4 The Endgame: Types So Precise That Runtime Validation Is Redundant

For kitz-internal code, the type system should be the primary correctness guarantee. When types are precise enough, runtime validation is redundant for trusted inputs:

```typescript
// The type says "non-empty array of positive integers sorted in ascending order"
type SortedPositiveInts = NonEmptyArray<PositiveInt> & Brand.Brand<'Sorted'>

// The function's type IS the specification
const median = (values: SortedPositiveInts): PositiveInt => {
  const mid = Math.floor(values.length / 2)
  if (values.length % 2 === 0) {
    return PositiveInt((values[mid - 1]! + values[mid]!) / 2)
  }
  return values[mid]!
}

// No runtime checks needed inside the function because:
// - values is non-empty (type guarantee)
// - values contains positive integers (brand guarantee)
// - values is sorted (brand guarantee)
// - the result is a positive integer (brand guarantee)
```

Runtime validation still happens at system boundaries (API inputs, file reads, user inputs). But between kitz functions, the types carry the full specification. This is the functional programming ideal: correct by construction.

This vision is achievable because:

1. Effect Schema validates at boundaries and produces branded types
2. Kitz's type-level utilities express complex constraints
3. tsgo's speed makes deep type computations practical
4. The typeclass system (TRAITOR v2) composes constraints algebraically

---

## 8. The Agentic-First Library

### 8.1 What "Agentic-First" Means

"Agentic-first" means that the primary consumer of kitz's API surface, documentation, conventions, and error messages is an AI agent -- not a human developer reading docs in a browser. This does not mean kitz is hostile to humans. It means that when design decisions have trade-offs between human ergonomics and agent predictability, kitz favors agent predictability.

This is a controversial design stance, so let's be explicit about what it implies:

**Convention over configuration.** Kitz has strong opinions about module structure (`_.ts` for internal barrels, `__.ts` for public barrels), naming (PascalCase for types, camelCase for values), and patterns (data-first + data-last dual API, curried `On`/`With` variants). These conventions are not optional. An agent that learns them once can apply them everywhere. A human who prefers different conventions must adapt.

**Predictability over cleverness.** Kitz avoids "magic" -- implicit resolution, auto-import side effects, prototype chain tricks. Every operation is explicit and traceable. An agent can follow the code path without special knowledge of hidden mechanisms.

**Metadata over prose.** JSDoc uses structured tags (`@pure`, `@complexity`, `@law`) that machines can parse, rather than free-form prose that only humans can interpret. The prose is still there (for humans), but the structured tags are the canonical source.

**Scaffolding over improvisation.** Kitz provides templates and generators for common tasks. An agent using the MCP server scaffolds a correct module in one shot. A human writing from scratch has more freedom but more room for error.

### 8.2 The Flywheel

Kitz's agentic-first design creates a self-reinforcing cycle:

```
Better tooling
    │
    ▼
Better AI assistance ──────► More adoption
    ▲                             │
    │                             ▼
More tooling investment ◄─── More contributors
```

**Better tooling** (MCP server, LSP, lint rules) enables **better AI assistance** because agents have access to structured metadata, pattern detection, and code generation. Better AI assistance means developers using kitz + AI produce better code faster, which drives **more adoption**. More adoption means more contributors who can invest in **more tooling**, completing the cycle.

The flywheel has a cold-start problem (you need tooling before you get adoption), which is why the MCP server is the highest-priority investment: it directly improves AI assistance without requiring broad adoption first. A single developer using kitz with the MCP server in Claude Code immediately benefits. That benefit compounds as more developers and more tools are added.

### 8.3 How Each Tool Serves the Agent

**MCP Server: The agent's map of the codebase.**

Without the MCP server, an agent exploring a kitz project must grep through files, read package.json, parse barrel files, and build a mental model of the workspace. This consumes context window and introduces errors. With the MCP server, the agent queries `kitz://packages/core/modules` and gets a structured response listing every module, its public API, and its metadata. The agent can then focus its context window on the specific code it needs to modify.

**JSDoc: The agent's understanding of each function.**

LLMs learn API usage primarily from examples. When every kitz function has verified `@example` blocks, the agent can generate correct code by following the patterns in the JSDoc. When functions have `@pure` tags, the agent knows it can call them freely without worrying about side effects. When functions have `@law` tags, the agent knows which properties must hold in tests.

**Codegen: The agent's scaffolding tools.**

When the agent needs to create a new kitz module, it invokes the `kitz:scaffold-module` MCP tool and gets a complete, convention-compliant module structure. No guessing about barrel file patterns, no forgetting to update package.json exports. The generated code is correct by construction because the templates encode the conventions.

**OxLint: The agent's safety net.**

When the agent generates code, lint rules catch kitz-specific anti-patterns before the code is committed. Floating effects, missing error tags, convention violations, and JSDoc quality issues are all caught automatically. The agent can iterate on lint feedback without human intervention.

**LSP: The agent's type feedback.**

When the agent modifies code, the LSP provides real-time diagnostics. Type errors, missing imports, and kitz-specific warnings appear immediately, allowing the agent to self-correct without running the full build.

### 8.4 The Development Experience

Here's what developing with kitz looks like when the full tooling constellation is in place:

```
Developer: "Create a new module in @kitz/core that provides
            set operations (union, intersection, difference)
            for arrays, with typeclass-based equality."

Agent:
  1. Queries kitz://packages/core/modules to understand existing modules
  2. Queries kitz://conventions to load module conventions
  3. Invokes kitz:scaffold-module with name="set", package="core"
  4. Gets: set.ts, _.ts, __.ts, set.test.ts, set.test-d.ts
  5. Reads JSDoc from Arr module for style guidance
  6. Implements union, intersection, difference using Eq<A> instance parameter
  7. Writes JSDoc with @example, @pure, @complexity, @law tags
  8. Generates law tests from @law tags
  9. Runs lint rules -- catches a missing @since tag, fixes it
  10. Runs type checker -- all types resolve correctly
  11. Commits with conventional commit message

Total time: ~60 seconds
Total human intervention: reviewing the diff
```

This is not hypothetical. Kitz already has Claude Code skills that achieve steps 1-4. The tooling constellation makes steps 5-10 systematic and verified.

### 8.5 More Development Scenarios

Let's walk through several more realistic scenarios to illustrate the agentic-first development experience:

**Scenario: Debugging a Type Error**

```
Developer: "I'm getting a type error: 'Type Effect<void, never, never>
            is not assignable to Effect<void, never, UserService>'"

Agent (with MCP server):
  1. Invokes kitz:explain-error with the error text
  2. MCP server identifies this as a "missing service requirement" pattern
  3. Returns explanation: "The function expects an Effect that requires
     UserService, but the provided Effect has no requirements (R = never).
     This means UserService is not being accessed inside the generator."
  4. Queries kitz://packages/myapp/services to find UserService definition
  5. Reads UserService's JSDoc to understand its API
  6. Suggests: "Add 'const userService = yield* UserService' inside your
     Effect.gen to access the service."
  7. Provides a corrected code example using the actual UserService API

Without MCP server:
  1. Agent reads the raw TypeScript error
  2. Greps for UserService definition across multiple files
  3. Reads several files to understand the service's purpose
  4. Makes an educated guess about the fix
  5. May or may not get the service access pattern right
  6. Multiple iterations needed

Time saved: 2-3 iterations (~1-2 minutes)
```

**Scenario: Adding a Feature to an Existing Module**

```
Developer: "Add a 'chunk' function to the Arr module that splits an
            array into chunks of size n."

Agent (with MCP server + OxLint + LSP):
  1. Queries kitz://packages/core/modules/arr for current API
  2. Reads existing function JSDoc patterns (pure, complexity, examples)
  3. Queries kitz://conventions for currying convention
  4. Implements chunk with:
     - data-first: chunk(arr, size)
     - data-last: chunkWith(size)(arr)
  5. Writes JSDoc following the pattern found in step 2:
     - @pure
     - @complexity O(n)
     - @example with 3 test cases
     - @since 0.x.0
     - @category Transformations
     - @see {@link Arr.take} for taking first n elements
  6. Adds type tests (chunk preserves readonly, handles empty, handles NonEmpty)
  7. Runs OxLint -- all rules pass
  8. Runs type checker -- all types resolve
  9. Runs tests -- all examples pass (via doc-vitest)

The key difference: step 2 doesn't require reading files.
The MCP server provides the JSDoc pattern directly.
```

**Scenario: Creating a New Package**

```
Developer: "Create a @kitz/cache package with an Effect-based
            LRU cache service."

Agent (with MCP server + codegen):
  1. Invokes kitz:scaffold-package with name="cache"
  2. Gets complete package scaffolding:
     - package.json with correct workspace config
     - tsconfig.json extending the root config
     - tsconfig.build.json with correct excludes
     - src/_.ts, src/__.ts barrel files
     - src/errors.ts with TaggedContextualError pattern
     - src/cache.ts with Effect service skeleton
     - src/cache.test.ts with test scaffolding
  3. Reads existing service patterns from @kitz/core (via MCP resources)
  4. Implements LRU cache as an Effect service:
     - Cache<K, V> interface with get, set, delete, clear
     - CacheLive implementation with configurable max size
     - CacheConfig service for dependency injection
  5. Writes JSDoc on every export
  6. Implements property-based tests for LRU eviction behavior
  7. Updates root pnpm-workspace.yaml
  8. Verifies turbo build succeeds

Every step after 2 benefits from the MCP server providing
context about how existing kitz packages are structured.
```

**Scenario: Cross-Module Refactoring**

```
Developer: "Rename the 'is' function in every domain module to 'guard'
            and update all callsites."

Agent (with LSP + MCP server):
  1. Queries kitz://packages/core/modules for all modules
  2. For each module, identifies the 'is' export
  3. Uses LSP rename refactoring on each 'is' function
  4. LSP handles:
     - The function definition
     - All internal imports (#arr, #bool, etc.)
     - All external imports (@kitz/core, @kitz/core/arr, etc.)
     - All test files
     - JSDoc @see references
  5. Verifies type checker passes
  6. Runs tests to verify no behavioral changes
  7. Commits with: "refactor(core): rename domain `is` functions to `guard`"

The LSP makes this a single-pass operation instead of a
multi-file grep-and-replace with manual verification.
```

### 8.6 Agentic-First Does Not Mean Human-Last

Every property that makes kitz agent-friendly makes it human-friendly too:

- **Predictable conventions** mean humans don't need to re-learn patterns for each module
- **Rich JSDoc** means humans get excellent hover information and examples
- **Lint rules** catch bugs for humans just as effectively as for agents
- **Codegen** saves humans time when scaffolding new modules
- **Type safety** prevents bugs regardless of who wrote the code

The distinction is in the _priority_ of optimization. A human-first library might accept inconsistent conventions across modules because "humans can figure it out." A kitz-style library insists on consistency because agents can't figure it out. The result is that the library is better for both audiences.

### 8.7 Measuring Agentic Effectiveness

To validate the agentic-first thesis, kitz should track metrics that measure AI-assisted development quality:

**Code correctness metrics:**

- Percentage of agent-generated modules that pass type checking on first attempt
- Percentage of agent-generated modules that pass lint rules on first attempt
- Number of iterations needed for an agent to produce a correct implementation
- Percentage of agent-generated JSDoc examples that are verified by doc-vitest

**Development velocity metrics:**

- Time from "describe what you want" to "working, tested implementation"
- Lines of code produced per minute of human attention
- Ratio of human-written code to agent-written code in the final commit

**Tooling usage metrics:**

- Number of MCP resource queries per development session
- Number of MCP tool invocations per development session
- Number of lint violations caught and auto-fixed by agents
- Number of LSP-assisted refactorings per session

These metrics guide tooling investment. If agents struggle with a specific task (low first-attempt success rate), that task needs better MCP resources, more specific prompts, or stronger conventions. If agents produce code that consistently fails a specific lint rule, that rule might need a better suggestion or the convention might need simplification.

### 8.8 The Long-Term Vision: AI-Native Development

Looking further ahead, the agentic-first approach opens possibilities that are impossible with human-first libraries:

**Self-optimizing type patterns.** An agent that understands both the type system and the tsgo performance characteristics can automatically choose between type-level patterns (Tier 1 typeclasses) and runtime patterns (Tier 2) based on complexity analysis. "This type computation involves a 200-element union? Better use Tier 2 with explicit instances rather than Tier 1 declaration merging."

**Continuous convention evolution.** Because conventions are machine-readable (enforced by lint rules, documented in MCP resources), they can evolve more aggressively than in human-first libraries. A convention change is a lint rule change + a codemod. Agents handle the migration automatically. Backwards compatibility is irrelevant because the agent that wrote the code is also the agent that migrates it.

**Cross-project consistency.** With the MCP server, an agent working on project A can query the same conventions as an agent working on project B. Both produce code that follows kitz conventions identically. This creates emergent ecosystem consistency without any governance overhead.

**Proactive quality improvement.** An agent with access to the full tooling constellation can proactively suggest improvements: "This module's JSDoc is missing @complexity tags. Based on the implementation, here are the complexities: filter O(n), map O(n), flatMap O(n\*m). Would you like me to add them?" This turns quality from a review-time concern into a continuous, automated process.

---

## 9. Implementation Roadmap

### Phase 0: Foundation (Now)

**JSDoc quality standards:**

- Define the kitz JSDoc convention (required tags, example format, custom tags)
- Add `@kitz/jsdoc-quality` OxLint rule enforcing the convention
- Retrofit existing `@kitz/core` public API with compliant JSDoc
- Integrate doc-vitest for example verification

Concrete deliverables:

```
packages/core/.claude/CONVENTIONS.md  -- updated with JSDoc standards
vitest.config.ts                       -- doc-vitest plugin added
packages/core/src/arr/arr.ts          -- first module with compliant JSDoc
packages/core/src/str/str.ts          -- second module with compliant JSDoc
.claude/rules/jsdoc-quality.md        -- rule document for agents
```

**TRAITOR v2 Tier 1 formalization:**

- The Display trait already works. Formalize the pattern with documentation.
- Add 2-3 more Tier 1 traits (TypeName, Serializable) to validate the pattern.
- Document the `KITZ.Traits` namespace convention.

Concrete deliverables:

```
packages/core/src/ts/traits/display.ts     -- already exists, add docs
packages/core/src/ts/traits/type-name.ts   -- new Tier 1 trait
packages/core/src/ts/traits/serializable.ts -- new Tier 1 trait
packages/core/src/ts/traits/_.ts           -- barrel for traits
.claude/rules/typeclass-conventions.md      -- rule document for agents
```

**Audit existing kitz packages:**

With 38 packages in the monorepo, it's critical to understand the current state before investing in tooling. The audit should:

- Catalog which packages have `.claude/CONVENTIONS.md`
- Measure JSDoc coverage across all public exports
- Identify packages that would most benefit from typeclass instances
- Map service definitions and layer compositions

**Duration:** 2-4 weeks
**Dependencies:** None
**Risk:** Low

### Phase 1: First Tools (Near)

**MCP Server (basic):**

- Resources: `kitz://packages`, `kitz://packages/{name}/modules`
- Tools: `kitz:scaffold-module`, `kitz:check-conventions`
- Prompts: `kitz:new-feature`, `kitz:debug-effect`
- Implementation: Effect-based, TypeScript MCP SDK, regex-based parsing

Concrete deliverables:

```
packages/mcp/                          -- new @kitz/mcp package
packages/mcp/src/server.ts             -- MCP server entry point
packages/mcp/src/resources/packages.ts -- package listing resource
packages/mcp/src/resources/modules.ts  -- module API resource
packages/mcp/src/resources/conventions.ts -- convention resource
packages/mcp/src/tools/scaffold.ts     -- scaffolding tool
packages/mcp/src/tools/check.ts        -- convention checking tool
packages/mcp/src/prompts/new-feature.ts -- feature development prompt
packages/mcp/src/prompts/debug.ts      -- debugging prompt
```

The MCP server is a new `@kitz/mcp` package in the monorepo, using Effect internally and depending on:

- `@modelcontextprotocol/sdk` for MCP protocol handling
- `@kitz/fs` for file system operations
- `@kitz/core` for data manipulation
- `@kitz/log` for structured output

**OxLint Plugin (pattern rules):**

- `@kitz/no-floating-effect`
- `@kitz/require-error-tag`
- `@kitz/barrel-convention`
- `@kitz/jsdoc-quality`
- `@kitz/no-bare-throw`
- Dual OxLint/ESLint compatibility via `createOnce`

Concrete deliverables:

```
packages/oxlint-plugin/                    -- new @kitz/oxlint-plugin package
packages/oxlint-plugin/src/rules/          -- rule implementations
packages/oxlint-plugin/src/index.ts        -- plugin entry point
packages/oxlint-plugin/tests/              -- rule test fixtures
```

**TRAITOR v2 Tier 2 (explicit instances):**

- Define core typeclass interfaces: Eq, Ord, Hash, Show, Monoid
- Implement instances for primitive types and arrays
- Add polymorphic utility functions (sort, nub, group, fold)
- Property-based tests for all typeclass laws

Concrete deliverables:

```
packages/core/src/typeclass/               -- new module directory
packages/core/src/typeclass/eq.ts          -- Eq interface + instances
packages/core/src/typeclass/ord.ts         -- Ord interface + instances
packages/core/src/typeclass/hash.ts        -- Hash interface + instances
packages/core/src/typeclass/show.ts        -- Show interface + instances
packages/core/src/typeclass/monoid.ts      -- Monoid interface + instances
packages/core/src/typeclass/functor.ts     -- Functor interface + instances
packages/core/src/typeclass/foldable.ts    -- Foldable interface + instances
packages/core/src/typeclass/laws.ts        -- Law testing utilities
packages/core/src/typeclass/_.ts           -- internal barrel
packages/core/src/typeclass/__.ts          -- public barrel
```

**Duration:** 4-8 weeks
**Dependencies:** Phase 0
**Risk:** Medium (MCP SDK stability, OxLint JS plugin maturity)

### Phase 2: Editor Intelligence (Medium)

**TS Language Service Plugin:**

- Custom completions for kitz patterns
- Diagnostics for anti-patterns (same logic as OxLint rules)
- Hover enrichment for complex Effect types
- Refactorings: pipe-to-gen, extract service

The plugin follows Effect's architecture: a decorator around TypeScript's language service that intercepts and enriches responses. The critical design decision is to implement the intelligence in a separate, API-independent module:

```typescript
// packages/language-service/src/intelligence/index.ts
// This module has NO dependency on the TS language service API.
// It takes plain data and returns plain data.

export interface DiagnosticInput {
  readonly sourceText: string
  readonly fileName: string
  readonly existingDiagnostics: readonly SimpleDiagnostic[]
}

export interface DiagnosticOutput {
  readonly additionalDiagnostics: readonly SimpleDiagnostic[]
}

export function computeKitzDiagnostics(input: DiagnosticInput): DiagnosticOutput {
  const diagnostics: SimpleDiagnostic[] = []

  // Check for floating effects
  diagnostics.push(...detectFloatingEffects(input.sourceText))

  // Check for missing error tags
  diagnostics.push(...detectMissingErrorTags(input.sourceText))

  // Check for convention violations
  diagnostics.push(...detectConventionViolations(input.sourceText, input.fileName))

  return { additionalDiagnostics: diagnostics }
}

// This function will be called from both:
// 1. The TS language service plugin (Phase 2)
// 2. The standalone LSP server (Phase 3)
// The caller handles the API-specific wrapping.
```

Concrete deliverables:

```
packages/language-service/                      -- new @kitz/language-service package
packages/language-service/src/intelligence/     -- API-independent intelligence
packages/language-service/src/plugin/           -- TS language service plugin wrapper
packages/language-service/src/plugin/index.ts   -- Plugin entry point
packages/language-service/tests/                -- Test fixtures
```

**VSCode Extension (thin wrapper):**

- Wraps the TS language service plugin
- Adds commands for MCP tool invocation
- Status bar indicator
- Tree view for kitz modules

Concrete deliverables:

```
packages/vscode-extension/                  -- new package (published to VSCode marketplace)
packages/vscode-extension/src/extension.ts  -- Extension entry point
packages/vscode-extension/src/commands/     -- Command implementations
packages/vscode-extension/src/views/        -- Tree view providers
packages/vscode-extension/package.json      -- Extension manifest with contributions
```

**Codegen CLI:**

- `kitz generate typeclass` -- generates Tier 3 dispatch tables from registry
- `kitz generate module` -- generates module scaffold (formalizes Claude Code skill)
- `kitz generate tests` -- generates law tests from `@law` JSDoc tags

The CLI should be implemented as a kitz CLI package (`@kitz/cli` or added to the existing `kitz` aggregator package). It uses argc for argument parsing (consistent with the project's CLI conventions):

```bash
# @describe Kitz code generation tool
# @meta version 0.1.0

# @cmd Generate a new module with full scaffolding
# @arg name! <NAME>         Module name
# @option --package <PKG>   Target package (default: core)
# @option --description <DESC> Module description
generate::module() {
  # Delegates to TypeScript codegen implementation
  tsx packages/codegen/src/module.ts "$argc_name" \
    --package "${argc_package:-core}" \
    --description "$argc_description"
}

# @cmd Generate typeclass dispatch tables from registry
# @arg registry! <FILE>     Path to typeclass registry file
# @option --output <DIR>    Output directory for generated files
generate::typeclass() {
  tsx packages/codegen/src/typeclass.ts "$argc_registry" \
    --output "${argc_output:-__generated__}"
}

# @cmd Generate law tests from @law JSDoc tags
# @arg source! <FILE>       Source file containing @law tags
# @option --output <FILE>   Output test file
generate::tests() {
  tsx packages/codegen/src/tests.ts "$argc_source" \
    --output "$argc_output"
}
```

**TRAITOR v2 Tier 3 (codegen-assisted):**

- Define the type witness pattern
- Implement codegen for dispatch tables
- Generate per-type module exports for tree-shaking

This phase is where the three tiers of TRAITOR v2 come together. The codegen reads the Tier 2 instance definitions (which include `@instance` JSDoc tags) and produces the Tier 3 dispatch infrastructure. The Tier 1 type-level traits (from Phase 0) provide compile-time verification that the generated code is correct.

**Duration:** 6-12 weeks
**Dependencies:** Phase 1
**Risk:** Medium (TS plugin API complexity, codegen design iteration)

### Phase 3: Full Tooling (Far)

**Standalone LSP Server:**

- Port intelligence layer from TS plugin to standalone LSP
- Add kitz-specific protocol extensions
- Works with tsgo (TS 7+), VSCode, Zed, Neovim

The migration path from Phase 2 to Phase 3 is straightforward because the intelligence is already API-independent:

```typescript
// Phase 2: TS Plugin wrapper
function create(info: ts.server.PluginCreateInfo) {
  const proxy = Object.create(null)
  for (const k of Object.keys(info.languageService)) {
    proxy[k] = info.languageService[k]
  }

  proxy.getSemanticDiagnostics = (fileName: string) => {
    const original = info.languageService.getSemanticDiagnostics(fileName)
    const sourceText =
      info.languageService.getProgram()?.getSourceFile(fileName)?.getFullText() ?? ''

    // Same intelligence module used in both phases
    const kitzDiags = computeKitzDiagnostics({
      sourceText,
      fileName,
      existingDiagnostics: original.map(toDiagnostic),
    })

    return [...original, ...kitzDiags.additionalDiagnostics.map(toTsDiagnostic)]
  }
  return proxy
}

// Phase 3: Standalone LSP wrapper
connection.onRequest(TextDocumentDiagnosticRequest.type, async (params) => {
  const doc = documents.get(params.textDocument.uri)
  const sourceText = doc?.getText() ?? ''

  // SAME intelligence module
  const kitzDiags = computeKitzDiagnostics({
    sourceText,
    fileName: params.textDocument.uri,
    existingDiagnostics: [], // Get from tsgo via LSP
  })

  return {
    kind: 'full',
    items: kitzDiags.additionalDiagnostics.map(toLspDiagnostic),
  }
})
```

**Rolldown/Vite Plugin:**

- Pure annotation helper
- Import path rewriting (if needed)
- Service dependency manifest generation

Concrete deliverables:

```
packages/vite-plugin/                       -- new @kitz/vite-plugin package
packages/vite-plugin/src/pure.ts            -- Pure annotation transform
packages/vite-plugin/src/imports.ts         -- Import rewriting transform
packages/vite-plugin/src/manifest.ts        -- Service manifest generation
packages/vite-plugin/src/index.ts           -- Plugin entry point
```

**MCP Server (advanced):**

- Tools: `kitz:explain-error`, `kitz:type-at-position`, `kitz:lint-file`
- Resources: `kitz://services`, `kitz://layers`, `kitz://errors`
- Integration with tsgo IPC API (when available)

The advanced MCP server extends Phase 1 with type-aware capabilities. The `kitz:explain-error` tool is the highest-value addition: it translates TypeScript's often-cryptic error messages into kitz-specific explanations with fix suggestions. This alone can save multiple iterations per error.

**Duration:** 8-16 weeks
**Dependencies:** Phase 2, tsgo IPC API (partial)
**Risk:** High (tsgo API timeline uncertainty)

### Phase 4: Horizon

**Zed Extension:**

- Wraps the standalone LSP server
- Slash commands for Zed's AI assistant
- Language configuration

Zed's extension is the thinnest wrapper in the stack. The LSP server does all the heavy lifting. The Zed extension's primary contribution is:

1. Declaring the LSP server as a language server in `extension.toml`
2. Providing Zed-specific slash commands that invoke MCP tools
3. Contributing language configuration (comments, brackets, indentation rules)

**tsgo API Integration:**

- Use tsgo's IPC API for type introspection in MCP server
- Use tsgo's IPC API for type-aware lint rules
- Use tsgo's IPC API for codegen input (type-driven generation)

This phase is contingent on tsgo's IPC API reaching sufficient maturity. The key capabilities needed are:

1. Resolve the type at a given source location (for `kitz:type-at-position` MCP tool)
2. Get diagnostics for a file (for advanced LSP diagnostics)
3. Check if a type satisfies an interface (for type-aware lint rules)
4. Enumerate exports of a module (for codegen input)

If the IPC API provides these four capabilities, the entire tooling constellation levels up. If it doesn't, we continue with the regex-based approach from Phase 1, which covers 80% of use cases.

**OxLint type-aware rules:**

- `@kitz/exhaustive-error-handling`
- `@kitz/layer-completeness`
- `@kitz/service-dependency-cycle`

These are the "killer rules" that provide the most value but require the most infrastructure. Each one catches a category of bugs that are common in Effect code and difficult to diagnose without type information.

**Full Agentic Development Environment:**

The endgame: all tools working in concert.

```
Agent Task: "Implement a user authentication service"

1. MCP kitz:scaffold-service → generates AuthService skeleton
2. MCP kitz://conventions → loads service conventions
3. Agent implements service methods using kitz patterns
4. LSP provides real-time type feedback as agent writes code
5. OxLint validates patterns on save
6. Agent writes tests using typeclass law templates
7. MCP kitz:check-conventions → final convention validation
8. Codegen generates any needed dispatch tables
9. Rolldown plugin optimizes the build
10. Human reviews a single, clean diff

Every step is either automated or agent-assisted.
No manual convention checking. No manual scaffolding.
No "did I follow the barrel file pattern?" questions.
```

**Duration:** Ongoing
**Dependencies:** Phase 3, tsgo stable release
**Risk:** High (depends on external projects)

### Phase Summary Table

| Phase | Duration   | Key Deliverables                            | Packages Created                                        | Risk   |
| ----- | ---------- | ------------------------------------------- | ------------------------------------------------------- | ------ |
| 0     | 2-4 weeks  | JSDoc standards, Tier 1 traits              | 0                                                       | Low    |
| 1     | 4-8 weeks  | MCP server, OxLint plugin, Tier 2           | 2 (@kitz/mcp, @kitz/oxlint-plugin)                      | Medium |
| 2     | 6-12 weeks | LSP plugin, VSCode ext, codegen, Tier 3     | 3 (@kitz/language-service, @kitz/vscode, @kitz/codegen) | Medium |
| 3     | 8-16 weeks | Standalone LSP, Vite plugin, advanced MCP   | 1 (@kitz/vite-plugin)                                   | High   |
| 4     | Ongoing    | Zed ext, tsgo integration, type-aware rules | 1 (@kitz/zed)                                           | High   |

---

## 10. Risk Analysis

### 10.1 tsgo API Uncertainty

**Risk:** tsgo may never expose a public API, or the IPC API may be limited, slow, or unstable.

**Impact:** Phase 3+ tooling (MCP type introspection, type-aware lint rules, type-driven codegen) depends on tsgo's API. Without it, these features are blocked.

**Mitigation:**

- Phase 0-2 tooling has zero dependency on tsgo's API
- Regex-based parsing covers module structure, JSDoc, and conventions
- The standalone LSP can communicate with tsgo's language service via standard LSP (no custom API needed)
- Type-aware lint rules can use `tsgolint` (already in alpha) rather than direct tsgo API
- If the IPC API never materializes, we keep using `typescript` (<=6.0) for API-dependent features alongside tsgo for compilation

**Probability:** Medium. Microsoft acknowledges the need for tooling APIs but has not committed to a timeline.

### 10.2 Effect's Own Evolution

**Risk:** Effect could build all the tooling kitz proposes: MCP server, LSP plugin, lint rules, typeclass system, codegen.

**Impact:** If Effect ships first-party equivalents, kitz's tooling becomes redundant or must integrate with Effect's.

**Mitigation:**

- Effect's primary focus is the runtime (fibers, concurrency, error handling), not the utility layer
- Effect's existing language service plugin is specifically for Effect patterns, not general utility patterns
- Kitz's tooling covers a broader surface (module conventions, data modeling, codegen, not just Effect-specific features)
- If Effect builds tooling, kitz integrates with it rather than competing (kitz already depends on Effect)
- The typeclass system (TRAITOR v2) is a kitz innovation -- Effect uses explicit instances without a formalized system

**Probability:** Low for full overlap. Effect may build specific tools (e.g., better DevTools) but is unlikely to build the full utility-and-conventions ecosystem kitz proposes.

### 10.3 Ecosystem Adoption Chicken-and-Egg

**Risk:** Tooling requires adoption to justify investment, but adoption requires tooling to attract users.

**Impact:** The flywheel doesn't start spinning. Kitz remains a niche library used only by its author.

**Mitigation:**

- The MCP server breaks the cycle: it benefits a single developer using kitz with AI, without requiring broad adoption
- Kitz is already used in production (the kitz monorepo itself uses kitz for development)
- The JSDoc quality initiative and typeclass system add value for existing users before any external adoption
- Claude Code skills (which already exist) serve as a proof of concept for agentic-first development
- The OxLint plugin benefits any Effect user, not just kitz users, broadening the potential audience

**Probability:** Medium. The cold-start problem is real, but the MCP server provides a viable bootstrap path.

### 10.4 Maintenance Burden of the Tooling Constellation

**Risk:** Five tools (MCP, LSP, OxLint, Rolldown, codegen) create a significant maintenance surface that may overwhelm a small team.

**Impact:** Tools become stale, bug fixes are slow, and the quality degrades over time.

**Mitigation:**

- The shared intelligence core means fixing a bug in one tool often fixes it in all tools
- Phase sequencing means tools are added incrementally, not all at once
- Each tool is a separate package with independent release cadence
- The OxLint plugin uses the ESLint-compatible API, which is well-documented and stable
- The MCP SDK and LSP protocol are both stable standards with long-term support
- If maintenance becomes overwhelming, deprioritize the lowest-impact tools (Rolldown plugin, Zed extension) and focus on the highest-impact ones (MCP server, OxLint plugin)

**Probability:** Medium. This is a real risk for a small project. Strict phase sequencing and shared intelligence mitigate it.

### 10.5 TypeScript Language Limitations

**Risk:** TypeScript's type system has hard limits that cannot be worked around: recursion depth limits, no native HKTs, no first-class typeclass support, no dependent types.

**Impact:** Some TRAITOR v2 features hit type system walls. Some type-level computations are impossible regardless of tsgo's speed.

**Mitigation:**

- The three-tier design ensures that limitations in one tier don't block the others. If Tier 1 (type-level) hits a recursion limit, Tier 2 (explicit) is always available.
- tsgo's speed increase means the performance-related limitations (which are not hard limits) are effectively pushed 10x further away.
- The hard limits (1000 tail-recursive depth, ~50 non-tail) are documented and designed around. Kitz's type patterns use tail recursion exclusively.
- If TypeScript adds native HKTs or typeclass support (long shot, but discussed in TypeScript proposals), kitz can adopt them. The current encoding is a stepping stone, not a permanent architecture.

**Probability:** Low for blocking impact. The limitations are known and designed around. High for ergonomic impact -- TypeScript will always be more verbose than Haskell for type-level programming.

### 10.6 Scope Creep: Tooling Distracting from Library Quality

**Risk:** The tooling vision is so ambitious that development effort shifts from improving the core library (packages, types, functions) to building tools. The library stagnates while the tooling grows.

**Impact:** Kitz becomes known as "that library with great tooling but mediocre utilities." The tooling has nothing valuable to enhance because the library itself is thin.

**Mitigation:**

- Phase 0 focuses exclusively on library quality (JSDoc, Tier 1 traits, audit)
- Each phase includes library work alongside tooling work (Tier 2 in Phase 1, Tier 3 in Phase 2)
- The MCP server's value is directly proportional to the library's quality: more well-documented modules = more valuable MCP resources
- The OxLint plugin enforces library quality (JSDoc standards, convention compliance)
- The roadmap can be paused at any phase boundary if the library needs attention

**Decision framework:** When choosing between "build the next tool" and "improve the existing library," ask: "Would the MCP server provide more value if this library improvement were made?" If yes, improve the library first. The tooling multiplies the library's value; it doesn't create value independently.

**Probability:** Medium. This is a common trap for projects with ambitious tooling plans.

### 10.7 Developer Experience Fragmentation

**Risk:** Multiple tools with different installation mechanisms, different configuration formats, and different update cadences create a fragmented developer experience.

**Impact:** Users must configure the OxLint plugin in one place, the TS plugin in tsconfig.json, the MCP server in their AI tool's config, and the Vite plugin in vite.config.ts. Each has its own version, its own bugs, its own release schedule.

**Mitigation:**

- The shared intelligence core means all tools agree on patterns and conventions
- A `@kitz/setup` package could automate configuration for all tools
- Each tool is useful independently -- users only install what they need
- Semantic versioning across all tool packages, with coordinated major releases
- Documentation and MCP prompts guide users through setup

**Probability:** Low. The decoupled package approach (separate packages per tool) is the industry standard. It works for Tailwind, Prisma, and Effect.

### 10.8 The Monorepo Scaling Challenge

**Risk:** With 38 packages already and 7 more proposed in the tooling plan, the monorepo becomes unwieldy. Build times grow. Turbo's task graph becomes complex. Cross-package changes touch many files.

**Impact:** Development velocity decreases. CI takes longer. Contributors need to understand the full monorepo to make changes.

**Mitigation:**

- Turbo's caching means unchanged packages don't rebuild (most changes touch 1-2 packages)
- tsgo's 7-10x speedup applies to each package's build
- Tooling packages are leaf nodes in the dependency graph (they depend on core, but nothing depends on them)
- Each tooling package can be developed in relative isolation
- The `creating-packages` Claude Code skill automates new package scaffolding

**Probability:** Low for blocking impact. The monorepo is already 38 packages and works. Adding 7 more is incremental, not transformative.

---

## 11. The Derivation Chain

This section documents how the conclusions in this vision document were derived from the research. It preserves the reasoning chains so that future work can verify, challenge, or build on them.

### 11.1 TRAITOR v2: From Archaeology to Architecture

The TRAITOR archaeology research (`traitor-archaeology.md`) revealed that TRAITOR v1 was removed for five specific reasons:

1. Runtime dispatch overhead
2. Tree-shaking fundamentally broken
3. ~3,200 lines for three traits (poor value ratio)
4. Global mutable state
5. Three-month stagnation (not being used)

We then asked: "Can a typeclass system avoid ALL FIVE failure modes simultaneously?" The answer came from an unexpected place -- the Display trait that replaced TRAITOR v1. Display was introduced three days after the removal and used a completely different mechanism: declaration merging instead of runtime dispatch.

Cross-referencing Display with the type safety research (`codegen-typesafety.md`, Section 7: Typeclasses), we found that declaration merging is structurally isomorphic to Haskell's instance database. This was the key insight: TypeScript already has a typeclass dispatch mechanism, it's just not called that. We formalized this as Tier 1.

For runtime behavior, the type safety research showed that fp-ts and Effect's explicit-instance-passing approach has perfect tree-shaking and zero dispatch overhead. We adopted this as Tier 2, noting that it was already a proven pattern in the TypeScript ecosystem.

Tier 3 (codegen-assisted dispatch) was derived by combining two findings:

- From the codegen research: build-time template codegen is the only tsgo-safe approach
- From the TRAITOR archaeology: the primary UX complaint about explicit instances is verbosity

The type witness pattern was chosen over alternatives (runtime typeof, compiler plugins, branded witnesses) by evaluating each against the non-negotiable constraints (tree-shaking, tsgo-safe, no runtime dispatch). Only type witnesses satisfied all three.

### 11.2 Tooling Constellation: From Landscape Survey to Strategy

The tooling research (`tooling-ecosystem.md`) surveyed six types of tools across eight prior art examples. The strategic sequencing came from cross-referencing feasibility (can we build this now?), impact (how much value does it provide?), and dependency (does this require tsgo's API?).

The MCP server was prioritized first because:

1. The research found no existing "Effect type explorer" MCP -- greenfield opportunity
2. The TypeScript MCP SDK is stable and straightforward
3. It directly serves the agentic-first audience (kitz's primary differentiator)
4. It has no dependency on the tsgo API

The OxLint plugin was prioritized alongside because:

1. The JS plugin API is stable (since October 2025)
2. Pattern-based rules need no type information
3. Dual ESLint/OxLint compatibility is trivial via `createOnce`
4. It provides immediate value in CI

The TS language service plugin was sequenced after because:

1. It depends on the Strada API, which is dead in tsgo
2. But tsgo won't be stable until mid-late 2026
3. So there's a window where the plugin provides value
4. The intelligence layer can be architected for portability to a standalone LSP

The Tailwind model (LSP as core, everything else as wrapper) was chosen because:

1. Tailwind's tooling is the acknowledged gold standard
2. The architecture survived Tailwind's growth from utility to framework
3. It naturally handles the tsgo transition (standalone LSP speaks standard LSP, which tsgo also speaks)
4. Prisma and Volar confirm the same pattern works across different domains

### 11.3 Code Generation: From Landscape to Recommendation

The codegen research evaluated five strategies against three constraints (tsgo-safe, tree-shake-safe, immediately feasible):

| Strategy              | tsgo-safe | Tree-shake-safe | Feasible | Recommended?       |
| --------------------- | --------- | --------------- | -------- | ------------------ |
| Build-time templates  | Yes       | Yes             | Yes      | PRIMARY            |
| Macro transforms      | No        | Varies          | No       | Avoid              |
| Type-driven codegen   | Partial   | Yes             | Medium   | Schema-first only  |
| Template literal DSLs | Yes       | Yes             | Yes      | Type-level only    |
| IDE-time codegen      | No        | N/A             | No       | Use agents instead |

Only build-time template codegen satisfied all three constraints. The recommendation was then cross-referenced with the typeclass design to identify what should be generated (Tier 3 dispatch tables, law tests, module scaffolds).

The critical finding was that IDE-time codegen (TS language service plugins that generate code) is blocked by the tsgo API gap. But Claude Code skills (which kitz already has) serve the same purpose without depending on any compiler API. This is a concrete example of the agentic-first advantage: features that would require compiler integration in a traditional library can be achieved through AI assistance in kitz.

### 11.4 JSDoc: From Documentation to Infrastructure

The JSDoc research started from a simple observation: Effect's JSDoc is excellent, and AI agents perform noticeably better when working with Effect code than with poorly-documented code. Cross-referencing with the MCP server design revealed that JSDoc is the lowest-cost, highest-impact metadata source for the entire tooling constellation.

The custom tags (`@pure`, `@complexity`, `@law`, `@typeclass`, `@instance`) were derived by asking: "What metadata would each tool in the constellation need?" The MCP server needs to know which functions are pure (for safe invocation). The Rolldown plugin needs to know which calls are pure (for `/*#__PURE__*/` annotations). The codegen needs to know which interfaces are typeclasses (for generating dispatch tables). The test generator needs to know which laws to verify.

Rather than inventing a separate metadata format for each tool, we unified on JSDoc because:

1. It's already attached to every function
2. It's already displayed in editor hovers
3. It's already consumed by TypeDoc
4. It's already familiar to TypeScript developers
5. Custom tags are trivially parseable with regex

The doc-vitest integration was derived from the observation that kitz's `@example` blocks are currently unverified. Cross-referencing with the agentic-first thesis: if AI agents learn API usage from examples, and examples are wrong, the agent generates wrong code. doc-vitest closes this loop by making examples into tests.

### 11.5 Type Safety: From Research to Budget

The type safety research produced two key numbers: tsgo is 7-10x faster than tsc, and TypeScript's hard limits (recursion depth, instantiation depth) are unchanged. The implication is that the "budget" for type-level computation increases in throughput but not in depth.

Cross-referencing with kitz's existing patterns (HKT composition, optic lensing, Display trait resolution), we found that kitz's current type patterns are already depth-efficient (using tail recursion, named types, interfaces over intersections). The tsgo speedup means these patterns will feel faster in editors without any code changes.

The more interesting finding was in the typeclass design: the Display trait's handler resolution involves iterating over all registered handlers (via `Handlers<$Type>[keyof Handlers<$Type>]`). As more handlers are registered, this becomes O(n) in the number of handlers. In tsc, this was slow for large n. In tsgo, it's 10x faster, which means Display can support significantly more handlers without degrading editor performance.

This directly informs the TRAITOR v2 Tier 1 design: having hundreds of handlers in the global namespace is viable because tsgo can evaluate them fast enough for real-time editor feedback.

### 11.6 Agentic-First: From Observation to Strategy

The agentic-first thesis was not derived from a single research document. It emerged from the intersection of three findings:

1. **From the tooling research:** The highest-impact tool is the MCP server, which serves AI agents directly.
2. **From the JSDoc research:** AI agents are the primary consumers of function documentation (they read JSDoc more often than humans do).
3. **From the codegen research:** IDE-time codegen is blocked, but agent-time codegen (via MCP tools) is immediately feasible.

The common thread: in every domain (tooling, documentation, code generation), the path of highest impact and lowest friction passes through AI agents. This is not because humans are unimportant, but because the same properties that serve agents (predictability, metadata, conventions) also serve humans.

The flywheel model (tooling -> AI assistance -> adoption -> tooling) was derived from observing Tailwind's growth trajectory: Tailwind's IntelliSense LSP drove adoption, which drove more investment in the LSP, which drove more adoption. Kitz's MCP server is the equivalent of Tailwind's LSP -- the tool that breaks the cold-start problem.

### 11.7 The Three-Tier Design: Why Not Two? Why Not Four?

We considered several alternative structures for TRAITOR v2:

**Two tiers (type-level + explicit):** This was the initial proposal. Tier 1 for compile-time, Tier 2 for runtime. The problem: Tier 2's verbosity is a genuine barrier to adoption. `sort(numberOrd)([3, 1, 2])` is fine in a library's internals, but for application code, it's friction that pushes users away from polymorphism entirely. Without Tier 3, most users would just write `[3, 1, 2].sort((a, b) => a - b)` and lose the type safety.

**Four tiers (add implicit resolution):** We considered adding a tier with TypeScript declaration-merging-based instance resolution -- not just for type-level computation (Tier 1) but for runtime dispatch. The idea: register instances in a global interface, then use codegen to read the interface and produce dispatch code. The problem: this conflates two separate mechanisms (compile-time type-level dispatch and build-time codegen) in a way that's hard to explain and debug. Three tiers, each with a clear mechanism, is more pedagogically sound.

**One tier (codegen only):** We considered a design where all typeclass dispatch goes through codegen-produced lookup tables. The problem: this makes the system entirely dependent on a build step. You can't experiment with a new typeclass in a REPL or a test file without running the codegen first. Tier 1 (pure type-level) and Tier 2 (plain objects) work without any build step.

The three-tier design was chosen because each tier serves a distinct need:

- Tier 1: "I want type-level dispatch with zero cost" (Display, TypeName, Serializable)
- Tier 2: "I want runtime behavior with explicit control" (Eq, Ord, Show, Monoid)
- Tier 3: "I want ergonomic dispatch without explicit instance passing" (generated lookup)

No tier is a subset of another. No tier can be removed without losing capability.

### 11.8 The Kitz Monorepo as a Test Bed

An important aspect of the derivation: kitz itself is the first and most demanding user of its own tools. The 38-package monorepo with 16 packages in `@kitz/core`'s domain modules (arr, str, num, obj, etc.) provides a realistic test environment for every proposed feature:

- The Display trait has real handlers in real domain modules
- The HKT system is used in real optic lenses and kind compositions
- The module conventions (\_.ts, \_\_.ts) are followed by all 38 packages
- The JSDoc patterns are already partially established
- The Claude Code skills already automate module creation and service scaffolding

This means every feature in this vision document can be validated against a real, non-trivial codebase before being recommended for external use. The TRAITOR v1 failure mode of "built infrastructure without users" is avoided because kitz IS the user.

### 11.9 Why MCP Over Custom AI Integration

We considered several approaches for AI agent integration:

1. **Claude Code skills only:** Already exist, already work. But skills are specific to Claude Code and not portable to Cursor, Windsurf, Zed's AI, or other agents.

2. **Custom VSCode extension with AI features:** Possible but ties AI features to VSCode. Zed and Neovim users get nothing.

3. **MCP server:** Protocol-agnostic, works with Claude Code, Cursor, Zed, and any future MCP-compatible tool. The MCP standard is backed by Anthropic and adopted by OpenAI, making it the de facto standard for 2026.

4. **Direct LLM API integration:** Build a kitz-specific AI service that calls LLM APIs directly. Too narrow (only works with one provider) and too complex (must handle auth, rate limiting, streaming, etc.).

MCP was chosen because it's the only option that is simultaneously: protocol-standard (not tied to one AI tool), portable (works everywhere), and immediately implementable (stable SDK). The Claude Code skills remain as a complementary layer for Claude-Code-specific workflows, but the MCP server is the primary agentic integration point.

### 11.10 The Role of Effect in Tooling Implementation

A recurring decision in the tooling design was whether to implement tools using Effect internally. We decided yes, for three reasons:

1. **Dogfooding.** If kitz's MCP server uses Effect for structured concurrency, error handling, and dependency injection, it validates that these patterns work in a real tool. Any rough edges discovered during implementation feed back into library improvements.

2. **Natural fit.** An MCP server needs: concurrent request handling (Effect fibers), structured errors (Effect error channels), dependency injection (Effect services for file system, TypeScript analysis, etc.), and resource management (Effect scoped resources for file watchers). Effect is the right tool.

3. **Demonstration.** The MCP server's own codebase becomes a reference implementation of "how to build a real application with kitz + Effect." Users who read the source (and they will, because it's open source) learn patterns by example.

The exception is the OxLint plugin, which must be plain JavaScript (the OxLint plugin API doesn't support Effect). This is fine -- the plugin's rule implementations are simple enough that they don't benefit from Effect's abstractions.

---

## Appendix A: Glossary

| Term                    | Definition                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| **Agentic-first**       | Design philosophy prioritizing AI agent usability alongside human usability                      |
| **Branded type**        | A type intersected with a phantom brand for nominal typing (zero runtime cost)                   |
| **Declaration merging** | TypeScript feature where multiple declarations of the same interface are merged into one         |
| **HKT**                 | Higher-Kinded Type: a type that takes a type constructor as a parameter (e.g., `Functor<Array>`) |
| **Instance**            | A concrete implementation of a typeclass for a specific type (e.g., `Eq<string>`)                |
| **Kind**                | Kitz's type-level function interface, applied via intersection-based HKT encoding                |
| **MCP**                 | Model Context Protocol: standard for AI agent tool integration                                   |
| **Tier 1**              | Type-level-only typeclass (zero runtime, declaration merging dispatch)                           |
| **Tier 2**              | Explicit-instance-passing typeclass (no dispatch overhead, tree-shakeable)                       |
| **Tier 3**              | Codegen-assisted typeclass (type witnesses, static lookup tables)                                |
| **TRAITOR v1**          | The removed runtime typeclass system (June-November 2025)                                        |
| **TRAITOR v2**          | The proposed compile-time typeclass system (this document)                                       |
| **tsgo**                | TypeScript 7's Go-based compiler (7-10x faster than tsc)                                         |
| **Type witness**        | A small value that names a type for Tier 3 dispatch                                              |

## Appendix B: File References

Key files in the kitz codebase referenced by this document:

| File                                     | Relevance                                         |
| ---------------------------------------- | ------------------------------------------------- |
| `packages/core/src/fn/kind.ts`           | HKT encoding (Apply, Pipe, PipeRight)             |
| `packages/core/src/ts/traits/display.ts` | Display trait (Tier 1 proof of concept)           |
| `packages/core/src/arr/arr.ts`           | Arr module (module conventions, Display handler)  |
| `packages/core/package.json`             | Package structure (sideEffects, exports, imports) |
| `.claude/CLAUDE.md`                      | Project conventions                               |
| `CONTRIBUTING.md`                        | Architecture overview, skills reference           |

## Appendix C: Research Document Cross-Reference

| Research Finding                 | Source Document                             | Vision Section         |
| -------------------------------- | ------------------------------------------- | ---------------------- |
| TRAITOR v1 removed for 5 reasons | traitor-archaeology.md, Section 7           | Section 3 (TRAITOR v2) |
| Display trait as successor       | traitor-archaeology.md, Section 6 (Phase 7) | Section 3.1            |
| HKT encoding via intersection    | codegen-typesafety.md, Section 3a           | Section 3.2            |
| tsgo API uncertain               | codegen-typesafety.md, Section 1            | Section 10.1           |
| Build-time codegen is tsgo-safe  | codegen-typesafety.md, Section 2a           | Section 5              |
| Tailwind LSP as gold standard    | tooling-ecosystem.md, Section 6             | Section 4.1            |
| MCP greenfield opportunity       | tooling-ecosystem.md, Section 3             | Section 4.2            |
| OxLint JS plugins stable         | tooling-ecosystem.md, Section 5             | Section 4.3            |
| tsgo breaks Strada API           | tooling-ecosystem.md, Section 2             | Section 4.4            |
| doc-vitest for examples          | codegen-typesafety.md, Section 5            | Section 6.3            |
| Variance annotations             | codegen-typesafety.md, Section 3f           | Section 7.2            |
| Branded types via Effect         | codegen-typesafety.md, Section 3c           | Section 7.2            |
| Tail-recursive depth: 1000       | codegen-typesafety.md, Section 3d           | Section 7.1            |
| fp-ts explicit instance passing  | traitor-archaeology.md, Section 8.4         | Section 3.3 (Tier 2)   |
| Effect language service pattern  | tooling-ecosystem.md, Section 6             | Section 4.4            |

## Appendix D: TRAITOR v2 Design Alternatives Explored

This appendix documents the alternative designs considered for each TRAITOR v2 tier, including why they were rejected. This serves as a decision log for future revisitation.

### D.1 Tier 1 Alternatives

**Alternative 1: Module augmentation instead of global namespace**

```typescript
// Instead of:
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> { ... }
  }
}

// We considered:
declare module '@kitz/core/traits/display' {
  interface Handlers<$Type> { ... }
}
```

Rejected because module augmentation requires the consumer to have `@kitz/core` in their dependencies and the augmented module to exist as a real module with a real path. Global namespace declaration merging works regardless of module resolution and doesn't require the trait module to be importable.

**Alternative 2: Conditional type registry (no interface merging)**

```typescript
// Instead of interface Handlers<$Type>, use a central conditional type:
type Display<$Type> =
  $Type extends string ? 'string'
  : $Type extends number ? 'number'
  : $Type extends readonly (infer E)[] ? `${Display<E>}[]`
  : ... // exhaustive list

// Extension via wrapper types:
type MyDisplay<$Type> =
  $Type extends MyCustomType ? 'MyCustomType'
  : Display<$Type>
```

Rejected because this requires users to wrap every usage of Display with their own type, defeating the purpose of a central trait. The declaration merging approach allows handlers to be registered without any wrapping.

**Alternative 3: Indexed access on a type map**

```typescript
// A single type map instead of per-trait namespaces:
interface KitzTraitMap {
  Display: {
    Array: <T>(type: T) => T extends (infer E)[] ? `${string}[]` : never
    // ...
  }
  TypeName: { ... }
  Serializable: { ... }
}

// Dispatch via indexed access:
type Dispatch<Trait extends keyof KitzTraitMap, Type> =
  KitzTraitMap[Trait][keyof KitzTraitMap[Trait]] // ... complex resolution
```

Rejected because the type-level function encoding inside an interface property is significantly more complex than the conditional-type-returning-never pattern used in the current approach. The current design is simpler and more performant.

### D.2 Tier 2 Alternatives

**Alternative 1: Class-based instances**

```typescript
// Instead of plain objects:
class StringEq implements Eq<string> {
  equals(self: string, that: string): boolean {
    return self === that
  }
}

const stringEq = new StringEq()
```

Rejected because class instances carry prototype overhead and are less tree-shakeable than plain objects. The `StringEq` class definition must be included even if only `stringEq.equals` is used. With plain objects, the bundler can inline the `equals` function directly.

**Alternative 2: Function-based instances (no objects)**

```typescript
// Instead of:
const stringEq: Eq<string> = { equals: (a, b) => a === b }

// Use individual functions:
const stringEquals = (a: string, b: string): boolean => a === b
const numberEquals = (a: number, b: number): boolean => a === b

// Polymorphic functions take individual functions:
const nub = <A>(equals: (a: A, b: A) => boolean) =>
  (self: ReadonlyArray<A>) => ...
```

Rejected because this loses the grouping that makes typeclasses valuable. `Ord<A>` extends `Eq<A>`, meaning an `Ord` instance includes both `compare` and `equals`. With individual functions, this relationship is implicit and must be manually maintained. The object-based approach makes the typeclass hierarchy explicit in the type system.

**Alternative 3: Symbol-keyed instances (for encapsulation)**

```typescript
// Use symbols instead of string keys:
const EQ_EQUALS = Symbol('Eq.equals')

interface Eq<A> {
  readonly [EQ_EQUALS]: (self: A, that: A) => boolean
}
```

Rejected because symbol keys make instances harder to create (you need the symbol imported) and harder to debug (symbols don't show up clearly in console.log). The standard string-keyed interface is more ergonomic and sufficient for the use case.

### D.3 Tier 3 Alternatives

**Alternative 1: Runtime typeof-based dispatch (TRAITOR v1 style)**

```typescript
function eqFor<A>(value: A): Eq<A> {
  switch (typeof value) {
    case 'string':
      return stringEq as Eq<A>
    case 'number':
      return numberEq as Eq<A>
    // ...
  }
}
```

Rejected for two reasons: (1) `typeof` cannot distinguish `string[]` from `number[]` (both are "object"), so parameterized types are impossible. (2) The function must import ALL instances to include them in the switch, defeating tree-shaking.

**Alternative 2: TypeScript compiler plugin (compile-time resolution)**

```typescript
// User writes:
sort<number>([3, 1, 2])

// Compiler plugin transforms to:
sort(numberOrd)([3, 1, 2])
```

Rejected because the tsgo API doesn't support plugins and may never support them. This approach is permanently blocked by the non-negotiable tsgo constraint.

**Alternative 3: Proxy-based lazy dispatch (TRAITOR v1 style)**

```typescript
const TC = new Proxy(
  {},
  {
    get(_, trait: string) {
      return new Proxy(
        {},
        {
          get(_, method: string) {
            return (...args: any[]) => {
              const domain = detectDomain(args[0])
              return registry[trait][domain][method](...args)
            }
          },
        },
      )
    },
  },
)

TC.Eq.equals(a, b) // Runtime dispatch via proxy
```

Rejected because: (1) Every call goes through two proxy hops. (2) The registry must be populated via side effects. (3) Tree-shaking is impossible (the registry pulls in everything). (4) The types cannot express what the proxy does without extensive unsafe casts. This is TRAITOR v1's approach and the reason it was removed.

**Alternative 4: Tagged union witnesses (richer than type witnesses)**

```typescript
type TypeWitness<A> =
  | { tag: 'string'; _phantom: A }
  | { tag: 'number'; _phantom: A }
  | { tag: 'Array'; inner: TypeWitness<unknown>; _phantom: A }
  | {
      tag: 'Record'
      key: TypeWitness<unknown>
      value: TypeWitness<unknown>
      _phantom: A
    }

// Usage:
const string_: TypeWitness<string> = {
  tag: 'string',
  _phantom: undefined as any,
}
```

This was the initial design for type witnesses. We simplified to the current interface-based design because the phantom type field is unnecessary (the type parameter A already captures the type) and the tagged union encoding adds noise. The simpler `{ tag: string, inner?: TypeWitness<unknown> }` is sufficient.

**Alternative 5: No Tier 3 (rely on AI agents for verbosity)**

The most radical alternative: don't build Tier 3 at all. Instead, rely on AI agents to automatically insert Tier 2 instances when scaffolding code. The MCP server's `kitz:scaffold-service` tool would include the correct Eq/Ord/etc. instances in the generated code.

This is actually a viable approach and may end up being the pragmatic choice if Tier 3's complexity doesn't justify its ergonomic benefit. The advantage: simpler system, no codegen step, no type witnesses to learn. The disadvantage: non-agent-assisted development remains verbose.

We include Tier 3 in the vision because the vision is pie-in-the-sky, but the roadmap places it in Phase 2, giving time to evaluate whether the agentic alternative (Tier 2 + agent insertion) is sufficient in practice.

## Appendix E: Kitz Module Convention Reference

This appendix documents the module conventions that the tooling constellation must understand and enforce. These conventions are the "protocol" that enables agent-assisted development.

### E.1 File Structure Convention

Every kitz module follows this structure:

```
packages/{package}/src/{module}/
  _.ts              -- Internal barrel (package-scoped imports)
  __.ts             -- Public barrel (external consumers)
  {module}.ts       -- Primary implementation
  {feature}.ts      -- Additional implementation files
  {module}.test.ts  -- Unit tests
  {module}.test-d.ts -- Type-level tests
```

The `_.ts` file re-exports everything from the implementation files:

```typescript
// _.ts
export * from './feature.js'
export * from './module.js'
```

The `__.ts` file re-exports the internal barrel as a namespace:

```typescript
// __.ts
export * as ModuleName from './_.js'
```

### E.2 Package.json Convention

Each package declares:

```json
{
  "type": "module",
  "sideEffects": false,
  "imports": {
    "#module": "./build/module/_.js",
    "#module/*": "./build/module/*.js"
  },
  "exports": {
    ".": "./build/index.js",
    "./module": "./build/module/__.js"
  }
}
```

### E.3 Naming Conventions

| Entity              | Convention          | Example                     |
| ------------------- | ------------------- | --------------------------- |
| Package             | `@kitz/lowercase`   | `@kitz/core`, `@kitz/fs`    |
| Module namespace    | PascalCase          | `Arr`, `Str`, `Obj`         |
| Type alias          | PascalCase          | `NonEmpty`, `Unknown`       |
| Value (function)    | camelCase           | `filter`, `map`, `is`       |
| Value (constant)    | camelCase           | `empty`, `zero`             |
| Curried variant     | camelCase + suffix  | `filterWith`, `mapOn`       |
| Internal type param | `$PascalCase`       | `$Type`, `$Kind`, `$Args`   |
| File                | lowercase + hyphens | `map-entries.ts`, `kind.ts` |
| Test file           | `*.test.ts`         | `arr.test.ts`               |
| Type test file      | `*.test-d.ts`       | `kind.test-d.ts`            |

### E.4 JSDoc Convention (Summary)

Required tags for all public exports:

- Summary line (first non-empty, non-tag line)
- `@param` for each parameter
- `@returns`
- `@example` with runnable code
- `@since` version tag
- `@category` for grouping

Optional structured tags:

- `@pure` (boolean presence tag)
- `@complexity` (e.g., "O(n)", "O(n log n)")
- `@law` (algebraic law expression)
- `@typeclass` (marks interface as typeclass)
- `@instance` (marks value as typeclass instance)
- `@see` with `{@link}` for cross-references

## Appendix F: The 38-Package Monorepo Map

For reference, here is the complete list of packages in the kitz monorepo as of 2026-02-28, organized by domain:

**Core foundation:**

- `@kitz/core` -- Data structures, type utilities, optics, HKTs

**Schema and validation:**

- `@kitz/sch` -- Schema utilities built on Effect Schema

**Testing and assertion:**

- `@kitz/test` -- Test utilities and helpers
- `@kitz/assert` -- Assertion library

**CLI and output:**

- `@kitz/cli` -- CLI framework
- `@kitz/log` -- Structured logging
- `@kitz/color` -- Terminal color utilities
- `@kitz/tex` -- Text formatting
- `@kitz/tree` -- Tree rendering

**Build and packaging:**

- `@kitz/bldr` -- Build utilities
- `@kitz/paka` -- Package analysis
- `@kitz/pkg` -- Package.json utilities
- `@kitz/mod` -- Module utilities

**Configuration:**

- `@kitz/conf` -- Configuration management
- `@kitz/env` -- Environment variable handling

**Data formats:**

- `@kitz/json` -- JSON utilities
- `@kitz/jsonc` -- JSONC (JSON with comments) utilities
- `@kitz/html` -- HTML utilities
- `@kitz/url` -- URL utilities

**IO and network:**

- `@kitz/fs` -- File system operations
- `@kitz/http` -- HTTP utilities
- `@kitz/resource` -- Resource management

**VCS and platforms:**

- `@kitz/git` -- Git operations
- `@kitz/github` -- GitHub API
- `@kitz/npm-registry` -- npm registry API

**Domain-specific:**

- `@kitz/conventional-commits` -- Conventional commits parsing
- `@kitz/semver` -- Semantic versioning
- `@kitz/name` -- Name/identifier utilities
- `@kitz/monorepo` -- Monorepo utilities
- `@kitz/release` -- Release management
- `@kitz/flo` -- Flow/pipeline utilities
- `@kitz/syn` -- Syntax utilities
- `@kitz/oak` -- Tree/AST utilities
- `@kitz/idx` -- Indexing utilities
- `@kitz/num` -- Numeric utilities (separate from core Num)
- `@kitz/group` -- Grouping utilities
- `@kitz/ware` -- Middleware utilities

**Aggregator:**

- `kitz` -- Aggregates all packages

This map shows the breadth of kitz's scope. The tooling constellation must serve all 38 packages, not just `@kitz/core`. The MCP server's package resources, the OxLint plugin's convention rules, and the LSP's completions all need to work across the entire monorepo.

---

_End of Kitz Vision Document_
_Total research consumed: 2,432 lines across 3 documents_
_Codebase files referenced: 6 key files_
_Code examples: 60+ TypeScript snippets demonstrating proposed designs_
