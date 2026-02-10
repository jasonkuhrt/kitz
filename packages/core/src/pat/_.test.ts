import { Test } from '#kitz/test'
import { Pat } from '#pat'
import * as S from 'effect/Schema'
import { expect } from 'vitest'

Test
  .on(Pat.isMatch)
  .describe('Literals', [
    [[1, 1], true],
    [['a', 'a'], true],
    [[true, true], true],
    [[null, null], true],
    [[1n, 1n], true],
    [[1, 2], false],
    [['a', 'b'], false],
  ])
  .describe('Regex', [
    [['a', /^a/], true],
    [['a', /^b/], false],
    [['a1', /\d$/], true],
  ])
  .describe('Effect Schemas', [
    [['a', S.String], true],
    [[1, S.String], false],
    [[1, S.Number], true],
    [['1', S.Number], false],
    [[true, S.Boolean], true],
    [[1, S.Boolean], false],
    [[1n, S.BigIntFromSelf], true],
    [[1, S.BigIntFromSelf], false],
    [[new Date('2024-01-01'), S.DateFromSelf], true],
    [['2024-01-01', S.DateFromSelf], false],
  ])
  .describe('String Constraints', [
    [['abc', { $length: 3 }], true],
    [['a', { $length: 3 }], false],
    [['abc', { $length: { $gte: 2, $lte: 5 } }], true],
    [['a', { $length: { $gte: 2 } }], false],
    [['abc', { $format: /^[a-z]+$/ }], true],
    [['A', { $format: /^[a-z]+$/ }], false],
    [['abc', { $length: 3, $format: /^[a-z]+$/ }], true],
    [['ABC', { $length: 3, $format: /^[a-z]+$/ }], false],
  ])
  .describe('Number Constraints', [
    [[5, { $gt: 0 }], true],
    [[0, { $gt: 0 }], false],
    [[5, { $gte: 5 }], true],
    [[4, { $gte: 5 }], false],
    [[5, { $lt: 10 }], true],
    [[10, { $lt: 10 }], false],
    [[10, { $lte: 10 }], true],
    [[5, { $eq: 5 }], true],
    [[4, { $eq: 5 }], false],
    [[5, { $gt: 0, $lt: 10 }], true],
    [[10, { $gte: 0, $lte: 10 }], true],
  ])
  .describe('Object Matching (Partial)', [
    [[{ a: 1, b: 2 }, { a: 1 }], true],
    [[{ a: 1, b: 2 }, { a: 2 }], false],
    [[{ a: 1, b: 2 }, { c: 3 }], false],
    [[{ x: { y: 1 } }, { x: { y: 1 } }], true],
    [[{ x: { y: 1 } }, { x: { y: 2 } }], false],
    [[{ a: 'x' }, { a: /^x/ }], true],
    [[{ a: 1 }, { a: { $gte: 0 } }], true],
    [[{ a: 'x', b: 1 }, { a: S.String, b: S.Number }], true],
    [[{ a: 'x', b: '1' }, { a: S.String, b: S.Number }], false],
    [[{}, {}], true],
  ])
  .describe('Array Constraints', [
    [[[1, 2, 3], { $some: { $gt: 2 } }], true],
    [[[1, 2], { $some: { $gt: 2 } }], false],
    [[[2, 3], { $every: { $gte: 2 } }], true],
    [[[1, 2], { $every: { $gte: 2 } }], false],
    [[['a', 'b'], { $every: S.String }], true],
    [[['a', 1], { $every: S.String }], false],
    [[[1, 2, 3], { $length: 3 }], true],
    [[[1, 2], { $length: 3 }], false],
    [[[1, 2, 3], { $length: { $gt: 2 } }], true],
    [[[2, 4, 6], { $some: { $gt: 5 }, $every: { $gte: 2 } }], true],
  ])
  .describe('Tuple Matching', [
    [[[1, 'a'], [1, 'a']], true],
    [[[1, 'b'], [1, 'a']], false],
    [[[1, 'a'], [S.Number, S.String]], true],
    [[[1, 2], [S.Number, S.String]], false],
    [[[1, 'a'], [{ $gt: 0 }, /^a/]], true],
    [[[-1, 'a'], [{ $gt: 0 }, /^a/]], false],
    [[[1, 2, 3], [1, 2]], false],
  ])
  .describe('Combinators > not', [
    [[1, { $not: S.String }], true],
    [['a', { $not: S.String }], false],
    [[1, { $not: 2 }], true],
    [[1, { $not: 1 }], false],
    [['b', { $not: /^a/ }], true],
    [['a', { $not: /^a/ }], false],
    [[0, { $not: { $gt: 0 } }], true],
    [[1, { $not: { $gt: 0 } }], false],
  ])
  .describe('Combinators > or', [
    [['a', { $or: [S.String, S.Number] }], true],
    [[1, { $or: [S.String, S.Number] }], true],
    [[true, { $or: [S.String, S.Number] }], false],
    [['a', { $or: ['a', 'b'] }], true],
    [['c', { $or: ['a', 'b', 'c'] }], true],
    [['d', { $or: ['a', 'b', 'c'] }], false],
    [[-1, { $or: [{ $lt: 0 }, { $gt: 10 }] }], true],
  ])
  .describe('Combinators > and', [
    [[{ a: 1, b: 2 }, { $and: [{ a: 1 }, { b: 2 }] }], true],
    [[{ a: 1, b: 3 }, { $and: [{ a: 1 }, { b: 2 }] }], false],
    [[5, { $and: [{ $gte: 0 }, { $lte: 10 }] }], true],
    [[-5, { $and: [{ $gte: 0 }, { $lte: 10 }] }], false],
  ])
  .describe('$ Prefix for Nested Combinators', [
    [[{ a: 'x' }, { a: { $not: /^b/ } }], true],
    [[{ a: 'b' }, { a: { $not: /^b/ } }], false],
    [[{ a: 'x' }, { a: { $or: ['x', 'y'] } }], true],
    [[{ a: 'z' }, { a: { $or: ['x', 'y'] } }], false],
    [[{ a: 5 }, { a: { $and: [{ $gte: 0 }, { $lt: 10 }] } }], true],
    [[{ a: 15 }, { a: { $and: [{ $gte: 0 }, { $lt: 10 }] } }], false],
    [[{ a: { b: 'x' } }, { a: { b: { $not: /^y/ } } }], true],
  ])
  .describe('$ Prefix > Ambiguous Top-Level', [
    [[{ $not: 'x', id: 1 }, { $not: 'x', id: 1 }], true],
    [[{ $not: 'y', id: 1 }, { $not: 'x', id: 1 }], false],
  ])
  .describe('Complex Nested Patterns', [
    [[
      { items: [{ x: 1, y: 'a' }, { x: 2, y: 'b' }], meta: { ok: true } },
      { items: { $every: { x: { $gt: 0 } } }, meta: { ok: true } },
    ], true],
  ])
  .test(({ input, output }) => {
    const [value, pattern] = input

    // Test base function
    expect(Pat.isMatch(value, pattern)).toBe(output)

    // Test curried variants - these should produce identical results
    expect(Pat.isMatchOn(value)(pattern)).toBe(output)
    expect(Pat.isMatchWith(pattern)(value)).toBe(output)
  })
