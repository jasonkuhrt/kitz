import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { RuleDefaults } from './rule-defaults.js'
import * as Severity_ from './severity.js'

/** Rule-specific options (varies per rule). */
const RuleOptions = Schema.Record(Schema.String, Schema.Unknown)

/** Rule-specific options (varies per rule). */
export type RuleConfigOptions = typeof RuleOptions.Type

/** Normalized form of rule config. */
export class RuleConfig extends Sch.TaggedClass<RuleConfig>()('RuleConfig', {
  overrides: RuleDefaults,
  options: RuleOptions,
}) {}

/**
 * User input grammar for a single rule's config (supports shorthand):
 *
 * - bare severity — `'warn'`
 * - `[severity, options]` tuple — `['error', { remote: 'upstream' }]`
 * - full {@link RuleConfig} object
 *
 * Invalid values (e.g. a number) fail decoding with a typed schema error
 * instead of crashing later during resolution.
 */
export const RuleConfigInput = Schema.Union([
  Severity_.Severity,
  Schema.Tuple([Severity_.Severity, RuleOptions]),
  RuleConfig,
])
export type RuleConfigInput = typeof RuleConfigInput.Type

/** User configuration for lint. */
export class Config extends Sch.TaggedClass<Config>()('Config', {
  defaults: Schema.optional(RuleDefaults),
  rules: Schema.optional(Schema.Record(Schema.String, RuleConfigInput)),
  /** Only run rules matching these IDs. */
  onlyRules: Schema.optional(Schema.Array(Schema.String)),
  /** Skip rules matching these IDs. */
  skipRules: Schema.optional(Schema.Array(Schema.String)),
}) {}

/** Resolved (normalized) rule defaults. */
export class ResolvedRuleDefaults extends Sch.TaggedClass<ResolvedRuleDefaults>()(
  'ResolvedRuleDefaults',
  {
    enabled: Schema.Union([Schema.Boolean, Schema.Literal('auto')]),
    severity: Severity_.Severity,
  },
) {}

/** Resolved (normalized) rule config. */
export class ResolvedRuleConfig extends Sch.TaggedClass<ResolvedRuleConfig>()(
  'ResolvedRuleConfig',
  {
    overrides: ResolvedRuleDefaults,
    options: RuleOptions,
  },
) {}

/** Resolved (normalized) configuration. */
export class ResolvedConfig extends Sch.TaggedClass<ResolvedConfig>()('ResolvedConfig', {
  defaults: ResolvedRuleDefaults,
  rules: Schema.Record(Schema.String, ResolvedRuleConfig),
  /** Only run rules matching these IDs. */
  onlyRules: Schema.optional(Schema.Array(Schema.String)),
  /** Skip rules matching these IDs. */
  skipRules: Schema.optional(Schema.Array(Schema.String)),
}) {}

/** System defaults. */
const systemDefaults = ResolvedRuleDefaults.make({
  enabled: 'auto',
  severity: 'error',
})

/**
 * Normalize user config to fully resolved config.
 *
 * **Precedence** (later wins):
 * 1. System defaults — `enabled: 'auto'`, `severity: 'error'`
 * 2. `config.defaults` — global overrides from user config
 * 3. Per-rule config — `config.rules[id]` overrides for individual rules
 *
 * Per-rule input follows the {@link RuleConfigInput} grammar.
 */
export const resolveConfig = (config: Partial<Config>): ResolvedConfig => {
  // Merge global defaults
  const defaults = ResolvedRuleDefaults.make({
    enabled: config.defaults?.enabled ?? systemDefaults.enabled,
    severity: config.defaults?.severity ?? systemDefaults.severity,
  })

  const rules = Object.fromEntries(
    Object.entries(config.rules ?? {}).map(([id, input]) => [
      id,
      resolveRuleConfig(input, defaults),
    ]),
  )

  return ResolvedConfig.make({
    defaults,
    rules,
    onlyRules: config.onlyRules,
    skipRules: config.skipRules,
  })
}

const resolveRuleConfig = (
  input: RuleConfigInput,
  globalDefaults: ResolvedRuleDefaults,
): ResolvedRuleConfig => {
  // Bare severity shorthand
  if (Severity_.is(input)) {
    return ResolvedRuleConfig.make({
      overrides: ResolvedRuleDefaults.make({
        enabled: globalDefaults.enabled,
        severity: input,
      }),
      options: {},
    })
  }

  // Full RuleConfig object
  if (RuleConfig.is(input)) {
    return ResolvedRuleConfig.make({
      overrides: ResolvedRuleDefaults.make({
        enabled: input.overrides.enabled ?? globalDefaults.enabled,
        severity: input.overrides.severity ?? globalDefaults.severity,
      }),
      options: input.options,
    })
  }

  // [severity, options] tuple shorthand
  const [severity, options] = input
  return ResolvedRuleConfig.make({
    overrides: ResolvedRuleDefaults.make({
      enabled: globalDefaults.enabled,
      severity,
    }),
    options,
  })
}
