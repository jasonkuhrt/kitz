import { Schema as S } from 'effect'

/**
 * Simple comparison operators used in semver comparators.
 *
 * Note: `''` means exact match (no operator).
 * Complex operators like `^` and `~` are expanded to simple forms during parsing.
 */
export const Operator = S.Enums(
  {
    /** Exact match (no operator) */
    eq: '',
    /** Less than */
    lt: '<',
    /** Less than or equal */
    lte: '<=',
    /** Greater than */
    gt: '>',
    /** Greater than or equal */
    gte: '>=',
  } as const,
)
export type Operator = typeof Operator.Type
