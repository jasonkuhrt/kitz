import type { Fn } from '@kitz/core'
import type { AssertNeverKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * Unary relator (negated) - asserts type is NOT `never`.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.not.never<string>
 * Assert.not.never(value as string)
 *
 * // ✗ Fail
 * type _ = Assert.not.never<never>
 * Assert.not.never(value as never)
 * ```
 */
type never_<$Actual> = Fn.Kind.Apply<AssertNeverKind, [$Actual, true]>
const never_ = builder.not.never

export { never_ as never }
