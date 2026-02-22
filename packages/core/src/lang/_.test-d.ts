import type { Type as A } from '#kitz/assert/assert'
import { Ts } from '#ts'

//
// ─── GetRelation (deprecated GetVariance) ──────────────────────────────────────────────────
//

// 'subtype' cases - B is a subtype of A (B extends A)
type _ = A.Cases<
  A.sub.of<'subtype', Ts.Relation.GetRelation<'a' | 'b', 'a'>>,
  A.sub.of<'subtype', Ts.Relation.GetRelation<{ a: 1 }, { a: 1; b: 2 }>>,
  A.sub.of<'subtype', Ts.Relation.GetRelation<unknown, string>>
>

// 'supertype' cases - A is a subtype of B (A extends B)
type _s = A.Cases<
  A.sub.of<'supertype', Ts.Relation.GetRelation<'a', 'a' | 'b'>>,
  A.sub.of<'supertype', Ts.Relation.GetRelation<{ a: 1; b: 2 }, { a: 1 }>>,
  A.sub.of<'supertype', Ts.Relation.GetRelation<string, unknown>>,
  A.sub.of<'supertype', Ts.Relation.GetRelation<42, number>>
>

// 'overlapping' cases - Objects share properties but neither is a subtype
type _so = A.Cases<
  A.sub.of<'overlapping', Ts.Relation.GetRelation<{ a: 1; id: string }, { b: 2; id: string }>>,
  A.sub.of<'overlapping', Ts.Relation.GetRelation<{ x: number; y: number }, { x: number; z: string }>>,
  A.sub.of<
    'overlapping',
    Ts.Relation.GetRelation<{ name: string; age: number }, { name: string; city: string }>
  >
>

// 'equivalent' cases - identical types (both primitive and structure)
type __ = A.Cases<
  A.sub.of<'equivalent', Ts.Relation.GetRelation<any, number>>, // any and number are equivalent
  A.sub.of<'equivalent', Ts.Relation.GetRelation<any, [1]>>, // any and array are equivalent
  // Same primitive types
  A.sub.of<'equivalent', Ts.Relation.GetRelation<string, string>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<number, number>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<boolean, boolean>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<bigint, bigint>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<symbol, symbol>>,
  // Same literal primitives
  A.sub.of<'equivalent', Ts.Relation.GetRelation<1, 1>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<'hello', 'hello'>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<true, true>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<false, false>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<null, null>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<undefined, undefined>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<123n, 123n>>,
  // Same object/function types
  A.sub.of<'equivalent', Ts.Relation.GetRelation<{}, {}>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<{ a: 1 }, { a: 1 }>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<{ a: 1; b: 'x' }, { a: 1; b: 'x' }>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<[], []>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<[1, 2, 3], [1, 2, 3]>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<() => void, () => void>>,
  A.sub.of<'equivalent', Ts.Relation.GetRelation<(x: string) => number, (x: string) => number>>
>

// 'disjoint' cases - types with no intersection
type ____ = A.Cases<
  // Different primitive types
  A.sub.of<'disjoint', Ts.Relation.GetRelation<string, number>>,
  A.sub.of<'disjoint', Ts.Relation.GetRelation<'a', 'b'>>,
  A.sub.of<'disjoint', Ts.Relation.GetRelation<1, 2>>,
  A.sub.of<'disjoint', Ts.Relation.GetRelation<true, false>>,
  A.sub.of<'disjoint', Ts.Relation.GetRelation<string, boolean>>,
  A.sub.of<'disjoint', Ts.Relation.GetRelation<number, null>>,
  // Objects with no shared properties - these have intersection (can be same object with both properties)
  A.sub.of<'overlapping', Ts.Relation.GetRelation<{ a: 1 }, { b: 2 }>>,
  A.sub.of<'overlapping', Ts.Relation.GetRelation<{ x: string }, { y: number }>>,
  A.sub.of<'overlapping', Ts.Relation.GetRelation<{ cat: 'meow' }, { dog: 'bark' }>>,
  // Primitive vs object - TypeScript doesn't reduce these to never
  A.sub.of<'disjoint', Ts.Relation.GetRelation<string, { x: 1 }>>,
  A.sub.of<'disjoint', Ts.Relation.GetRelation<number, { x: 1 }>>,
  A.sub.of<'disjoint', Ts.Relation.GetRelation<boolean, { a: string }>>
>
