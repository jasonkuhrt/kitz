import { Schema } from 'effect'
import { TargetSection } from './target-section.js'
import { Target } from './target.js'

/**
 * An extended conventional commit for monorepos where each target can have
 * its own type and breaking indicator.
 *
 * Examples:
 * - `feat(core!), fix(cli): msg` - core is breaking feat, cli is non-breaking fix
 * - `feat(core), feat(arr)!: msg` - both are feats, global breaking before : applies to all
 *
 * Body structure:
 * ```
 * feat(core!), fix(arr): short description
 *
 * Optional summary before any ## heading.
 *
 * ## core
 * Per-package body for core.
 *
 * BREAKING CHANGE: details
 *
 * ## arr
 * Per-package body for arr.
 * ```
 */
export class Multi extends Schema.TaggedClass<Multi>()('Multi', {
  /** Targets with independent type/scope/breaking */
  targets: Schema.NonEmptyArray(Target),
  /** Commit message (first line after type-scope groups) */
  message: Schema.String,
  /** Optional summary text (before any ## heading) */
  summary: Schema.OptionFromNullOr(Schema.String),
  /** Per-package sections keyed by scope name */
  sections: Schema.Record({ key: Schema.String, value: TargetSection }),
}) {
  static is = Schema.is(Multi)
}
