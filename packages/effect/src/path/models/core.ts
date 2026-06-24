import { Schema as S } from 'effect'
import type { Segment } from './Segment.js'

/**
 * Count of leading parent-traversal (`..`) steps in a segment list.
 *
 * Shared by the relative path value classes; absolute paths can't lead with `..`,
 * so they simply don't expose `back`.
 */
export const back = (segments: readonly Segment[]): number => {
  let count = 0
  for (const segment of segments) {
    if (segment._tag === 'Up') count++
    else break
  }
  return count
}

/**
 * Wrap a string⇄path codec into its public binding, baking in the statics every
 * path type shares — `is` and `fromString` — correctly bound to the wrapping class.
 *
 * Replaces the hand-repeated tail after every `S.asClass`:
 *
 * ```ts
 * class X_ extends S.asClass(codec) {
 *   static is = S.is(this)
 *   static fromString = (input) => S.decodeSync(this)(input)
 * }
 * export const X = X_
 * ```
 *
 * with `export const X = asClassPath(codec)`. The statics can't be inherited
 * (`S.is(this)` binds `this` at the base's definition, not the subclass), so a
 * factory injecting them per class is the only correct de-duplication.
 */
export const asClassPath = <Sch extends S.Codec<unknown, string, never, never>>(schema: Sch) =>
  class extends S.asClass(schema) {
    /** Type guard for this path type. */
    static is = S.is(this)
    /** Decode this path type from its canonical string form. Throws on invalid input. */
    static fromString = (input: string): Sch['Type'] => S.decodeSync(schema)(input)
  }
