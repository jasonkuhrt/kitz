import type { Fn } from '@kitz/core'
import { builder } from '../builder-singleton.js'
import type { AssertEmptyKind } from '../asserts.js'


/**
 * Unary relator - asserts type is empty (`[]`, `''`, or `Record<PropertyKey, never>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.empty<[]>
 * Assert.empty(value as empty)
 *
 * // ✗ Fail
 * type _ = Assert.empty<[1]>
 * Assert.empty(value as string)
 * ```
 */
type empty_<$Actual> = Fn.Kind.Apply<AssertEmptyKind, [$Actual]>
const empty_ = builder.empty

export { empty_ as empty }
