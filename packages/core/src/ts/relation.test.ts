/**
 * Type-level tests that also serve as documentation examples for GetRelation.
 *
 * This file ensures that the examples in the JSDoc stay accurate by testing them.
 * If these tests fail, the JSDoc examples in ts.ts need to be updated.
 *
 * The examples here should match exactly what's shown in the GetRelation JSDoc.
 */

import { Assert } from '#kitz/assert'
import { Ts } from '#ts'
import { test } from 'vitest'

const A = Assert.Type

test('GetRelation JSDoc examples', () => {
  // These match the examples in the JSDoc - if these fail, update the JSDoc!

  // Equivalent examples
  A.exact.ofAs<'equivalent'>().onAs<Ts.Relation.GetRelation<string, string>>()
  A.exact.ofAs<'equivalent'>().onAs<Ts.Relation.GetRelation<1, 1>>()
  A.exact.ofAs<'equivalent'>().onAs<Ts.Relation.GetRelation<{ a: 1 }, { a: 1 }>>()

  // Disjoint examples
  A.exact.ofAs<'disjoint'>().onAs<Ts.Relation.GetRelation<string, number>>()
  A.exact.ofAs<'overlapping'>().onAs<Ts.Relation.GetRelation<{ a: 1 }, { b: 2 }>>() // Note: This is actually 'overlapping', not 'disjoint'!

  // Overlapping examples
  A.exact.ofAs<'overlapping'>().onAs<Ts.Relation.GetRelation<{ a: 1; id: 1 }, { b: 2; id: 1 }>>()

  // Subtype examples (B is narrower than A)
  A.exact.ofAs<'subtype'>().onAs<Ts.Relation.GetRelation<'a' | 'b', 'a'>>()

  // Supertype examples (B is wider than A)
  A.exact.ofAs<'supertype'>().onAs<Ts.Relation.GetRelation<'a', 'a' | 'b'>>()
})

test('GetRelation additional examples for clarity', () => {
  // More subtype examples
  A.exact.ofAs<'subtype'>().onAs<Ts.Relation.GetRelation<string | number, string>>()
  A.exact.ofAs<'subtype'>().onAs<Ts.Relation.GetRelation<unknown, string>>()
  A.exact.ofAs<'equivalent'>().onAs<Ts.Relation.GetRelation<any, string>>() // any is special

  // More supertype examples
  A.exact.ofAs<'supertype'>().onAs<Ts.Relation.GetRelation<string, string | number>>()
  A.exact.ofAs<'supertype'>().onAs<Ts.Relation.GetRelation<string, unknown>>()
  A.exact.ofAs<'supertype'>().onAs<Ts.Relation.GetRelation<42, number>>()

  // Primitive vs object is always disjoint
  A.exact.ofAs<'disjoint'>().onAs<Ts.Relation.GetRelation<string, { x: 1 }>>()
  A.exact.ofAs<'disjoint'>().onAs<Ts.Relation.GetRelation<number, []>>()
})
