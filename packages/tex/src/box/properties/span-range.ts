import { Schema as S } from 'effect'

/**
 * Span range constraints (min/max) using logical properties.
 *
 * This is a constraint on Span, not a property itself.
 *
 * @category Text Formatting
 */
export class SpanRange extends S.Class<SpanRange>('SpanRange')({
  /**
   * Constraints for main axis span.
   */
  main: S.optional(
    S.Struct({
      min: S.optional(S.Number),
      max: S.optional(S.Number),
    }),
  ),

  /**
   * Constraints for cross axis span.
   */
  cross: S.optional(
    S.Struct({
      min: S.optional(S.Number),
      max: S.optional(S.Number),
    }),
  ),
}) {
  static make = this.makeUnsafe
}
