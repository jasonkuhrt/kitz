import { Schema } from 'effect'
import { Footer } from './footer.js'
import { Type } from './type.js'

/**
 * A standard conventional commit where all scopes receive uniform treatment.
 *
 * Examples:
 * - `feat: add feature` (no scope)
 * - `feat(core): add feature` (one scope)
 * - `feat(core, cli): add feature` (multiple scopes, same type/breaking for all)
 * - `feat(core)!: breaking change` (breaking applies to all scopes)
 */
export class Single extends Schema.TaggedClass<Single>()('Single', {
  /** Commit type */
  type: Type,
  /** Package scopes (can be empty, one, or multiple—all get same treatment) */
  scopes: Schema.Array(Schema.String),
  /** Whether this is a breaking change (applies to ALL scopes) */
  breaking: Schema.Boolean,
  /** Commit message (first line after type/scope) */
  message: Schema.String,
  /** Optional commit body */
  body: Schema.OptionFromNullOr(Schema.String),
  /** Commit footers */
  footers: Schema.Array(Footer),
}) {
  static is = Schema.is(Single)
}
