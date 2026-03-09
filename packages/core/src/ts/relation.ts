/**
 * Type relationship utilities for analyzing how types relate to each other.
 *
 * This module provides utilities for checking various type relationships
 * including structural equality, subtyping, and type compatibility.
 */

import type { Lang } from '#lang'

export namespace Relation {
  export type Relation = equivalent | subtype | supertype | overlapping | disjoint

  /**
   * Type constant for equivalent relation.
   */
  export type equivalent = 'equivalent'

  /**
   * Type constant for subtype relation.
   */
  export type subtype = 'subtype'

  /**
   * Type constant for supertype relation.
   */
  export type supertype = 'supertype'

  /**
   * Type constant for overlapping relation.
   */
  export type overlapping = 'overlapping'

  /**
   * Type constant for disjoint relation.
   */
  export type disjoint = 'disjoint'

  /**
   * Check if two types are structurally equal (exact match).
   *
   * Uses a conditional type inference trick to detect exact structural equality.
   * This is more strict than bidirectional extends (mutual assignability) as it
   * checks the actual structure, not just compatibility.
   *
   * Note: This is different from {@link IsEquivalent} which only checks mutual
   * assignability. Two types can be mutually assignable without being structurally
   * equal (e.g., `string & {}` and `string` are equivalent but not exact).
   *
   * @example
   * ```ts
   * type T1 = Relation.IsExact<string, string> // true
   * type T2 = Relation.IsExact<1 | 2, 2 | 1> // true (union order doesn't matter)
   * type T3 = Relation.IsExact<string & {}, string> // false (different structure)
   * type T4 = Relation.IsExact<any, unknown> // false
   * type T5 = Relation.IsExact<{ a: 1 }, { a: 1 }> // true
   * ```
   */
  export type IsExact<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

  /**
   * Check if types are mutually assignable (equivalent).
   *
   * Returns true if A extends B AND B extends A. This means the types
   * can be used interchangeably in assignments, though they may not
   * have the same structure.
   *
   * @example
   * ```ts
   * type T1 = Relation.IsEquivalent<string, string> // true
   * type T2 = Relation.IsEquivalent<1 | 2, 2 | 1> // true
   * type T3 = Relation.IsEquivalent<string & {}, string> // true (both compute to string)
   * type T4 = Relation.IsEquivalent<string, number> // false
   * ```
   */
  export type IsEquivalent<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

  /**
   * Check if B is a subtype of A (B extends A, B is narrower than A).
   *
   * @example
   * ```ts
   * type T1 = Relation.IsSubtype<string, 'hello'> // true ('hello' extends string)
   * type T2 = Relation.IsSubtype<'hello', string> // false (string doesn't extend 'hello')
   * type T3 = Relation.IsSubtype<number | string, number> // true (number extends number | string)
   * ```
   */
  export type IsSubtype<A, B> = [B] extends [A] ? true : false

  /**
   * Check if B is a supertype of A (A extends B, B is wider than A).
   *
   * @example
   * ```ts
   * type T1 = Relation.IsSupertype<'hello', string> // true (string is supertype of 'hello')
   * type T2 = Relation.IsSupertype<string, 'hello'> // false ('hello' is not supertype of string)
   * type T3 = Relation.IsSupertype<number, number | string> // true
   * ```
   */
  export type IsSupertype<A, B> = [A] extends [B] ? true : false

  /**
   * Check if types have overlapping values (their intersection is not empty).
   *
   * @example
   * ```ts
   * type T1 = Relation.IsOverlapping<{ a: 1 }, { b: 2 }> // true (can have both properties)
   * type T2 = Relation.IsOverlapping<string, number> // false (no overlap)
   * type T3 = Relation.IsOverlapping<{ id: 1; a: 2 }, { id: 1; b: 3 }> // true (share id)
   * ```
   */
  export type IsOverlapping<A, B> = [A & B] extends [never] ? false : true

  /**
   * Check if types are disjoint (no common values).
   *
   * @example
   * ```ts
   * type T1 = Relation.IsDisjoint<string, number> // true (no common values)
   * type T2 = Relation.IsDisjoint<{ a: 1 }, { b: 2 }> // false (can have both properties)
   * type T3 = Relation.IsDisjoint<'a', 'b'> // true (different literals)
   * ```
   */
  export type IsDisjoint<A, B> = [A & B] extends [never] ? true : false

  /**
   * Classify how the SECOND type parameter relates to the FIRST type parameter.
   *
   * Returns one of:
   * - `'subtype'` - B is a subtype of A (B extends A, B is narrower/more specific than A).
   *   See: {@link https://en.wikipedia.org/wiki/Subtyping | Subtyping on Wikipedia}
   *
   * - `'supertype'` - B is a supertype of A (A extends B, B is wider/more general than A).
   *   This is the inverse of subtyping. See: {@link https://en.wikipedia.org/wiki/Subtyping#Subsumption | Subsumption}
   *
   * - `'equivalent'` - A and B are mutually assignable (both extend each other).
   *   Also known as type equality in structural type systems.
   *   See: {@link https://en.wikipedia.org/wiki/Type_system#Type_equivalence | Type Equivalence}
   *
   * - `'overlapping'` - Types share some possible values but neither is a subtype of the other.
   *   Common in structural typing where types can share properties without a subtype relationship.
   *   See: {@link https://www.typescriptlang.org/docs/handbook/type-compatibility.html | TypeScript Type Compatibility}
   *
   * - `'disjoint'` - Types have no values in common (their intersection is empty/never).
   *   See: {@link https://en.wikipedia.org/wiki/Disjoint_union | Disjoint Sets Theory}
   *
   * @remarks
   * This utility analyzes type relationships based on TypeScript's structural type system,
   * where type compatibility is determined by structure rather than declaration.
   *
   * For more on type relations in programming languages, see:
   * - {@link https://en.wikipedia.org/wiki/Type_theory | Type Theory on Wikipedia}
   * - {@link https://www.cs.cornell.edu/courses/cs4110/2012fa/lectures/lecture25.pdf | Cornell CS - Subtyping}
   * - {@link https://www.typescriptlang.org/docs/handbook/type-compatibility.html | TypeScript Handbook}
   *
   * @example
   * ```ts
   * // Read as: "How does the second type relate to the first?"
   * type T1 = Relation.GetRelation<string, string> // Relation.equivalent
   * type T2 = Relation.GetRelation<1, 1> // Relation.equivalent
   * type T3 = Relation.GetRelation<string, number> // Relation.disjoint
   * type T4 = Relation.GetRelation<{a: 1}, {b: 2}> // Relation.overlapping (objects can have both properties)
   * type T5 = Relation.GetRelation<{a: 1, id: 1}, {b: 2, id: 1}> // Relation.overlapping
   * type T6 = Relation.GetRelation<{a: 1}, {a: 1}> // Relation.equivalent
   * type T7 = Relation.GetRelation<'a' | 'b', 'a'> // Relation.subtype ('a' is narrower than 'a' | 'b')
   * type T8 = Relation.GetRelation<'a', 'a' | 'b'> // Relation.supertype ('a' | 'b' is wider than 'a')
   * ```
   */
  // oxfmt-ignore
  export type GetRelation<A, B> =
    // First check: Are types equivalent (mutually assignable)?
    // Using [A] extends [B] with brackets prevents union distribution - we want to check
    // the whole union type as a single unit, not distribute over union members.
    // Without brackets, `('a' | 'b') extends 'a'` would distribute and check each member separately.
    [A] extends [B] ? [B] extends [A] ?
      equivalent // Both extend each other - types are mutually assignable
    : supertype   // A extends B but not vice versa - B is wider/supertype of A

    // Second check: Is B a subtype of A?
    : [B] extends [A] ? subtype  // B extends A - B is narrower/subtype of A

    // Neither extends the other - need special handling for edge cases.
    // TypeScript's type system treats primitive and non-primitive as fundamentally different categories.
    // A primitive can never be the same reference as an object, making them always disjoint.
    : A extends Lang.Primitive ?
        B extends Lang.Primitive ?
          // Both are primitives - check if their intersection is empty.
          // Primitives can only overlap if they share literal values.
          // Examples:
          // - 'a' & 'b' = never (disjoint literals)
          // - string & 'hello' = 'hello' (overlapping - 'hello' is in string)
          // - string & number = never (disjoint base types)
          [A & B] extends [never] ? disjoint : overlapping
        : disjoint  // Primitive vs object - always disjoint (no possible overlap between value and reference types)

      : B extends Lang.Primitive ? disjoint  // Object vs primitive - always disjoint

      // Both are non-primitives (objects/interfaces).
      // Objects can have overlapping properties even if neither extends the other.
      // Example: {a: 1} and {b: 2} don't extend each other, but {a: 1, b: 2} satisfies both.
      // We check if their intersection is never to determine if they're completely incompatible.
      : [A & B] extends [never] ? disjoint : overlapping
}
