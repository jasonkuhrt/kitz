import { Schema } from 'effect'

// ─── Custom Type ────────────────────────────────────────────────

/**
 * A custom/unknown commit type.
 */
export class Custom extends Schema.TaggedClass<Custom>()('Custom', {
  value: Schema.String,
}) {
  static is = Schema.is(Custom)
  static parse = (value: string) => Custom.make({ value })
}
