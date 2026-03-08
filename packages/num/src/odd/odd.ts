/**
 * Odd integer brand and operations.
 * An odd integer is not divisible by 2.
 */

import type { Int } from '../int/__.js'
import { is as isInt } from '../int/__.js'

import type { Brand } from 'effect'

/**
 * Odd integer.
 * Note: This stacks with Int brand to allow Int & Odd.
 */
export type Odd = number & Brand.Brand<'Odd'>

/**
 * Type predicate to check if value is odd.
 * Returns Odd & Int when the value is an odd integer.
 */
export const is = (value: unknown): value is Odd & Int => {
  return isInt(value) && value % 2 !== 0
}

/**
 * Construct an Odd integer.
 * Throws if the value is not an odd integer.
 */
export const from = (value: number): Odd & Int => {
  if (!Number.isInteger(value)) {
    throw new Error(`Value must be an integer, got: ${value}`)
  }
  if (value % 2 === 0) {
    throw new Error(`Value must be odd, got: ${value}`)
  }
  return value as Odd & Int
}

/**
 * Try to construct an Odd integer.
 * Returns null if the value is not an odd integer.
 */
export const tryFrom = (value: number): (Odd & Int) | null => {
  return Number.isInteger(value) && value % 2 !== 0 ? (value as Odd & Int) : null
}

/**
 * Get the next odd number (rounds up if even).
 */
export const next = (value: number): Odd & Int => {
  const int = Math.ceil(value)
  return from(int % 2 !== 0 ? int : int + 1)
}

/**
 * Get the previous odd number (rounds down if even).
 */
export const prev = (value: number): Odd & Int => {
  const int = Math.floor(value)
  return from(int % 2 !== 0 ? int : int - 1)
}
