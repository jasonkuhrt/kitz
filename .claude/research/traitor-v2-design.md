# TRAITOR v2: A Compile-Time Typeclass System for TypeScript

> Technical Design Document
> Author: Claude (research session)
> Date: 2026-02-28
> Status: Proposal
> Context: kitz monorepo, TypeScript on tsgo, Effect-based, pre-1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Analysis: Display Trait (The Spiritual Successor)](#2-analysis-display-trait)
3. [Analysis: Kitz HKT System](#3-analysis-kitz-hkt-system)
4. [Prior Art Survey](#4-prior-art-survey)
5. [TRAITOR v2 Architecture](#5-traitor-v2-architecture)
6. [Tier 1: Type-Level Only (Zero Runtime)](#6-tier-1-type-level-only)
7. [Tier 2: Explicit Instance Passing (Perfect Tree-Shaking)](#7-tier-2-explicit-instance-passing)
8. [Tier 3: Codegen-Assisted (Zero Verbosity, Perfect Tree-Shaking)](#8-tier-3-codegen-assisted)
9. [Hard Problems](#9-hard-problems)
10. [Comparison Matrix](#10-comparison-matrix)
11. [Recommended Path Forward](#11-recommended-path-forward)
12. [Appendices](#appendices)

---

## 1. Executive Summary

TRAITOR v1 was a runtime typeclass system that was removed after five months because runtime dispatch, global mutable state, and broken tree-shaking contradicted kitz's core value proposition. The Display trait that replaced it proved that type-level-only extensibility via declaration merging is viable and lightweight.

TRAITOR v2 proposes a three-tier system that learns from v1's mistakes:

- **Tier 1** extends the Display pattern into a general-purpose type-level typeclass framework. Zero runtime. Zero bytes. Pure compile-time dispatch via declaration merging and conditional types.
- **Tier 2** provides runtime typeclasses using explicit instance passing (Effect/fp-ts style). Perfect tree-shaking. Instances are module-level constants, never global state.
- **Tier 3** adds optional build-time codegen that reads Tier 1 registries and generates Tier 2 dispatch tables, achieving zero-verbosity usage with perfect tree-shaking.

The key insight: these tiers compose. Tier 1 is always present. Tier 2 is opt-in per typeclass. Tier 3 is a build tool that bridges the two. Users never choose a tier -- they use what the typeclass author provides.

---

## 2. Analysis: Display Trait

### 2.1 What Exists Today

The Display trait lives at `packages/core/src/ts/traits/display.ts`. It converts TypeScript types to human-readable string representations at the type level.

**Core mechanism:**

```typescript
// The global registry -- an interface that can be augmented via declaration merging
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      // Empty by default -- filled by domain modules
    }
  }
}

// The dispatch type -- checks handlers after built-in primitives
export type Display<$Type, $Fallback extends string | undefined = undefined> =
  // ... primitive cases (any, unknown, never, boolean, string, number, etc.) ...
  // Check registered Handlers
  : [HandlersResult<$Type>] extends [never]
    ? $Type extends object ? 'object' : '?'
    : HandlersResult<$Type>

// Handler result extraction
type HandlersResult<$Type> =
  [keyof KITZ.Traits.Display.Handlers<$Type>] extends [never]
    ? never
    : KITZ.Traits.Display.Handlers<$Type>[keyof KITZ.Traits.Display.Handlers<$Type>]
```

**Instance registration** happens via declaration merging in domain modules:

```typescript
// In packages/core/src/arr/arr.ts
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      _array: $Type extends (infer E)[] ? `Array<${Display<E>}>` : never
      _readonlyArray: $Type extends readonly (infer E)[]
        ? $Type extends (infer _)[] ? never
        : `ReadonlyArray<${Display<E>}>`
        : never
    }
  }
}

// In packages/core/src/prom/prom.ts
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      _promise: $Type extends Promise<infer V> ? `Promise<${Display<V>}>`
        : never
    }
  }
}

// In packages/core/src/fn/fn.ts
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      _function: $Type extends Function ? 'Function' : never
    }
  }
}
```

**Third-party extensibility** works via the same pattern:

```typescript
// In any consuming project
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      Effect: $Type extends Effect.Effect<infer A, infer E, infer R>
        ? `Effect<${Ts.Display<A>}, ${Ts.Display<E>}, ${Ts.Display<R>}>`
        : never
    }
  }
}
```

### 2.2 What Works

1. **Zero runtime cost.** The entire trait is erased at compile time. No Proxy, no registry, no dispatch overhead.

2. **Perfect tree-shaking.** Since there is no runtime component, there is nothing to shake. The trait is invisible to bundlers.

3. **Decentralized registration.** Each domain module registers its own handler in the same file where its types live. No separate registration step, no import ordering concerns.

4. **Third-party extensibility.** Any consuming project can add handlers via declaration merging. The `KITZ.Traits.Display` namespace is global and open.

5. **Proven pattern.** The same mechanism is used for `KITZ.Simplify.Traversables`, `KITZ.Ts.PreserveTypes`, and `KITZ.Perf.Settings` -- four independent uses of the same extensibility pattern.

### 2.3 What's Limited

1. **Type-level only.** Display can only produce type-level strings. It cannot produce runtime values. If you want to actually format a value at runtime, you need a separate runtime function.

2. **No coherence checking.** If two handlers match the same type, both entries appear in the union. The `HandlersResult` type unions all matching handler outputs. There is no mechanism to detect or prevent overlapping instances.

3. **No superclass relationships.** Display has no notion of "this typeclass requires that typeclass." Each handler is independent.

4. **No higher-kinded dispatch.** The handler pattern dispatches on concrete types (`$Type extends Array<infer E>`), not on type constructors. There is no way to say "Array is a Display-able container" abstractly.

5. **No default methods.** Each handler must provide its full implementation. There is no mechanism for a handler to delegate to another handler or to use a default.

6. **Handler naming is by convention.** Handler keys like `_array`, `_promise`, `_function` use an underscore prefix by convention. There is no enforcement.

---

## 3. Analysis: Kitz HKT System

### 3.1 The Kind Module

Kitz's HKT system lives at `packages/core/src/fn/kind.ts`. It provides two parallel encoding schemes:

**Public Kinds (string-keyed):**

```typescript
// Base interface
export interface Kind<$Params = unknown, $Return = unknown> {
  parameters: $Params
  return: $Return
}

// Application -- the core mechanism
export type Apply<$Kind, $Args> = ($Kind & { parameters: $Args })['return']

// Example usage
interface ArrayOf extends Kind {
  return: Array<this['parameters'][0]>
}
type StringArray = Kind.Apply<ArrayOf, [string]> // string[]
```

**Private Kinds (symbol-keyed, for encapsulation):**

```typescript
export const PrivateKindReturn = Symbol()
export const PrivateKindParameters = Symbol()

export interface Private {
  [PrivateKindReturn]: unknown
  [PrivateKindParameters]: unknown
}

export type PrivateApply<$Kind extends Private, $Args> =
  ($Kind & { [PrivateKindParameters]: $Args })[PrivateKindReturn]
```

**Kind composition:**

```typescript
// Left-to-right sequential application
export type Pipe<$Kinds extends readonly Kind[], $Input> = $Kinds extends
  readonly [infer F extends Kind, ...infer R extends readonly Kind[]]
  ? Pipe<R, Apply<F, [$Input]>>
  : $Input

// Short-circuiting composition with Either
export type PipeRight<$Input, $Kinds extends readonly Kind[]> = $Kinds extends
  readonly [infer F extends Kind, ...infer R extends readonly Kind[]]
  ? Apply<F, [$Input]> extends infer Result
    ? Result extends Either.Left<infer E, infer _> ? Either.Left<E, never>
    : Result extends Either.Right<infer _, infer V> ? PipeRight<V, R>
    : never
  : never
  : Either.Right<never, $Input>
```

### 3.2 HKT Assessment for Typeclasses

The current Kind system provides the foundational pieces:

| Capability                        | Status  | Notes                                        |
| --------------------------------- | ------- | -------------------------------------------- |
| Type-level function definition    | Done    | `interface Foo extends Kind { return: ... }` |
| Single-parameter application      | Done    | `Apply<F, [A]>`                              |
| Multi-parameter application       | Done    | `Apply<F, [A, B, C]>` via tuple              |
| Composition                       | Done    | `Pipe`, `PipeRight`                          |
| Private/encapsulated kinds        | Done    | Symbol-keyed variant                         |
| Multi-parameter type constructors | Partial | Works via tuple but no named positions       |

**What's needed for typeclasses:**

1. **Named parameter positions.** Effect uses `Kind<F, R, O, E, A>` with named slots. Kitz uses `Apply<F, [A]>` with positional tuples. For typeclasses like `Bifunctor` that need to distinguish which parameter varies, named positions are clearer.

2. **Type constructor registration.** A way to say "Array is a type constructor of kind `* -> *`" so that `Kind<ArrayHKT, string>` produces `Array<string>`. This is the `TypeLambda` pattern from Effect.

3. **Constraint propagation.** A way to express `F extends HKT` such that `Kind<F, A>` is always valid. The current system allows any type as `$Kind` in `Apply`.

### 3.3 Proposed HKT Extension

The kitz `Kind` system needs a small extension to support typeclasses:

```typescript
// TypeLambda -- a type constructor that maps type arguments to a concrete type
// This is kitz's version of Effect's TypeLambda
export interface TypeLambda {
  readonly In: unknown // contravariant input (R in Effect)
  readonly Out2: unknown // covariant output slot 2 (E in Effect)
  readonly Out1: unknown // covariant output slot 1 (A in Effect)
  readonly Target: unknown // the concrete type
}

// Kind application for TypeLambdas
export type KindOf<F extends TypeLambda, In, Out2, Out1> =
  (F & { readonly In: In; readonly Out2: Out2; readonly Out1: Out1 })['Target']
```

This is a thin layer over the existing `Apply` pattern -- same intersection trick, just with named fields instead of positional tuples.

---

## 4. Prior Art Survey

### 4.1 Haskell Type Classes

The gold standard. Key properties:

```haskell
-- Definition
class Eq a where
  (==) :: a -> a -> Bool
  (/=) :: a -> a -> Bool
  x /= y = not (x == y)  -- default method

-- Instance
instance Eq Int where
  x == y = eqInt x y

-- Superclass
class Eq a => Ord a where
  compare :: a -> a -> Ordering

-- Higher-kinded
class Functor f where
  fmap :: (a -> b) -> f a -> f b

-- Derivation
data Color = Red | Green | Blue
  deriving (Eq, Ord, Show)
```

**Strengths:** Compile-time resolution, coherence (one instance per type per class), default methods, automatic derivation, rich superclass hierarchy.

**Weaknesses:** Global coherence means no local instances, orphan instance rules are restrictive, no first-class instance values (GHC Core has dictionaries but they are not exposed).

### 4.2 Rust Traits

```rust
// Definition
trait Eq {
    fn eq(&self, other: &Self) -> bool;
    fn ne(&self, other: &Self) -> bool { !self.eq(other) }  // default
}

// Instance
impl Eq for i32 {
    fn eq(&self, other: &i32) -> bool { *self == *other }
}

// Superclass (supertrait)
trait Ord: Eq {
    fn cmp(&self, other: &Self) -> Ordering;
}

// Higher-kinded (not native -- workaround with GATs)
trait Functor {
    type Unwrapped;
    type Wrapped<B>: Functor;
    fn map<B>(self, f: impl Fn(Self::Unwrapped) -> B) -> Self::Wrapped<B>;
}

// Derivation
#[derive(Eq, PartialEq, Ord, PartialOrd)]
struct Color { r: u8, g: u8, b: u8 }
```

**Strengths:** Static dispatch with monomorphization (zero-cost), strict orphan rules (coherence), associated types, derive macros, trait objects for dynamic dispatch.

**Weaknesses:** No native HKTs (GATs are a partial workaround), orphan rules can be too restrictive, no specialization (nightly-only), derive macros require proc-macro infrastructure.

### 4.3 Scala 3 Given/Using

```scala
// Definition
trait Ord[A]:
  def compare(x: A, y: A): Int
  extension (x: A)
    def < (y: A) = compare(x, y) < 0
    def > (y: A) = compare(x, y) > 0

// Instance
given Ord[Int] with
  def compare(x: Int, y: Int) = x.compareTo(y)

// Usage -- instance resolved from scope
def sort[A: Ord](xs: List[A]): List[A] = ...

// Derivation
case class Point(x: Int, y: Int) derives Ord
```

**Strengths:** First-class instance values (`given`), scope-based resolution (`using`), clean syntax, derivation, extension methods, gradual migration from implicits.

**Weaknesses:** Resolution rules are complex, multiple givens can cause ambiguity, no strict coherence (different scopes can provide different instances).

### 4.4 OCaml Modular Implicits (In Development)

```ocaml
(* Module type = typeclass *)
module type Eq = sig
  type t
  val equal : t -> t -> bool
end

(* Instance = module *)
implicit module Eq_int : Eq with type t = int = struct
  type t = int
  let equal = Int.equal
end

(* Usage = compiler resolves the module *)
let mem (type a) {E : Eq with type t = a} (x : a) (xs : a list) =
  List.exists (E.equal x) xs
```

**Strengths:** Based on OCaml's powerful module system, first-class modules are first-class values, natural extension of existing features.

**Weaknesses:** Still under development (modular explicits landed in 2024, implicits not yet merged), complex resolution rules, no derivation.

### 4.5 fp-ts Typeclasses

```typescript
// URI-based HKT encoding
declare module './HKT' {
  interface URItoKind<A> {
    readonly 'Array': Array<A>
  }
}

// Typeclass definition
interface Functor1<F extends URIS> {
  readonly map: <A, B>(fa: Kind<F, A>, f: (a: A) => B) => Kind<F, B>
}

// Instance as module-level constant
const ArrayFunctor: Functor1<'Array'> = {
  map: (fa, f) => fa.map(f),
}

// Usage -- explicit instance passing
const doubleAll = <F extends URIS>(F: Functor1<F>) => (fa: Kind<F, number>) =>
  F.map(fa, n => n * 2)

doubleAll(ArrayFunctor)([1, 2, 3]) // [2, 4, 6]
```

**Strengths:** Perfect tree-shaking (instances are values), no runtime dispatch overhead, no global state, type-safe.

**Weaknesses:** Verbose instance passing, URI string registration is error-prone, no superclass syntax, no derivation, HKT encoding is brittle.

### 4.6 Effect Typeclasses

```typescript
// TypeLambda-based HKT encoding
interface ArrayTypeLambda extends TypeLambda {
  readonly type: Array<this['Out1']>
}

// Typeclass definition
interface Covariant<F extends TypeLambda> extends Invariant<F> {
  readonly map: {
    <A, B>(f: (a: A) => B): <R, O, E>(
      self: Kind<F, R, O, E, A>,
    ) => Kind<F, R, O, E, B>
    <R, O, E, A, B>(
      self: Kind<F, R, O, E, A>,
      f: (a: A) => B,
    ): Kind<F, R, O, E, B>
  }
}

// Instance
const ArrayCovariant: Covariant<ArrayTypeLambda> = {
  imap: Covariant.imap<ArrayTypeLambda>(map),
  map: dual(2, <A, B>(self: Array<A>, f: (a: A) => B) => self.map(f)),
}
```

**Strengths:** Dual API (data-first and data-last), TypeLambda is more robust than URI strings, superclass via interface extension, tree-shakeable.

**Weaknesses:** Verbose TypeLambda boilerplate, still requires explicit instance passing in generic code, no automatic derivation, five type parameters per Kind application.

### 4.7 TRAITOR v1

See the archaeology document for full details. Key properties:

**Strengths:** Clean `implement()` API, external/internal interface split, property-based laws, curried variant generation.

**Weaknesses:** Runtime dispatch via Proxy, global mutable registry, broken tree-shaking, 3,200 lines of infrastructure for three traits, coherence violations possible.

---

## 5. TRAITOR v2 Architecture

### 5.1 Design Principles

1. **Compile-time first.** Every typeclass starts as a type-level definition. Runtime is opt-in.
2. **Tree-shaking is non-negotiable.** No global registries. No module-level side effects. Every runtime artifact must be a named export that bundlers can eliminate.
3. **Declaration merging is the dispatch mechanism.** TypeScript's `interface` merging is the only extensibility primitive that works at compile time, costs zero bytes, and survives tsgo.
4. **Explicit over implicit.** Instance passing is explicit at the value level. The type system handles inference.
5. **Composition over hierarchy.** Typeclasses compose via intersection, not via deep inheritance chains.

### 5.2 The Three Tiers

```
                      User Code
                         |
                +--------+--------+
                |                 |
         Type-Level Code    Runtime Code
                |                 |
        +-------+-------+   +----+----+
        |               |   |         |
     Tier 1          Tier 3     Tier 2
 (Pure Types)     (Codegen)  (Instances)
        |               |         |
Declaration Merging     |   Module Exports
Conditional Types       |   Function Values
        |               |         |
        +-------+-------+         |
                |                 |
          Type Registry --------->|
         (compile-time)    (generates runtime)
```

**Tier 1 (Type-Level):** Defines typeclasses and their instances purely at the type level. Uses `KITZ.Traits` global namespace with declaration merging. Handles all compile-time dispatch and type inference. Zero runtime cost.

**Tier 2 (Runtime Instances):** Defines typeclass instances as module-level constant values. Instances are passed explicitly to generic functions. Perfect tree-shaking because everything is a named export.

**Tier 3 (Codegen Bridge):** A build-time tool that reads Tier 1 type registries and generates Tier 2 dispatch code. The user writes only Tier 1 registrations; the codegen produces optimal Tier 2 code.

---

## 6. Tier 1: Type-Level Only (Zero Runtime)

### 6.1 Defining a Typeclass

A Tier 1 typeclass is a global namespace with a `Handlers` interface:

````typescript
// packages/core/src/ts/traits/eq.ts

/**
 * Type-level equality trait.
 *
 * Determines whether two types are structurally equal at the type level.
 * Returns a boolean literal type.
 */

// Helper: extract the first matching handler result
type HandlersResult<$A, $B> = [keyof KITZ.Traits.Eq.Handlers<$A, $B>] extends
  [never] ? never
  : KITZ.Traits.Eq.Handlers<$A, $B>[keyof KITZ.Traits.Eq.Handlers<$A, $B>]

/**
 * Type-level equality check.
 *
 * @example
 * ```typescript
 * type R1 = Ts.Eq<1, 1>          // true
 * type R2 = Ts.Eq<'a', 'b'>      // false
 * type R3 = Ts.Eq<[1,2], [1,2]>  // true (if array handler registered)
 * ```
 */
export type Eq<$A, $B> =
  // Identical types (structural)
  (<T>() => T extends $A ? 1 : 0) extends (<T>() => T extends $B ? 1 : 0) ? true
    // Check registered handlers
    : [HandlersResult<$A, $B>] extends [never] ? false
    : HandlersResult<$A, $B>

declare global {
  namespace KITZ.Traits {
    namespace Eq {
      /**
       * Registry of type-level equality handlers.
       *
       * Each property should be a conditional type returning:
       * - `true` if the types are considered equal
       * - `false` if the types are not equal
       * - `never` if this handler doesn't apply
       */
      interface Handlers<$A, $B> {
        // Empty -- domain modules add handlers
      }
    }
  }
}
````

### 6.2 Implementing a Typeclass for a Type

Implementations are declaration-merged handlers in domain modules:

```typescript
// In packages/core/src/arr/arr.ts -- co-located with array utilities

declare global {
  namespace KITZ.Traits.Eq {
    interface Handlers<$A, $B> {
      _array: $A extends readonly (infer EA)[]
        ? $B extends readonly (infer EB)[]
          ? $A['length'] extends $B['length']
            ? _TupleEq<Extract<$A, readonly any[]>, Extract<$B, readonly any[]>>
          : false
        : never
        : never
    }
  }
}

// Helper: element-wise tuple equality
type _TupleEq<$A extends readonly any[], $B extends readonly any[]> = $A extends
  readonly [infer HA, ...infer TA]
  ? $B extends readonly [infer HB, ...infer TB]
    ? Ts.Eq<HA, HB> extends true ? _TupleEq<TA, TB>
    : false
  : false
  : $B extends readonly [] ? true
  : false
```

### 6.3 Using in Generic Code

Type-level typeclasses serve as constraints and computed types:

```typescript
/**
 * Assert that two types are equal, producing a compile error if not.
 */
type AssertEq<$A, $B> = Ts.Eq<$A, $B> extends true ? $A : Ts.Err.StaticError<
  `Type ${Ts.Display<$A>} is not equal to ${Ts.Display<$B>}`
>

/**
 * Type-level Map that preserves equality -- if input types are equal,
 * output types are proven equal.
 */
type EqPreservingMap<$F extends Kind, $A, $B> = Ts.Eq<$A, $B> extends true
  ? Kind.Apply<$F, [$A]> // Can safely return either since they're equal
  : Kind.Apply<$F, [$A]> | Kind.Apply<$F, [$B]>
```

### 6.4 Multi-Method Typeclasses

Some typeclasses have multiple related operations. Group them in a single Handlers interface:

```typescript
// Type-level Ord trait
declare global {
  namespace KITZ.Traits {
    namespace Ord {
      interface Handlers<$A, $B> {
        // Each handler returns a Compare result or never
      }
    }
  }
}

type Compare = -1 | 0 | 1

export type Ord<$A, $B> =
  // Delegate to Eq for the = case first
  Ts.Eq<$A, $B> extends true ? 0
    : [OrdHandlersResult<$A, $B>] extends [never] ? never // No ordering defined
    : OrdHandlersResult<$A, $B>
```

### 6.5 The General Pattern

Every Tier 1 typeclass follows this template:

```typescript
// 1. Define the trait namespace with Handlers interface
declare global {
  namespace KITZ.Traits {
    namespace TraitName {
      interface Handlers<$TypeParams...> {
        // Empty -- filled by domain modules
      }
    }
  }
}

// 2. Define the dispatch type
type HandlersResult<$TypeParams...> =
  [keyof KITZ.Traits.TraitName.Handlers<$TypeParams...>] extends [never]
    ? never
    : KITZ.Traits.TraitName.Handlers<$TypeParams...>[
        keyof KITZ.Traits.TraitName.Handlers<$TypeParams...>
      ]

// 3. Define the public API type
export type TraitName<$TypeParams...> =
  // Built-in cases first
  // ...
  // Then delegate to handlers
  : [HandlersResult<$TypeParams...>] extends [never]
    ? FallbackBehavior
    : HandlersResult<$TypeParams...>

// 4. Register instances in domain modules
declare global {
  namespace KITZ.Traits.TraitName {
    interface Handlers<$TypeParams...> {
      _domainName: $Type extends DomainType ? Result : never
    }
  }
}
```

### 6.6 Display Refactored as Tier 1

The existing Display trait already IS Tier 1. No changes needed. It naturally generalizes:

```typescript
// Display is already the canonical Tier 1 typeclass
// Handlers<$Type> maps types to string representations
// HandlersResult extracts the matching handler
// Display<$Type> dispatches through primitives then handlers
```

### 6.7 Type-Level Functor (Higher-Kinded Tier 1)

This is where it gets interesting. Can we have type-level HKT typeclasses?

```typescript
// Type-level Mappable: given a type constructor F and a type mapping,
// produce the mapped type.
declare global {
  namespace KITZ.Traits {
    namespace Mappable {
      /**
       * Registry of Mappable type constructors.
       *
       * Each handler should:
       * - Match when $F is the handler's type constructor
       * - Apply the type mapping $Fn to the inner type(s) of $FA
       * - Return `never` if this handler doesn't apply
       *
       * $FA is the concrete type (e.g., Array<string>)
       * $Fn is a Kind that maps A -> B at the type level
       */
      interface Handlers<$FA, $Fn extends Kind> {
        // Filled by domain modules
      }
    }
  }
}

// Type-level map: apply a type function to the inner type of a container
export type Map<$FA, $Fn extends Kind> = [MappableResult<$FA, $Fn>] extends
  [never] ? never // No Mappable instance for this type
  : MappableResult<$FA, $Fn>

type MappableResult<$FA, $Fn extends Kind> = KITZ.Traits.Mappable.Handlers<
  $FA,
  $Fn
>[
  keyof KITZ.Traits.Mappable.Handlers<$FA, $Fn>
]
```

Registering Array as Mappable:

```typescript
declare global {
  namespace KITZ.Traits.Mappable {
    interface Handlers<$FA, $Fn extends Kind> {
      _array: $FA extends (infer E)[] ? Kind.Apply<$Fn, [E]>[]
        : never
      _readonlyArray: $FA extends readonly (infer E)[]
        ? $FA extends (infer _)[] ? never // Mutable array handled above
        : readonly Kind.Apply<$Fn, [E]>[]
        : never
      _promise: $FA extends Promise<infer V> ? Promise<Kind.Apply<$Fn, [V]>>
        : never
    }
  }
}

// Usage:
interface Stringify extends Kind {
  return: `${this['parameters'][0] & (string | number | boolean)}`
}

type R1 = Traits.Mappable.Map<string[], Stringify>
// string[] -> Map each string through Stringify -> `${string}`[]

type R2 = Traits.Mappable.Map<Promise<number>, Stringify>
// Promise<number> -> Promise<`${number}`>
```

This is genuinely powerful -- it enables type-level generic programming over containers without any runtime cost.

### 6.8 Limitations of Tier 1

Tier 1 is constrained to what TypeScript's type system can express:

1. **No runtime dispatch.** `Ts.Eq<a, b>` produces a type, not a value. You cannot call it at runtime.
2. **Union semantics.** If multiple handlers match, their results form a union. This is intentional for Display (where multiple matches indicate ambiguity) but problematic for Eq (where we want exactly one answer).
3. **No recursion budget control.** Complex nested type-level dispatch can hit TypeScript's recursion limits (1000 tail-recursive, 50 non-tail).
4. **No side effects.** Type-level computation cannot read files, make network calls, or interact with the environment.

For anything that needs runtime behavior, we need Tier 2.

---

## 7. Tier 2: Explicit Instance Passing (Perfect Tree-Shaking)

### 7.1 Typeclass Interface Definition

A Tier 2 typeclass is a TypeScript interface parameterized by a type (or type constructor):

````typescript
// packages/core/src/traits/eq.ts

/**
 * Runtime Eq typeclass.
 *
 * Provides structural equality comparison for values of type A.
 *
 * @example
 * ```typescript
 * // Using a built-in instance
 * import { Eq } from '@kitz/core/traits'
 *
 * Eq.string.equals('hello', 'hello')  // true
 * Eq.number.equals(1, 2)              // false
 *
 * // In generic code
 * const contains = <A>(eq: Eq<A>) => (xs: A[], target: A): boolean =>
 *   xs.some(x => eq.equals(x, target))
 *
 * contains(Eq.number)([1, 2, 3], 2)  // true
 * ```
 */
export interface Eq<A> {
  readonly equals: (self: A, that: A) => boolean
}

export declare namespace Eq {
  /**
   * An Eq instance with additional notEquals derived from equals.
   */
  interface Full<A> extends Eq<A> {
    readonly notEquals: (self: A, that: A) => boolean
  }
}
````

### 7.2 Instance Definitions

Instances are module-level constants. Perfect tree-shaking:

```typescript
// packages/core/src/traits/eq.ts (continued)

/**
 * Eq instance for strings.
 */
export const string: Eq<string> = {
  equals: (self, that) => self === that,
}

/**
 * Eq instance for numbers.
 * Uses Object.is to handle NaN correctly.
 */
export const number: Eq<number> = {
  equals: (self, that) => Object.is(self, that),
}

/**
 * Eq instance for booleans.
 */
export const boolean: Eq<boolean> = {
  equals: (self, that) => self === that,
}

/**
 * Derive an Eq for arrays given an Eq for elements.
 */
export const array = <A>(eqA: Eq<A>): Eq<ReadonlyArray<A>> => ({
  equals: (self, that) =>
    self.length === that.length
    && self.every((a, i) => eqA.equals(a, that[i]!)),
})

/**
 * Derive an Eq for records given an Eq for values.
 */
export const record = <A>(eqA: Eq<A>): Eq<Readonly<Record<string, A>>> => ({
  equals: (self, that) => {
    const ks = Object.keys(self)
    const kt = Object.keys(that)
    return ks.length === kt.length
      && ks.every(k => k in that && eqA.equals(self[k]!, that[k]!))
  },
})

/**
 * Derive an Eq from a mapping function.
 *
 * Two values are equal if they map to equal results.
 */
export const mapInput = <A, B>(eqB: Eq<B>, f: (a: A) => B): Eq<A> => ({
  equals: (self, that) => eqB.equals(f(self), f(that)),
})

/**
 * Promote an Eq to a Full Eq with notEquals.
 */
export const full = <A>(eq: Eq<A>): Eq.Full<A> => ({
  ...eq,
  notEquals: (self, that) => !eq.equals(self, that),
})
```

### 7.3 Higher-Kinded Typeclasses

For typeclasses over type constructors, we use kitz's extended HKT system:

```typescript
// packages/core/src/traits/covariant.ts

import type { KindOf, TypeLambda } from '#fn/kind'

/**
 * Covariant functor typeclass.
 *
 * A type constructor F is Covariant (a functor) if you can map a function
 * over its inner type while preserving the outer structure.
 *
 * Laws:
 * - Identity: map(fa, identity) === fa
 * - Composition: map(map(fa, f), g) === map(fa, x => g(f(x)))
 */
export interface Covariant<F extends TypeLambda> {
  readonly map: {
    // Data-first
    <In, Out2, A, B>(
      self: KindOf<F, In, Out2, A>,
      f: (a: A) => B,
    ): KindOf<F, In, Out2, B>
    // Data-last (for pipe)
    <A, B>(
      f: (a: A) => B,
    ): <In, Out2>(self: KindOf<F, In, Out2, A>) => KindOf<F, In, Out2, B>
  }
}
```

TypeLambda definitions for concrete types:

```typescript
// packages/core/src/arr/type-lambda.ts

import type { TypeLambda } from '#fn/kind'

/**
 * TypeLambda for Array.
 * Maps Array as a type constructor: * -> *
 */
export interface ArrayTypeLambda extends TypeLambda {
  readonly Target: Array<this['Out1']>
}

/**
 * TypeLambda for ReadonlyArray.
 */
export interface ReadonlyArrayTypeLambda extends TypeLambda {
  readonly Target: ReadonlyArray<this['Out1']>
}
```

Instance for Array:

````typescript
// packages/core/src/arr/instances.ts

import { dual } from '#fn/fn'
import type { Covariant } from '#traits/covariant'
import type { ArrayTypeLambda } from './type-lambda.js'

/**
 * Covariant instance for Array.
 *
 * @example
 * ```typescript
 * import { Arr } from '@kitz/core'
 * import { Traits } from '@kitz/core'
 *
 * // Direct usage
 * Arr.Covariant.map([1, 2, 3], n => n * 2)  // [2, 4, 6]
 *
 * // In generic code
 * const double = <F extends TypeLambda>(C: Covariant<F>) =>
 *   <In, Out2>(fa: KindOf<F, In, Out2, number>) =>
 *     C.map(fa, n => n * 2)
 *
 * double(Arr.Covariant)([1, 2, 3])  // [2, 4, 6]
 * ```
 */
export const Covariant: Covariant<ArrayTypeLambda> = {
  map: dual(
    2,
    <A, B>(self: Array<A>, f: (a: A) => B): Array<B> => self.map(f),
  ),
}
````

### 7.4 Superclass Relationships

Superclasses are expressed via interface extension:

```typescript
// Ord extends Eq
export interface Ord<A> extends Eq<A> {
  readonly compare: (self: A, that: A) => -1 | 0 | 1
}

// Monad extends Covariant (through Applicative through Functor)
export interface Applicative<F extends TypeLambda> extends Covariant<F> {
  readonly of: <A>(a: A) => KindOf<F, unknown, never, A>
}

export interface FlatMap<F extends TypeLambda> extends Covariant<F> {
  readonly flatMap: {
    <In, Out2, A, B>(
      self: KindOf<F, In, Out2, A>,
      f: (a: A) => KindOf<F, In, Out2, B>,
    ): KindOf<F, In, Out2, B>
    <A, In, Out2, B>(
      f: (a: A) => KindOf<F, In, Out2, B>,
    ): (self: KindOf<F, In, Out2, A>) => KindOf<F, In, Out2, B>
  }
}

export interface Monad<F extends TypeLambda>
  extends Applicative<F>, FlatMap<F>
{}
```

### 7.5 Default Methods

Defaults are helper functions that derive methods from other methods:

```typescript
// packages/core/src/traits/eq.ts

/**
 * Derive a full Eq (with notEquals) from a basic Eq.
 * This is the "default method" mechanism.
 */
export const withDefaults = <A>(base: Eq<A>): Eq.Full<A> => ({
  ...base,
  notEquals: (self, that) => !base.equals(self, that),
})

// For Ord, derive Eq from Ord
export namespace Ord {
  /**
   * Derive the Eq portion of Ord from compare.
   */
  export const toEq = <A>(ord: Ord<A>): Eq<A> => ({
    equals: (self, that) => ord.compare(self, that) === 0,
  })

  /**
   * Derive min/max from Ord.
   */
  export const withDefaults = <A>(base: Ord<A>) => ({
    ...base,
    min: (self: A, that: A): A => base.compare(self, that) <= 0 ? self : that,
    max: (self: A, that: A): A => base.compare(self, that) >= 0 ? self : that,
  })
}

// For Covariant, derive Invariant from Covariant
export namespace Covariant {
  export const toInvariant = <F extends TypeLambda>(
    C: Covariant<F>,
  ): Invariant<F> => ({
    imap: dual(3, (self, to, _from) => C.map(self, to)),
  })
}
```

### 7.6 Consuming Typeclasses in Generic Code

```typescript
// A generic sort that works with any Ord instance
export const sortBy = <A>(ord: Ord<A>) => (xs: ReadonlyArray<A>): Array<A> =>
  [...xs].sort((a, b) => ord.compare(a, b))

// A generic traverse that works with any Applicative + Covariant
export const traverse =
  <F extends TypeLambda>(A: Applicative<F>) =>
  <A, B, In, Out2>(
    xs: ReadonlyArray<A>,
    f: (a: A) => KindOf<F, In, Out2, B>,
  ): KindOf<F, In, Out2, ReadonlyArray<B>> => {
    // Implementation using A.of and A.map
    return xs.reduce(
      (acc, x) =>
        A.map(
          A.ap(A.map(acc, (bs: B[]) => (b: B) => [...bs, b]), f(x)),
          id,
        ),
      A.of([] as B[]) as KindOf<F, In, Out2, B[]>,
    )
  }

// Usage at call sites
const sorted = sortBy(Ord.number)([3, 1, 2]) // [1, 2, 3]
const sorted2 = sortBy(Ord.string)(['c', 'a', 'b']) // ['a', 'b', 'c']
```

### 7.7 Module Organization

```
packages/core/src/
  traits/
    _.ts            # export * as Traits from './__.js'
    __.ts           # barrel: export * from './eq.js'; export * from './ord.js'; ...
    eq.ts           # Eq interface + primitive instances + combinators
    ord.ts          # Ord interface + primitive instances + combinators
    covariant.ts    # Covariant<F> interface
    applicative.ts  # Applicative<F> extends Covariant<F>
    flatmap.ts      # FlatMap<F> extends Covariant<F>
    monad.ts        # Monad<F> extends Applicative<F>, FlatMap<F>
    foldable.ts     # Foldable<F> interface
    traversable.ts  # Traversable<F> extends Covariant<F>, Foldable<F>

  arr/
    type-lambda.ts  # ArrayTypeLambda
    instances.ts    # Covariant, Applicative, FlatMap, Monad, Foldable, Traversable
    arr.ts          # existing array utilities (unchanged)
```

### 7.8 Tree-Shaking Proof

Every instance is a named export from a specific module:

```typescript
// If a consumer only uses Eq.string:
import { Eq } from '@kitz/core/traits'
Eq.string.equals('a', 'b')

// Bundler tree-shakes:
// - Eq.number (unused)
// - Eq.boolean (unused)
// - Eq.array (unused)
// - Eq.record (unused)
// - All of Ord, Covariant, Applicative, etc.

// If a consumer uses Arr.Covariant.map:
import { Arr } from '@kitz/core'
Arr.Covariant.map([1, 2], n => n * 2)

// Bundler tree-shakes:
// - Arr.Applicative (unused)
// - Arr.Monad (unused)
// - Everything else
```

This works because:

1. `"sideEffects": false` in `package.json` tells the bundler the package is safe to shake.
2. Every instance is a `const` assignment at module scope with no side effects.
3. No global registry. No Proxy. No mutable state.

---

## 8. Tier 3: Codegen-Assisted (Zero Verbosity, Perfect Tree-Shaking)

### 8.1 The Problem Tier 3 Solves

Tier 2 has one ergonomic weakness: explicit instance passing.

```typescript
// Without Tier 3 -- the user must thread instances manually:
const result = sortBy(Ord.number)(
  filterWith(Eq.number)(xs, target),
)

// What the user wants to write:
const result = sort(xs) // "just work" -- the instance is resolved
```

Tier 3 bridges Tier 1 (type-level registry) and Tier 2 (runtime instances) via build-time codegen.

### 8.2 Architecture

```
Source Code (what the user writes)
       |
       v
Tier 1 Type Registry          Tier 2 Instance Modules
(KITZ.Traits.*.Handlers)      (named export constants)
       |                               |
       v                               v
+-----------------------------------------+
|        TRAITOR Codegen Tool             |
|                                         |
|  1. Reads Tier 1 registrations          |
|  2. Matches them to Tier 2 instances    |
|  3. Generates dispatch functions        |
+-----------------------------------------+
       |
       v
Generated Dispatch Module
(tree-shakeable, type-safe)
```

### 8.3 What the User Writes

**Step 1: Define the typeclass (Tier 1 + Tier 2)**

```typescript
// This is written once by the typeclass author

// Tier 1: Type-level trait
declare global {
  namespace KITZ.Traits {
    namespace Eq {
      interface Handlers<$A, $B> {}
      // NEW: Instance registry maps types to their Tier 2 instance module
      interface Instances<$A> {}
    }
  }
}

// Tier 2: Runtime interface
export interface Eq<A> {
  readonly equals: (self: A, that: A) => boolean
}
```

**Step 2: Register an instance (both tiers)**

```typescript
// In packages/core/src/arr/instances.ts

import { Eq as EqTrait } from '#traits/eq'

// Tier 2: The actual runtime instance
export const EqArray = <A>(eqA: EqTrait<A>): EqTrait<ReadonlyArray<A>> => ({
  equals: (self, that) =>
    self.length === that.length
    && self.every((a, i) => eqA.equals(a, that[i]!)),
})

// Tier 1: Type-level registration (co-located)
declare global {
  namespace KITZ.Traits.Eq {
    interface Instances<$A> {
      _array: $A extends ReadonlyArray<infer E>
        ? { module: '@kitz/core/arr/instances'; export: 'EqArray'; param: E }
        : never
    }
  }
}
```

**Step 3: Use it naturally**

```typescript
// What the user writes -- no explicit instance passing
import { equals } from '@kitz/core/generated/eq'

equals([1, 2, 3], [1, 2, 3]) // true
equals('hello', 'hello') // true
```

### 8.4 What the Codegen Produces

The codegen tool reads the `KITZ.Traits.Eq.Instances` interface via TypeScript's type system and generates:

```typescript
// packages/core/src/generated/eq.ts
// @generated -- DO NOT EDIT

import { EqArray } from '#arr/instances'
import { Eq } from '#traits/eq'

// Primitive instances (always included since they are leaves)
const _eqString: Eq<string> = { equals: (a, b) => a === b }
const _eqNumber: Eq<number> = { equals: (a, b) => Object.is(a, b) }
const _eqBoolean: Eq<boolean> = { equals: (a, b) => a === b }

/**
 * Resolve the Eq instance for a value at runtime.
 *
 * Uses typeof-based dispatch for primitives,
 * Array.isArray for arrays.
 *
 * @throws {Error} If no Eq instance exists for the value's type.
 */
const resolveEq = (value: unknown): Eq<any> => {
  switch (typeof value) {
    case 'string':
      return _eqString
    case 'number':
      return _eqNumber
    case 'boolean':
      return _eqBoolean
    default:
      if (Array.isArray(value)) {
        // For arrays, we need the element Eq.
        // Use structural equality as fallback.
        return EqArray({ equals: (a, b) => equals(a, b) })
      }
      throw new Error(`No Eq instance for ${typeof value}`)
  }
}

/**
 * Check equality of two values, auto-resolving the Eq instance.
 *
 * Tree-shakeable: if you don't import `equals`, none of this code
 * is included in your bundle.
 */
export const equals = <A>(self: A, that: A): boolean =>
  resolveEq(self).equals(self, that)
```

### 8.5 Tree-Shaking Proof for Tier 3

The generated module is a normal ESM module with named exports:

```typescript
// Consumer only uses `equals` for strings:
import { equals } from '@kitz/core/generated/eq'
equals('a', 'b')

// The bundler sees:
// 1. `equals` is used -> keep it
// 2. `equals` calls `resolveEq` -> keep it
// 3. `resolveEq` references `_eqString`, `_eqNumber`, etc.
// 4. With `sideEffects: false`, bundler can still shake unused branches

// But wait -- the switch statement references all instances.
// This is the fundamental trade-off of Tier 3:
// Auto-dispatch requires knowing about all instances.
```

**Mitigation: Specialized Entry Points**

The codegen can produce specialized modules:

```typescript
// packages/core/src/generated/eq/string.ts
// @generated -- Only string Eq, perfect tree-shaking
export const equals = (self: string, that: string): boolean => self === that

// packages/core/src/generated/eq/array.ts
// @generated -- Only array Eq
import { Eq } from '#traits/eq'
export const equals =
  <A>(eqA: Eq<A>) =>
  (self: ReadonlyArray<A>, that: ReadonlyArray<A>): boolean =>
    self.length === that.length && self.every((a, i) => eqA.equals(a, that[i]!))

// packages/core/src/generated/eq/dispatch.ts
// @generated -- Full dispatch (opt-in, larger bundle)
export { equals } from './dispatch-impl.js'
```

This gives users the choice:

```typescript
// Maximum tree-shaking: import the specific instance
import { equals } from '@kitz/core/generated/eq/string'

// Convenience: auto-dispatch (larger bundle)
import { equals } from '@kitz/core/generated/eq/dispatch'
```

### 8.6 Codegen Tool Design

The codegen tool is a build-time script that:

1. **Reads the TypeScript project** (via tsgo's type-checker, or by parsing `.d.ts` files).
2. **Extracts `KITZ.Traits.*.Instances` interface properties.**
3. **Resolves the module paths and export names** from the instance metadata.
4. **Generates dispatch modules** with switch statements, specialized entry points, and type declarations.

```typescript
// scripts/traitor-codegen.ts
// This is a build-time script, not a runtime dependency

interface InstanceRegistration {
  traitName: string
  handlerKey: string
  typeConstraint: string // e.g., "ReadonlyArray<infer E>"
  module: string // e.g., "@kitz/core/arr/instances"
  export: string // e.g., "EqArray"
  params: string[] // e.g., ["E"] -- type parameters that need resolution
}

// The codegen reads these from the compiled type declarations
// and generates the dispatch modules
```

**Critical constraint:** The codegen tool must be compiler-API-independent. It cannot depend on `ts-morph` or the `typescript` package API, because tsgo will break those. Instead, it should:

1. Read `.d.ts` files as text and parse the `KITZ.Traits` namespace declarations.
2. Use a simple regex/AST parser (not the full TS compiler) to extract interface properties.
3. Generate `.ts` source files using template strings.

This makes the codegen tool tsgo-safe.

### 8.7 When to Use Each Tier

| Scenario                                  | Tier | Why                                |
| ----------------------------------------- | ---- | ---------------------------------- |
| Type-level assertions                     | 1    | No runtime needed                  |
| Error messages                            | 1    | Display is purely type-level       |
| Library-internal generic code             | 2    | Author controls instance threading |
| Application-level business logic          | 2    | Explicit is clear                  |
| "It just works" APIs                      | 3    | Codegen handles dispatch           |
| Hot paths where dispatch overhead matters | 2    | Direct instance call, no switch    |

---

## 9. Hard Problems

### 9.1 Coherence

**Problem:** How to ensure one instance per type per typeclass (or handle overlapping instances).

**Tier 1 solution: Union semantics with conflict detection.**

Multiple Tier 1 handlers can match the same type. Their results form a union. For Display, this is fine -- if two handlers both produce `'Array<string>'`, the union collapses. For Eq, this is dangerous -- we need exactly one `true` or `false`.

Detection mechanism:

```typescript
// Type-level coherence check
type CheckCoherence<$Handlers, $Type> =
  // Count how many handler keys produce a non-never result
  keyof {
    [K in keyof $Handlers as $Handlers[K] extends never ? never : K]: true
  } extends infer Keys
    ? // If exactly one key, coherent
      [Keys] extends [string]
      ? true
      // If zero keys, no instance (not incoherent, just missing)
      : [Keys] extends [never]
        ? true
        // Multiple keys: incoherent
        : false
    : never

// Usage in the trait dispatch type
export type Eq<$A, $B> =
  CheckCoherence<KITZ.Traits.Eq.Handlers<$A, $B>, $A> extends false
    ? Ts.Err.StaticError<`Incoherent: multiple Eq handlers match ${Ts.Display<$A>}`>
    : /* normal dispatch */
```

This produces a compile-time error if two handlers overlap. The user must fix the overlap by making their handlers more specific.

**Tier 2 solution: Type system prevents duplicates.**

Since instances are explicit values, coherence is naturally maintained. You can define two `Eq<string>` values, but they are just two different variables -- the user explicitly chooses which one to use.

```typescript
// These are just two different values. No conflict.
const stringEqCaseSensitive: Eq<string> = { equals: (a, b) => a === b }
const stringEqCaseInsensitive: Eq<string> = {
  equals: (a, b) => a.toLowerCase() === b.toLowerCase(),
}

// The user explicitly picks one:
sortBy(Ord.fromEq(stringEqCaseSensitive))(words)
```

**Tier 3 solution: Build-time validation.**

The codegen tool checks for overlapping `Instances` registrations and fails the build if it finds ambiguity:

```
Error: Incoherent Eq instances for type `string`:
  - _string (from @kitz/core/traits/eq)
  - _myString (from my-project/custom-eq)
Remove one or make the type constraints non-overlapping.
```

### 9.2 Orphan Instances

**Problem:** Should third parties be able to define instances for types they don't own?

**Design decision: Yes, with opt-in and warnings.**

In Haskell and Rust, orphan instances are restricted to prevent coherence violations. But TypeScript's declaration merging is inherently open -- anyone can augment any interface. We cannot prevent orphan instances at the language level.

Instead, we provide tooling:

```typescript
// Third-party orphan instance -- this is allowed
// File: my-app/src/traits/effect-display.ts
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      // Orphan: Display handler for Effect (defined by neither kitz nor Effect)
      _effect: $Type extends Effect.Effect<infer A, infer E, infer R>
        ? `Effect<${Display<A>}, ${Display<E>}, ${Display<R>}>`
        : never
    }
  }
}
```

**Tier 1:** Orphans just work. Declaration merging has no restriction mechanism. The coherence check (9.1) catches conflicts.

**Tier 2:** Orphans are normal module exports. Import what you want.

**Tier 3:** The codegen tool can be configured to warn on orphan instances:

```yaml
# traitor.config.yaml
orphan-policy: warn  # or 'error' or 'allow'
```

### 9.3 Superclasses

**Problem:** How does `class Ord a => Eq a` work?

**Tier 1: Type-level superclass constraints.**

```typescript
// Tier 1 superclass: Ord requires Eq
declare global {
  namespace KITZ.Traits {
    namespace Ord {
      interface Handlers<$A, $B> {}

      // Superclass constraint: registering an Ord handler is only valid
      // if an Eq handler also exists.
      //
      // This is checked by the Ord dispatch type.
    }
  }
}

// The dispatch type enforces the superclass constraint
export type Ord<$A, $B> =
  // First, check that Eq exists for these types
  [keyof KITZ.Traits.Eq.Handlers<$A, $B>] extends [never] ? Ts.Err.StaticError<
      `Ord requires Eq, but no Eq handler exists for ${Ts.Display<$A>}`
    >
    // Then check Ord handlers
    : [OrdHandlersResult<$A, $B>] extends [never] ? never
    : OrdHandlersResult<$A, $B>
```

**Tier 2: Interface extension.**

```typescript
// Ord extends Eq at the interface level
export interface Ord<A> extends Eq<A> {
  readonly compare: (self: A, that: A) => -1 | 0 | 1
}

// Every Ord instance must also provide equals
export const number: Ord<number> = {
  equals: (self, that) => Object.is(self, that),
  compare: (self, that) => self < that ? -1 : self > that ? 1 : 0,
}

// Or derive equals from compare
export const fromCompare = <A>(
  compare: (self: A, that: A) => -1 | 0 | 1,
): Ord<A> => ({
  equals: (self, that) => compare(self, that) === 0,
  compare,
})
```

### 9.4 Higher-Kinded Typeclasses

**Problem:** How does `class Functor f` work with kitz's HKT?

**Tier 1: Pattern-matching on type constructors.**

The key insight is that Tier 1 handlers match on concrete types, not type constructors. A "Functor for Array" handler matches `Array<A>` for any `A`:

```typescript
declare global {
  namespace KITZ.Traits {
    namespace Mappable {
      interface Handlers<$FA, $Fn extends Kind> {
        _array: $FA extends (infer E)[] ? Kind.Apply<$Fn, [E]>[]
          : never
      }
    }
  }
}
```

This works for concrete dispatch. But it cannot express `Functor f` abstractly at the type level -- you cannot parameterize a Tier 1 handler by a type constructor.

**Tier 2: TypeLambda-parameterized interfaces.**

This is where the full HKT system is needed:

```typescript
// TypeLambda for Array
interface ArrayTypeLambda extends TypeLambda {
  readonly Target: Array<this['Out1']>
}

// Functor parameterized by type constructor
interface Covariant<F extends TypeLambda> {
  readonly map: <In, Out2, A, B>(
    self: KindOf<F, In, Out2, A>,
    f: (a: A) => B,
  ) => KindOf<F, In, Out2, B>
}

// Instance for Array
const ArrayCovariant: Covariant<ArrayTypeLambda> = {
  map: (self, f) => self.map(f),
}

// Generic code over any functor
const lift2 = <F extends TypeLambda>(C: Covariant<F>) =>
<In, Out2, A, B, C_>(
  fa: KindOf<F, In, Out2, A>,
  fb: KindOf<F, In, Out2, B>,
  f: (a: A, b: B) => C_,
): KindOf<F, In, Out2, C_> => {
  // Implementation...
}
```

**Tier 1+2 bridge:** Use Tier 1 for "does this type have a Functor?" checks and Tier 2 for actual generic functor code:

```typescript
// Tier 1: type-level check
declare global {
  namespace KITZ.Traits {
    namespace Covariant {
      interface Handlers<$F> {
        _array: $F extends (infer _)[] ? true : never
        _promise: $F extends Promise<infer _> ? true : never
      }
    }
  }
}

type HasCovariant<$F> = [keyof KITZ.Traits.Covariant.Handlers<$F>] extends
  [never] ? false : true

// Tier 2: runtime functor
const mapOver = <A, B>(value: A, f: (x: any) => any): B => {
  // Runtime dispatch only for "convenience" APIs
  if (Array.isArray(value)) return value.map(f) as any
  if (value instanceof Promise) return value.then(f) as any
  throw new Error(`No Covariant instance for ${typeof value}`)
}
```

### 9.5 Default Methods

**Problem:** How to provide default implementations.

**Tier 1: Not applicable.** Type-level traits have no "methods."

**Tier 2: Helper functions that derive methods from a minimal set.**

```typescript
// Ord: only `compare` is required; equals, lt, gt, lte, gte are derived
export interface Ord<A> {
  readonly compare: (self: A, that: A) => -1 | 0 | 1
}

export interface OrdFull<A> extends Ord<A> {
  readonly equals: (self: A, that: A) => boolean
  readonly lt: (self: A, that: A) => boolean
  readonly gt: (self: A, that: A) => boolean
  readonly lte: (self: A, that: A) => boolean
  readonly gte: (self: A, that: A) => boolean
  readonly min: (self: A, that: A) => A
  readonly max: (self: A, that: A) => A
}

// The "default method" mechanism: a function that fills in defaults
export const ordWithDefaults = <A>(base: Ord<A>): OrdFull<A> => ({
  ...base,
  equals: (self, that) => base.compare(self, that) === 0,
  lt: (self, that) => base.compare(self, that) < 0,
  gt: (self, that) => base.compare(self, that) > 0,
  lte: (self, that) => base.compare(self, that) <= 0,
  gte: (self, that) => base.compare(self, that) >= 0,
  min: (self, that) => base.compare(self, that) <= 0 ? self : that,
  max: (self, that) => base.compare(self, that) >= 0 ? self : that,
})

// Instance author only implements compare:
export const numberOrd = ordWithDefaults<number>({
  compare: (self, that) => self < that ? -1 : self > that ? 1 : 0,
})
// numberOrd.lt(1, 2) === true  (derived automatically)
```

This pattern scales to any typeclass hierarchy:

```typescript
// Monad: only `of` and `flatMap` required; map, ap, flatten are derived
export const monadWithDefaults = <F extends TypeLambda>(
  base: Pick<Monad<F>, 'of' | 'flatMap'>,
): Monad<F> => ({
  ...base,
  map: dual(2, (self, f) => base.flatMap(self, a => base.of(f(a)))),
  ap: dual(
    2,
    (self, ff) => base.flatMap(ff, f => base.flatMap(self, a => base.of(f(a)))),
  ),
  flatten: (self) => base.flatMap(self, x => x),
})
```

### 9.6 Instance Derivation

**Problem:** Auto-deriving instances for product/sum types.

**Approach 1: Manual combinators (works today).**

```typescript
// Derive Eq for a product type from field Eqs
export const struct = <A extends Record<string, unknown>>(
  fields: { [K in keyof A]: Eq<A[K]> },
): Eq<A> => ({
  equals: (self, that) =>
    Object.keys(fields).every(k =>
      (fields as any)[k].equals((self as any)[k], (that as any)[k])
    ),
})

// Usage
interface Point {
  x: number
  y: number
}

const EqPoint: Eq<Point> = Eq.struct({
  x: Eq.number,
  y: Eq.number,
})

EqPoint.equals({ x: 1, y: 2 }, { x: 1, y: 2 }) // true
```

**Approach 2: Schema-driven derivation (leveraging Effect Schema).**

Since kitz uses Effect Schema, we can derive instances from schemas:

```typescript
import { Schema as S } from 'effect'

// Derive Eq from a Schema
export const fromSchema = <A, I>(schema: S.Schema<A, I>): Eq<A> => {
  // Use Schema's AST to generate structural equality
  const ast = schema.ast
  return deriveEqFromAST(ast)
}

// Usage with Schema.TaggedClass
class Point extends S.TaggedClass<Point>()('Point', {
  x: S.Number,
  y: S.Number,
}) {}

const EqPoint = Eq.fromSchema(Point)
```

**Approach 3: Codegen-assisted derivation (Tier 3).**

The codegen tool could inspect type declarations and generate derivation code:

```typescript
// User annotates a type with a derive directive (via JSDoc)
/**
 * @derive Eq, Ord, Display
 */
interface Point {
  x: number
  y: number
}

// Codegen produces:
// packages/my-app/src/generated/point-instances.ts
export const EqPoint: Eq<Point> = Eq.struct({
  x: Eq.number,
  y: Eq.number,
})

export const OrdPoint: Ord<Point> = Ord.struct({
  x: Ord.number,
  y: Ord.number,
})
```

### 9.7 Tree-Shaking Summary

| Component                    | Tree-Shakeable? | Mechanism                         |
| ---------------------------- | --------------- | --------------------------------- |
| Tier 1 type definitions      | N/A (type-only) | Erased at compile time            |
| Tier 1 handler registrations | N/A (type-only) | Erased at compile time            |
| Tier 2 typeclass interfaces  | N/A (type-only) | Erased at compile time            |
| Tier 2 primitive instances   | Yes             | Module-level `const`              |
| Tier 2 combinator instances  | Yes             | Returned from pure functions      |
| Tier 2 HKT TypeLambdas       | N/A (type-only) | Erased at compile time            |
| Tier 3 generated dispatch    | Partially       | Switch body includes all branches |
| Tier 3 specialized modules   | Yes             | One module per instance           |

**Key insight:** Tier 2 is always perfectly tree-shakeable. Tier 3's general dispatch function is not, but its specialized entry points are. Users who care about bundle size use the specialized imports.

---

## 10. Comparison Matrix

### 10.1 First-Order Typeclasses (Eq, Ord, Show/Display)

| Feature              | Haskell       | Rust          | Scala 3        | OCaml MI       | fp-ts          | Effect         | TRAITOR v1   | TRAITOR v2 T1 | TRAITOR v2 T2  | TRAITOR v2 T3   |
| -------------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- | ------------ | ------------- | -------------- | --------------- |
| **Resolution**       | Compile       | Compile       | Compile        | Compile        | Explicit       | Explicit       | Runtime      | Compile       | Explicit       | Build+RT        |
| **Instance lookup**  | Type-directed | Type-directed | Scope-directed | Scope-directed | Manual         | Manual         | detectDomain | Decl. merge   | Manual         | Generated       |
| **Coherence**        | Enforced      | Enforced      | Scoped         | Scoped         | N/A            | N/A            | None         | Detectable    | N/A            | Enforced        |
| **Orphan instances** | Restricted    | Restricted    | Allowed        | Controlled     | Allowed        | Allowed        | Allowed      | Allowed       | Allowed        | Configurable    |
| **Default methods**  | Native        | Native        | Native         | Via module     | Helper fn      | Helper fn      | Hooks        | N/A           | Helper fn      | Helper fn       |
| **Tree-shaking**     | N/A           | N/A           | N/A            | N/A            | Good           | Good           | Broken       | Perfect       | Perfect        | Good-Perfect    |
| **Runtime cost**     | Zero          | Zero          | Zero           | Zero           | Instance alloc | Instance alloc | Proxy+lookup | Zero          | Instance alloc | Switch dispatch |
| **Verbosity**        | Low           | Low           | Low            | Medium         | High           | Medium         | Low          | Very Low      | Medium         | Low             |
| **Type safety**      | Full          | Full          | Full           | Full           | Full           | Full           | Partial      | Full          | Full           | Full            |

### 10.2 Higher-Kinded Typeclasses (Functor, Monad)

| Feature              | Haskell     | Rust             | Scala 3         | OCaml MI     | fp-ts         | Effect         | TRAITOR v1      | TRAITOR v2 T1 | TRAITOR v2 T2  |
| -------------------- | ----------- | ---------------- | --------------- | ------------ | ------------- | -------------- | --------------- | ------------- | -------------- |
| **HKT support**      | Native      | GATs only        | Native          | Native       | URI-based     | TypeLambda     | Private symbols | Kind patterns | TypeLambda     |
| **Multi-param HKTs** | Native      | Associated types | Native          | Native       | URIS2/3       | 5-slot Kind    | Not impl.       | Tuple apply   | Named slots    |
| **Functor `f a`**    | `Functor f` | Workaround       | `Functor[F[_]]` | `Functor(F)` | `Functor1<F>` | `Covariant<F>` | Not impl.       | Pattern match | `Covariant<F>` |
| **Monad `m a`**      | `Monad m`   | Not native       | `Monad[F[_]]`   | `Monad(F)`   | `Monad1<F>`   | `Monad<F>`     | Not impl.       | N/A           | `Monad<F>`     |
| **Kind composition** | Native      | Not native       | Native          | Native       | Not built-in  | Not built-in   | Not impl.       | `Pipe<Ks, I>` | Via functions  |

### 10.3 Pragmatic Qualities

| Quality                  | Haskell        | Rust           | Scala 3  | fp-ts          | Effect    | TRAITOR v1     | TRAITOR v2      |
| ------------------------ | -------------- | -------------- | -------- | -------------- | --------- | -------------- | --------------- |
| **Learning curve**       | Steep          | Moderate       | Moderate | Steep          | Moderate  | Steep          | Gradual (tiers) |
| **Error messages**       | Good           | Excellent      | Variable | Poor           | Good      | Poor           | Good (Ts.Err)   |
| **IDE support**          | HLS            | rust-analyzer  | Metals   | Limited        | Effect LS | None           | Full TS/tsgo    |
| **Ecosystem compat.**    | Hackage        | crates.io      | Maven    | npm            | npm       | npm            | npm             |
| **Incremental adoption** | All or nothing | All or nothing | Gradual  | All or nothing | Gradual   | All or nothing | Tier-by-tier    |
| **tsgo compatible**      | N/A            | N/A            | N/A      | Yes            | Yes       | N/A (removed)  | Yes (by design) |
| **Bundle impact**        | N/A            | N/A            | N/A      | Medium         | Medium    | Large          | Zero to Small   |

### 10.4 Trade-Off Summary

**TRAITOR v2 Tier 1** occupies a unique niche: it is the only system that provides compile-time typeclass dispatch with zero runtime cost in TypeScript. No other TypeScript library does this. The closest analog is Haskell's typeclasses, but those require a compiler. Tier 1 achieves the same effect using TypeScript's declaration merging -- a feature that already exists and is stable.

**TRAITOR v2 Tier 2** is essentially Effect's approach refined. The main improvements over Effect's @effect/typeclass are: simpler TypeLambda (3 slots vs. 5), integration with kitz's Kind system, and the `withDefaults` pattern for default methods.

**TRAITOR v2 Tier 3** is novel. No TypeScript library currently generates dispatch code from type-level registries. The closest analog is Rust's derive macros, but those operate at the AST level. Tier 3 operates at the type level, which is both its strength (type-safe) and its weakness (requires parsing type declarations).

---

## 11. Recommended Path Forward

### 11.1 Implementation Order

**Phase 1: Stabilize Tier 1 (type-level only)**

1. Extract the Display pattern into a reusable `defineTrait` helper.
2. Implement `Eq`, `Ord`, and `Mappable` as Tier 1 traits.
3. Add coherence detection to the dispatch type.
4. Add the superclass constraint pattern.
5. Document the pattern so other kitz packages can define their own Tier 1 traits.

**Estimated scope:** ~500 lines of type-level code. No runtime code. No breaking changes.

**Phase 2: Build Tier 2 alongside**

1. Define the `TypeLambda` + `KindOf` extension to the Kind system.
2. Implement `Eq`, `Ord` as Tier 2 interfaces with primitive instances.
3. Implement `Covariant`, `Applicative`, `FlatMap`, `Monad`, `Foldable`, `Traversable` as Tier 2 interfaces.
4. Provide `ArrayTypeLambda` and array instances.
5. Add the `struct` combinator for product-type derivation.
6. Add the `withDefaults` pattern to each typeclass.

**Estimated scope:** ~1,500 lines. All tree-shakeable. Incremental -- each typeclass is independent.

**Phase 3: Tier 3 (codegen) -- future**

1. Design the `KITZ.Traits.*.Instances` registration interface.
2. Build the codegen tool (tsgo-safe, compiler-API-independent).
3. Generate dispatch modules for Eq, Ord.
4. Add `@derive` JSDoc directive support.

**Estimated scope:** ~1,000 lines of codegen tooling + generated output. This is the most experimental phase and should be deferred until Tier 1 and Tier 2 are proven in practice.

### 11.2 What NOT to Build

1. **No global mutable registry.** TRAITOR v1's biggest mistake.
2. **No Proxy-based dispatch.** Runtime magic that defeats tree-shaking.
3. **No module-level side effects.** `sideEffects: false` is sacred.
4. **No deep class hierarchies.** Composition via intersection > inheritance.
5. **No exhaustive typeclass hierarchy.** Start with Eq, Ord, Covariant. Add more only when there is a concrete consumer.

### 11.3 Success Criteria

TRAITOR v2 succeeds if:

1. **Tier 1 traits can be defined and extended with <20 lines of boilerplate per trait.**
2. **Tier 2 instances are as easy to use as Effect's, with better tree-shaking.**
3. **Bundle size impact of using Tier 2 is zero unless you actually import an instance.**
4. **The pattern is documented clearly enough that kitz package authors can define their own typeclasses without reading this design doc.**
5. **Third-party extensions (orphan instances) work without any coordination with kitz.**

---

## Appendices

### A. Complete Tier 1 Trait: Hashable

A full worked example of a Tier 1 trait from scratch.

````typescript
// packages/core/src/ts/traits/hashable.ts

/**
 * Type-level Hashable trait.
 *
 * Determines whether a type has a well-defined hash operation.
 * Used for compile-time validation that a type can be used as a
 * Map/Set key with structural semantics.
 *
 * Returns `true` if the type is hashable, `never` otherwise.
 */

type HandlersResult<$Type> =
  [keyof KITZ.Traits.Hashable.Handlers<$Type>] extends [never] ? never
    : KITZ.Traits.Hashable.Handlers<
      $Type
    >[keyof KITZ.Traits.Hashable.Handlers<$Type>]

/**
 * Check if a type is hashable at the type level.
 *
 * Primitives are always hashable. Objects are hashable if a handler is registered.
 *
 * @example
 * ```typescript
 * type R1 = Ts.Hashable<string>   // true
 * type R2 = Ts.Hashable<number>   // true
 * type R3 = Ts.Hashable<object>   // false (no handler)
 * type R4 = Ts.Hashable<MyType>   // true (if handler registered)
 * ```
 */
export type Hashable<$Type> =
  // Primitives are always hashable
  $Type extends string | number | boolean | bigint | null | undefined | symbol
    ? true
    // Check handlers for objects
    : [HandlersResult<$Type>] extends [never] ? never // Not hashable
    : HandlersResult<$Type>

/**
 * Constraint type: require that T is Hashable.
 */
export type RequireHashable<$Type> = Hashable<$Type> extends true ? $Type
  : Ts.Err.StaticError<
    `Type ${Ts.Display<
      $Type
    >} is not Hashable. Register a handler in KITZ.Traits.Hashable.Handlers.`
  >

declare global {
  namespace KITZ.Traits {
    namespace Hashable {
      interface Handlers<$Type> {}
    }
  }
}
````

Registering an instance for a custom type:

```typescript
// In my-app/src/types/user-id.ts
import type { Brand } from 'effect'

type UserId = string & Brand.Brand<'UserId'>

declare global {
  namespace KITZ.Traits.Hashable {
    interface Handlers<$Type> {
      _userId: $Type extends UserId ? true : never
    }
  }
}
```

Using the constraint:

```typescript
// A type-safe Map that only accepts Hashable keys
type SafeMap<K extends RequireHashable<K>, V> = Map<K, V>

// OK:
type M1 = SafeMap<string, number>

// Compile error:
type M2 = SafeMap<{ x: 1 }, number>
// Error: Type '{ x: 1 }' is not Hashable.
// Register a handler in KITZ.Traits.Hashable.Handlers.
```

### B. Complete Tier 2 Trait: Semigroup + Monoid

A full worked example of a Tier 2 typeclass with superclass and defaults.

```typescript
// packages/core/src/traits/semigroup.ts

/**
 * Semigroup typeclass.
 *
 * A type with an associative binary operation.
 *
 * Law: combine(combine(a, b), c) === combine(a, combine(b, c))
 */
export interface Semigroup<A> {
  readonly combine: (self: A, that: A) => A
}

export declare namespace Semigroup {
  /**
   * Semigroup with additional derived operations.
   */
  interface Full<A> extends Semigroup<A> {
    readonly combineMany: (self: A, collection: Iterable<A>) => A
  }
}

/**
 * Add default methods to a Semigroup.
 */
export const withDefaults = <A>(base: Semigroup<A>): Semigroup.Full<A> => ({
  ...base,
  combineMany: (self, collection) => {
    let result = self
    for (const item of collection) {
      result = base.combine(result, item)
    }
    return result
  },
})

// --- Primitive instances ---

export const string: Semigroup<string> = {
  combine: (self, that) => self + that,
}

export const numberSum: Semigroup<number> = {
  combine: (self, that) => self + that,
}

export const numberProduct: Semigroup<number> = {
  combine: (self, that) => self * that,
}

export const booleanAll: Semigroup<boolean> = {
  combine: (self, that) => self && that,
}

export const booleanAny: Semigroup<boolean> = {
  combine: (self, that) => self || that,
}

// --- Combinators ---

export const array = <A>(): Semigroup<ReadonlyArray<A>> => ({
  combine: (self, that) => [...self, ...that],
})

export const struct = <A extends Record<string, unknown>>(
  fields: { [K in keyof A]: Semigroup<A[K]> },
): Semigroup<A> => ({
  combine: (self, that) => {
    const result = {} as Record<string, unknown>
    for (const key of Object.keys(fields)) {
      result[key] = (fields as any)[key].combine(
        (self as any)[key],
        (that as any)[key],
      )
    }
    return result as A
  },
})
```

```typescript
// packages/core/src/traits/monoid.ts

import type { Semigroup } from './semigroup.js'

/**
 * Monoid typeclass.
 *
 * A Semigroup with an identity element.
 *
 * Laws:
 * - Left identity:  combine(empty, a) === a
 * - Right identity: combine(a, empty) === a
 * - Associativity:  (from Semigroup)
 */
export interface Monoid<A> extends Semigroup<A> {
  readonly empty: A
}

export declare namespace Monoid {
  interface Full<A> extends Monoid<A>, Semigroup.Full<A> {
    readonly combineAll: (collection: Iterable<A>) => A
  }
}

export const withDefaults = <A>(base: Monoid<A>): Monoid.Full<A> => ({
  ...Semigroup.withDefaults(base),
  ...base,
  combineAll: (collection) => {
    let result = base.empty
    for (const item of collection) {
      result = base.combine(result, item)
    }
    return result
  },
})

// --- Primitive instances ---

export const string: Monoid<string> = {
  ...Semigroup.string,
  empty: '',
}

export const numberSum: Monoid<number> = {
  ...Semigroup.numberSum,
  empty: 0,
}

export const numberProduct: Monoid<number> = {
  ...Semigroup.numberProduct,
  empty: 1,
}

// --- Combinators ---

export const array = <A>(): Monoid<ReadonlyArray<A>> => ({
  ...Semigroup.array<A>(),
  empty: [],
})

export const struct = <A extends Record<string, unknown>>(
  fields: { [K in keyof A]: Monoid<A[K]> },
): Monoid<A> => ({
  ...Semigroup.struct(fields),
  empty: Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, (v as Monoid<unknown>).empty]),
  ) as A,
})
```

Usage:

```typescript
import { Monoid } from '@kitz/core/traits'

// Use primitive instance
const sum = Monoid.withDefaults(Monoid.numberSum)
sum.combineAll([1, 2, 3, 4, 5]) // 15

// Derive for a struct
interface Stats {
  count: number
  total: number
  label: string
}

const MonoidStats = Monoid.withDefaults(Monoid.struct<Stats>({
  count: Monoid.numberSum,
  total: Monoid.numberSum,
  label: Monoid.string,
}))

MonoidStats.combineAll([
  { count: 1, total: 10, label: 'a' },
  { count: 2, total: 20, label: 'b' },
])
// { count: 3, total: 30, label: 'ab' }
```

### C. Complete Tier 2 HKT Trait: Traversable

A higher-kinded typeclass showing the full TypeLambda integration.

````typescript
// packages/core/src/fn/type-lambda.ts

/**
 * TypeLambda -- a type constructor witness.
 *
 * Each concrete generic type (Array, Option, Effect, etc.) defines
 * a TypeLambda that encodes how its type parameters are positioned.
 */
export interface TypeLambda {
  /** Contravariant input position (e.g., R in Effect<A, E, R>) */
  readonly In: unknown
  /** Second covariant output (e.g., E in Effect<A, E, R>) */
  readonly Out2: unknown
  /** Primary covariant output (e.g., A in Effect<A, E, R>) */
  readonly Out1: unknown
  /** The concrete type this lambda produces */
  readonly Target: unknown
}

/**
 * Apply a TypeLambda to concrete type arguments.
 *
 * @example
 * ```typescript
 * interface ArrayTL extends TypeLambda {
 *   readonly Target: Array<this['Out1']>
 * }
 *
 * type R = KindOf<ArrayTL, unknown, never, string>
 * // R = Array<string>
 * ```
 */
export type KindOf<F extends TypeLambda, In, Out2, Out1> =
  (F & { readonly In: In; readonly Out2: Out2; readonly Out1: Out1 })['Target']
````

```typescript
// packages/core/src/traits/traversable.ts

import type { KindOf, TypeLambda } from '#fn/type-lambda'
import type { Applicative } from './applicative.js'
import type { Covariant } from './covariant.js'

/**
 * Foldable typeclass.
 *
 * A type constructor that can be folded into a single value.
 */
export interface Foldable<F extends TypeLambda> {
  readonly reduce: {
    <In, Out2, A, B>(
      self: KindOf<F, In, Out2, A>,
      initial: B,
      f: (acc: B, a: A) => B,
    ): B
    <A, B>(
      initial: B,
      f: (acc: B, a: A) => B,
    ): <In, Out2>(self: KindOf<F, In, Out2, A>) => B
  }
}

/**
 * Traversable typeclass.
 *
 * A Foldable Functor where each element can be visited with an
 * effectful function, and the effects are collected.
 *
 * Laws:
 * - Naturality: traverse(t)(fa, f) in G2 ===
 *               nt(traverse(t)(fa, f)) in G1 (for natural transformation nt)
 * - Identity: traverse(Identity)(fa, Identity) === Identity(fa)
 * - Composition: traverse(Compose(F, G))(fa, Compose(f, g)) ===
 *                Compose(traverse(F)(fa, f), traverse(G)(fa, g))
 */
export interface Traversable<F extends TypeLambda>
  extends Foldable<F>, Covariant<F>
{
  readonly traverse: <G extends TypeLambda>(
    A: Applicative<G>,
  ) => {
    <In1, Out21, A, In2, Out22, B>(
      self: KindOf<F, In1, Out21, A>,
      f: (a: A) => KindOf<G, In2, Out22, B>,
    ): KindOf<G, In2, Out22, KindOf<F, In1, Out21, B>>
    <A, In2, Out22, B>(
      f: (a: A) => KindOf<G, In2, Out22, B>,
    ): <In1, Out21>(
      self: KindOf<F, In1, Out21, A>,
    ) => KindOf<G, In2, Out22, KindOf<F, In1, Out21, B>>
  }

  readonly sequence: <G extends TypeLambda>(
    A: Applicative<G>,
  ) => <In1, Out21, In2, Out22, A>(
    self: KindOf<F, In1, Out21, KindOf<G, In2, Out22, A>>,
  ) => KindOf<G, In2, Out22, KindOf<F, In1, Out21, A>>
}

// Default sequence from traverse
export const sequenceFromTraverse = <F extends TypeLambda>(
  T: Pick<Traversable<F>, 'traverse'>,
): Traversable<F>['sequence'] =>
(A) =>
(self) => T.traverse(A)(self, (x: any) => x)
```

Array instance:

```typescript
// packages/core/src/arr/instances.ts

import { dual } from '#fn/fn'
import type { KindOf, TypeLambda } from '#fn/type-lambda'
import type { Applicative } from '#traits/applicative'
import type { Covariant } from '#traits/covariant'
import type { Foldable } from '#traits/foldable'
import type { Traversable } from '#traits/traversable'

export interface ArrayTypeLambda extends TypeLambda {
  readonly Target: Array<this['Out1']>
}

export const CovariantArray: Covariant<ArrayTypeLambda> = {
  map: dual(2, <A, B>(self: Array<A>, f: (a: A) => B): Array<B> => self.map(f)),
}

export const FoldableArray: Foldable<ArrayTypeLambda> = {
  reduce: dual(
    3,
    <A, B>(self: Array<A>, initial: B, f: (acc: B, a: A) => B): B =>
      self.reduce(f, initial),
  ),
}

export const TraversableArray: Traversable<ArrayTypeLambda> = {
  ...CovariantArray,
  ...FoldableArray,
  traverse: <G extends TypeLambda>(A: Applicative<G>) =>
    dual(2, <In1, Out21, A_, In2, Out22, B>(
      self: KindOf<ArrayTypeLambda, In1, Out21, A_>,
      f: (a: A_) => KindOf<G, In2, Out22, B>,
    ): KindOf<G, In2, Out22, KindOf<ArrayTypeLambda, In1, Out21, B>> => {
      const arr = self as A_[]
      return arr.reduce(
        (acc, a) =>
          A.ap(
            A.map(acc, (bs: B[]) => (b: B) => [...bs, b]),
            f(a),
          ),
        A.of([] as B[]) as any,
      )
    }),
  sequence: (A) => (self) =>
    (self as any[]).reduce(
      (acc: any, ga: any) =>
        A.ap(
          A.map(acc, (bs: any[]) => (b: any) => [...bs, b]),
          ga,
        ),
      A.of([]),
    ),
}
```

### D. TypeLambda Cheat Sheet

```typescript
// ---- For * -> * type constructors ----

// Array<A>
interface ArrayTL extends TypeLambda {
  readonly Target: Array<this['Out1']>
}

// ReadonlyArray<A>
interface ReadonlyArrayTL extends TypeLambda {
  readonly Target: ReadonlyArray<this['Out1']>
}

// Promise<A>
interface PromiseTL extends TypeLambda {
  readonly Target: Promise<this['Out1']>
}

// Set<A>
interface SetTL extends TypeLambda {
  readonly Target: Set<this['Out1']>
}

// ---- For * -> * -> * type constructors ----

// Map<K, V>  -- K in Out2, V in Out1
interface MapTL extends TypeLambda {
  readonly Target: Map<this['Out2'], this['Out1']>
}

// Either<E, A>  -- E in Out2, A in Out1
interface EitherTL extends TypeLambda {
  readonly Target: Either<this['Out2'], this['Out1']>
}

// ---- For * -> * -> * -> * type constructors ----

// Effect<A, E, R>  -- A in Out1, E in Out2, R in In
interface EffectTL extends TypeLambda {
  readonly Target: Effect<this['Out1'], this['Out2'], this['In']>
}
```

### E. Relationship to Existing kitz Patterns

| Existing Pattern                      | TRAITOR v2 Equivalent                         |
| ------------------------------------- | --------------------------------------------- |
| `KITZ.Traits.Display.Handlers<$Type>` | Tier 1 trait (already is one)                 |
| `KITZ.Simplify.Traversables`          | Tier 1 trait (extensible traversal)           |
| `KITZ.Ts.PreserveTypes`               | Tier 1 trait (type preservation set)          |
| `KITZ.Perf.Settings`                  | Not a trait -- global config                  |
| `Kind.Apply<F, [A]>`                  | Foundation for Tier 2 HKT                     |
| `Kind.Pipe<Ks, I>`                    | Type-level composition (Tier 1)               |
| Effect Schema `TaggedClass`           | Source for Tier 2 instance derivation         |
| `Err.TaggedContextualError`           | Not a trait (but could have Display instance) |

The existing kitz codebase has been using Tier 1 patterns (declaration merging for extensibility) for months. TRAITOR v2 formalizes this into a coherent system and adds Tier 2 for runtime needs.

### F. Glossary

| Term                    | Definition                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Typeclass**           | An interface that defines operations for a type (or type constructor), with instances provided separately from the type definition. |
| **Instance**            | A concrete implementation of a typeclass for a specific type.                                                                       |
| **Coherence**           | The property that at most one instance exists for each type-typeclass combination.                                                  |
| **Orphan instance**     | An instance defined in a module that owns neither the typeclass nor the type.                                                       |
| **Superclass**          | A typeclass that another typeclass depends on (e.g., Eq is a superclass of Ord).                                                    |
| **Default method**      | A method provided by the typeclass that can be derived from other methods.                                                          |
| **HKT**                 | Higher-Kinded Type -- a type that takes a type constructor as a parameter (e.g., `Functor<F>` where `F` is `Array` or `Promise`).   |
| **TypeLambda**          | kitz's encoding of a type constructor as an interface with `In`, `Out1`, `Out2`, `Target` fields.                                   |
| **Declaration merging** | TypeScript's feature where multiple `interface` declarations with the same name are merged into one.                                |
| **Tree-shaking**        | Bundler optimization that removes unused code from the final bundle.                                                                |
| **Tier 1**              | Type-level only typeclass using declaration merging. Zero runtime cost.                                                             |
| **Tier 2**              | Runtime typeclass with explicit instance passing. Perfect tree-shaking.                                                             |
| **Tier 3**              | Build-time codegen that generates Tier 2 dispatch from Tier 1 registries.                                                           |

---

## Sources

Research references used during this design exploration:

- [Encoding HKTs in TypeScript (Effect blog)](https://dev.to/effect/encoding-of-hkts-in-typescript-5c3) -- The canonical explanation of Effect's HKT encoding
- [hkt-core library](https://github.com/Snowflyt/hkt-core) -- Micro HKT implementation for TypeScript
- [hkt-ts library](https://github.com/TylorS/hkt-ts) -- HKT encoding with composable typeclasses
- [Effect-TS Core: ZIO-Prelude Inspired Typeclasses](https://dev.to/effect/effect-ts-core-zio-prelude-inspired-typeclasses-module-structure-50g6) -- Effect's typeclass architecture
- [Typeclasses in TypeScript (Paul Gray)](https://paulgray.net/typeclasses-in-typescript/) -- fp-ts typeclass patterns
- [fp-ts HKT Guide](https://gcanti.github.io/fp-ts/guides/HKT.html) -- Writing type class instances in fp-ts
- [fp-ts Tree Shaking Issue #1087](https://github.com/gcanti/fp-ts/issues/1087) -- Tree-shaking challenges
- [TypeScript Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) -- Official docs
- [Scala 3 Type Classes](https://docs.scala-lang.org/scala3/book/ca-type-classes.html) -- Given/using pattern
- [Scala 3 Type Class Derivation](https://docs.scala-lang.org/scala3/reference/contextual/derivation.html) -- Auto-derivation
- [OCaml Modular Implicits](https://www.cl.cam.ac.uk/~jdy22/papers/modular-implicits.pdf) -- Module-based typeclasses
- [OCaml Modular Explicits PR #13275](https://github.com/ocaml/ocaml/pull/13275) -- 2024 progress
- [Rust Traits and Static Dispatch](https://doc.rust-lang.org/book/ch18-02-trait-objects.html) -- Monomorphization
- [On the State of Coherence in Type Classes](https://www.arxiv.org/pdf/2502.20546) -- 2025 survey
- [The Trouble with Typeclasses (Paul Chiusano)](https://pchiusano.github.io/2018-02-13/typeclasses.html) -- Critical analysis
- [TypeScript HKT Proposal #44875](https://github.com/microsoft/TypeScript/issues/44875) -- Community proposal
- [TypeScript Performance Wiki](https://github.com/microsoft/Typescript/wiki/Performance) -- Type-level performance guidelines
