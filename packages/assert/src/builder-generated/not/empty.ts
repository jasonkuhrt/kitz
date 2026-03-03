import type { Fn } from '@kitz/core'
import { builder } from '../../builder-singleton.js'
import type { AssertEmptyKind } from '../../asserts.js'


/**
 * Unary relator (negated) - asserts type is NOT empty (`[]`, `''`, or `Record<PropertyKey, never>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.not.empty<[1]>
 * Assert.not.empty(value as string)
 *
 * // ✗ Fail
 * type _ = Assert.not.empty<[]>
 * Assert.not.empty(value as empty)
 * ```
 */
type empty_<$Actual> = Fn.Kind.Apply<AssertEmptyKind, [$Actual, true]>
const empty_ = builder.not.empty

export { empty_ as empty }
