import { Schema as S } from 'effect'
import type { FromLiteral, LiteralInput } from '../core/literal.js'
import { Any } from '../models/Any.js'

/**
 * Construct a path value from a statically-known path literal.
 *
 * `Path.make` classifies an encoded literal through the type-level parser.
 * Target path schemas overload their own `make` with both this literal world
 * and their original Type-side structured input. Runtime strings stay on
 * Schema decode channels.
 *
 * The literal grammar is kitz-defined: it overlaps the string codec grammar
 * because the runtime implementation reuses the analyzer, not because the two
 * worlds are the same. Non-literal `string` inputs are rejected statically.
 */
export const make = <const $Input extends string>(
  input: LiteralInput<$Input>,
): FromLiteral<$Input> => S.decodeSync(Any)(input as any) as any
