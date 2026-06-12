import { Sch } from '@kitz/sch'
import { Schema } from 'effect'

// ─── Custom Type ────────────────────────────────────────────────

/**
 * A custom/unknown commit type.
 */
export class Custom extends Sch.TaggedClass<Custom>()('Custom', {
  value: Schema.String,
}) {
  static parse = (value: string) => Custom.make({ value })
}
