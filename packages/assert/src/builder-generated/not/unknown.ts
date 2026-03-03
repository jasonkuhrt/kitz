import type { Fn } from '@kitz/core'
import { builder } from '../../builder-singleton.js'
import type { AssertUnknownKind } from '../../asserts.js'


/**
 * Unary relator (negated) - asserts type is NOT `unknown`.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.not.unknown<string>
 * Assert.not.unknown(value as string)
 *
 * // ✗ Fail
 * type _ = Assert.not.unknown<unknown>
 * Assert.not.unknown(value as unknown)
 * ```
 */
type unknown_<$Actual> = Fn.Kind.Apply<AssertUnknownKind, [$Actual, true]>
const unknown_ = builder.not.unknown

export { unknown_ as unknown }
