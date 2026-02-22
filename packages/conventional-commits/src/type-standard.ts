import { Semver } from '@kitz/semver'
import { Option, Schema } from 'effect'

/**
 * Re-export BumpType from @kitz/semver for convenience.
 */
export type BumpType = Semver.BumpType

// ─── Standard Value ─────────────────────────────────────────────

/**
 * The 11 standard conventional commit types (Angular convention).
 */
export const StandardValue = Schema.Enums({
  feat: 'feat',
  fix: 'fix',
  docs: 'docs',
  style: 'style',
  refactor: 'refactor',
  perf: 'perf',
  test: 'test',
  build: 'build',
  ci: 'ci',
  chore: 'chore',
  revert: 'revert',
})
export type StandardValue = typeof StandardValue.Type

// ─── Standard Impact Mapping ────────────────────────────────────

/**
 * Static impact mapping for standard types.
 *
 * Returns `Option.none()` for types that don't trigger a release (style, refactor, etc.)
 */
export const StandardImpact: Record<StandardValue, Option.Option<BumpType>> = {
  feat: Option.some('minor'),
  fix: Option.some('patch'),
  docs: Option.some('patch'),
  perf: Option.some('patch'),
  style: Option.none(),
  refactor: Option.none(),
  test: Option.none(),
  build: Option.none(),
  ci: Option.none(),
  chore: Option.none(),
  revert: Option.none(),
}

// ─── Standard Type ──────────────────────────────────────────────

/**
 * A known conventional commit type.
 */
export class Standard extends Schema.TaggedClass<Standard>()('Standard', {
  value: StandardValue,
}) {
  static is = Schema.is(Standard)
  static parse = (value: StandardValue) => Standard.make({ value })
}
