// @ts-expect-error Duplicate identifier
export * as Ref from './__.js'

/**
 * @module Ref
 *
 * Reference equality operations for objects, arrays, and functions.
 *
 * This module provides utilities for checking if two values are the same
 * reference in memory using JavaScript's === operator. It only works with
 * reference types - for primitive values, use the appropriate domain's Eq trait.
 *
 * @example
 * ```ts
 * import { Ref } from '@kitz/core'
 *
 * // Objects - must be same instance
 * const obj = { a: 1 }
 * Ref.is(obj, obj) // true
 * Ref.is({ a: 1 }, { a: 1 }) // false (different instances)
 *
 * // Arrays
 * const arr = [1, 2, 3]
 * Ref.is(arr, arr) // true
 * Ref.is([1, 2, 3], [1, 2, 3]) // false
 *
 * // Functions
 * const fn = () => {}
 * Ref.is(fn, fn) // true
 *
 * // Type checking
 * Ref.isReferenceEquality({ a: 1 }) // true (objects can have different references)
 * Ref.isReferenceEquality(42) // false (primitives cannot have different references)
 * ```
 */
export namespace Ref {}
