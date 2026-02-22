import type { Fn } from '@kitz/core'
import type { AssertUnknownKind } from '../asserts.js'
import { builder } from '../builder-singleton.js'

/**
 * Unary relator - asserts type is `unknown`.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.unknown<unknown>
 * Assert.unknown(value as unknown)
 *
 * // ✗ Fail
 * type _ = Assert.unknown<string>
 * Assert.unknown(value as string)
 * ```
 */
type unknown_<$Actual> = Fn.Kind.Apply<AssertUnknownKind, [$Actual]>
const unknown_ = builder.unknown

export { unknown_ as unknown }
