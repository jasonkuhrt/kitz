import type { Fn } from '@kitz/core'
import type { AssertUnknownKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

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
const unknown_: typeof builder.not.unknown = builder.not.unknown

export { unknown_ as unknown }
