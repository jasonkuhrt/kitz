import type { Fn } from '@kitz/core'
import type { AssertAnyKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * Unary relator (negated) - asserts type is NOT `any`.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.not.any<string>
 * Assert.not.any(value as string)
 *
 * // ✗ Fail
 * type _ = Assert.not.any<any>
 * Assert.not.any(value as any)
 * ```
 */
type any_<$Actual> = Fn.Kind.Apply<AssertAnyKind, [$Actual, true]>
const any_ = builder.not.any

export { any_ as any }
