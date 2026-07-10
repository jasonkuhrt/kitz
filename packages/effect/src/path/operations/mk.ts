import { Schema as S } from 'effect'
import type { FromLiteral, LiteralInput } from '../core/literal.js'
import { Any } from '../models/Any.js'

/**
 * Construct a path value from a statically-known path literal.
 *
 * Three input worlds stay distinct:
 * - `make` constructs Type-side runtime values from decoded parts.
 * - codecs decode encoded runtime data through Schema channels.
 * - `mk` constructs from string literals validated by the type-level parser.
 *
 * The literal grammar is kitz-defined: it overlaps the string codec grammar
 * because the runtime implementation reuses the analyzer, not because the two
 * worlds are the same. Non-literal `string` inputs are rejected statically.
 */
export const mk = <const $Input extends string>(input: LiteralInput<$Input>): FromLiteral<$Input> =>
  S.decodeSync(Any)(input as any) as any
