import type { Effect, Schema } from 'effect'
import { Rule } from './rule.js'
import type { Violation } from './violation.js'

/**
 * Result of a rule check.
 *
 * Rules can return:
 * - `undefined` → rule passed, no violation
 * - `Violation` → rule failed with violation (shorthand)
 * - `{ violation?, metadata? }` → full result with optional metadata
 */
export type CheckResult<Metadata = unknown> =
  | undefined
  | Violation
  | { readonly violation?: Violation; readonly metadata?: Metadata }

/** A rule with its runtime check function. */
export interface RuntimeRule<Options = unknown, Metadata = unknown> {
  readonly data: Rule
  readonly optionsSchema?: Schema.Schema<Options>
  readonly check: Effect.Effect<CheckResult<Metadata>>
}

/** Params derived from Rule schema constructor + check field. */
type CreateParams<Options, Metadata> = Parameters<typeof Rule.make>[0] & {
  readonly optionsSchema?: Schema.Schema<Options>
  readonly check: Effect.Effect<CheckResult<Metadata>>
}

/** Create a runtime rule from schema data and check function. */
export const create = <Options = unknown, Metadata = unknown>(
  params: CreateParams<Options, Metadata>,
): RuntimeRule<Options, Metadata> => ({
  data: Rule.make(params),
  optionsSchema: params.optionsSchema,
  check: params.check,
})
