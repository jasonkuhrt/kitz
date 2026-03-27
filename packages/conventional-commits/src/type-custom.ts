import { Schema } from 'effect'

// ─── Custom Type ────────────────────────────────────────────────

/**
 * A custom/unknown commit type.
 */
export class Custom extends Schema.TaggedClass<Custom>()('Custom', {
  value: Schema.String,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Custom)
  static decode = Schema.decodeUnknownEffect(Custom)
  static decodeSync = Schema.decodeUnknownSync(Custom)
  static encode = Schema.encodeUnknownEffect(Custom)
  static encodeSync = Schema.encodeUnknownSync(Custom)
  static equivalence = Schema.toEquivalence(Custom)
  static ordered = false as const
  static parse = (value: string) => Custom.make({ value })
}
