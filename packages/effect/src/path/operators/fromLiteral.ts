import { Schema as S } from 'effect'
import type { FromLiteral } from '../core/literal.js'
import { Any } from '../models/Any.js'

/**
 * Decode a path string with the variant inferred from a literal input.
 *
 * Non-literal `string` inputs return the full `Any` union type.
 */
export const fromLiteral = <const Input extends string>(input: Input): FromLiteral<Input> =>
  S.decodeSync(Any)(input) as FromLiteral<Input>
