import type { Fn } from '@kitz/core'
import type { AssertNeverKind } from '../asserts.js'
import { builder } from '../builder-singleton.js'

/**
 * Unary relator - asserts type is `never`.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.never<never>
 * Assert.never(value as never)
 *
 * // ✗ Fail
 * type _ = Assert.never<string>
 * Assert.never(value as string)
 * ```
 */
type never_<$Actual> = Fn.Kind.Apply<AssertNeverKind, [$Actual]>
const never_ = builder.never

export { never_ as never }
