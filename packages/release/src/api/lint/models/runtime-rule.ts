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
export interface RuntimeRule<
  Options = unknown,
  Metadata = unknown,
  Error = never,
  Context = never,
> {
  readonly data: Rule
  readonly optionsSchema?: Schema.Top
  readonly check: Effect.Effect<CheckResult<Metadata>, Error, Context>
}

/** Params derived from Rule schema constructor + check field. */
type CreateParams<Options, Metadata, Error, Context> = {
  readonly id: Rule['id']
  readonly description: Rule['description']
  readonly preventsDescriptions?: Rule['preventsDescriptions']
  readonly preconditions: Rule['preconditions']
  readonly defaults?: Rule['defaults']
  readonly optionsSchema?: Schema.Top
  readonly check: Effect.Effect<CheckResult<Metadata>, Error, Context>
}

/** Create a runtime rule from schema data and check function. */
export const create = <Options = unknown, Metadata = unknown, Error = never, Context = never>(
  params: CreateParams<Options, Metadata, Error, Context>,
): RuntimeRule<Options, Metadata, Error, Context> => ({
  data: new Rule(params),
  ...(params.optionsSchema ? { optionsSchema: params.optionsSchema } : {}),
  check: params.check,
})
