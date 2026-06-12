import { Sch } from '@kitz/sch'
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
const standardValues = {
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
} as const

export const StandardValue = Schema.Enum(standardValues)
export type StandardValue = keyof typeof standardValues

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
 * A known conventional commit type with its impact composed from StandardImpact.
 */
export class Standard extends Sch.TaggedClass<Standard>()('Standard', {
  value: StandardValue,
  impact: Schema.OptionFromNullOr(Semver.BumpType),
}) {
  static override make = (
    params: { readonly value: StandardValue; readonly impact?: Option.Option<BumpType> },
    options?: Schema.MakeOptions,
  ): Standard =>
    new Standard(
      { value: params.value, impact: params.impact ?? StandardImpact[params.value] },
      options,
    )
  static parse = (value: StandardValue) => Standard.make({ value })
}
