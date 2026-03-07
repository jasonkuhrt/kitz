/**
 * Minimal numeric utilities for core package.
 */

export { Allocation } from './allocation/_.js'

/**
 * Type predicate to check if value is a number.
 * Excludes NaN.
 */
export const is = (value: unknown): value is number => {
  return typeof value === 'number' && !Number.isNaN(value)
}

/**
 * Number literal type.
 */
export type Literal =
  | LiteralZero
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | LiteralInfinity

export type LiteralInfinity = -999999999999999

export type LiteralZero = 0

/**
 * Add one to a number literal type.
 */
export type PlusOne<$n extends Literal> = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  never,
][$n]

/**
 * Subtract one from a number literal type.
 */
export type MinusOne<$n extends Literal> = [
  never,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
][$n]

// oxfmt-ignore
export type NatDec<$N extends Literal> =
  $N extends LiteralInfinity          ? LiteralInfinity :
  $N extends LiteralZero              ? LiteralZero :
                                        MinusOne<$N>
