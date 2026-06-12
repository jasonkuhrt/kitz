import { Effect, Schema } from 'effect'
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
export interface RuntimeRule<Options = void, Metadata = unknown, Error = never, Context = never> {
  readonly data: Rule
  /**
   * Run the rule against already-decoded options.
   * Option-less rules take no argument (`Options` is `void`).
   */
  readonly check: (options: Options) => Effect.Effect<CheckResult<Metadata>, Error, Context>
  /**
   * Decode raw per-rule config options (through the rule's options schema,
   * when one was declared) and run {@link check} with the decoded result.
   */
  readonly run: (
    rawOptions: unknown,
  ) => Effect.Effect<CheckResult<Metadata>, Schema.SchemaError | Error, Context>
}

/** Rule data fields shared by both creation forms. */
interface CreateParamsBase {
  readonly id: Rule['id']
  readonly description: Rule['description']
  readonly preventsDescriptions?: Rule['preventsDescriptions']
  readonly preconditions: Rule['preconditions']
  readonly defaults?: Rule['defaults']
}

/**
 * Create a runtime rule from schema data and check function.
 *
 * `Options` is inferred from `optionsSchema` alone (the check parameter is
 * `NoInfer`), so a typed-options check without a schema is a type error
 * rather than a runtime surprise.
 */
export const create = <Options = void, Metadata = unknown, CheckError = never, Context = never>(
  params: CreateParamsBase & {
    readonly optionsSchema?: Schema.Decoder<Options>
    readonly check: (
      options: NoInfer<Options>,
    ) => Effect.Effect<CheckResult<Metadata>, CheckError, Context>
  },
): RuntimeRule<Options, Metadata, CheckError, Context> => {
  const { optionsSchema, check } = params
  return {
    data: Rule.make(params),
    check,
    run:
      optionsSchema === undefined
        ? () => check(undefined as Options)
        : (rawOptions) =>
            Effect.flatMap(Schema.decodeUnknownEffect(optionsSchema)(rawOptions), check),
  }
}
