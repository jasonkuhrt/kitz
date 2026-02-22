import { Schema } from 'effect'
import { RuleDefaults, RuleId } from './rule-defaults.js'
import * as Severity_ from './severity.js'
import type { Severity } from './severity.js'

/** Rule-specific options (varies per rule). */
export type RuleConfigOptions = object

/** User input format (supports shorthand). */
export type RuleConfigInput =
  | Severity
  | readonly [Severity, RuleConfigOptions]
  | RuleConfig

/** Normalized form of rule config. */
export class RuleConfig extends Schema.TaggedClass<RuleConfig>()('RuleConfig', {
  overrides: RuleDefaults,
  options: Schema.Object,
}) {
  static is = Schema.is(RuleConfig)
}

/** User configuration for lint. */
export class Config extends Schema.TaggedClass<Config>()('Config', {
  defaults: Schema.optional(RuleDefaults),
  rules: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  /** Only run rules matching these IDs. */
  onlyRules: Schema.optional(Schema.Array(Schema.String)),
  /** Skip rules matching these IDs. */
  skipRules: Schema.optional(Schema.Array(Schema.String)),
}) {
  static is = Schema.is(Config)
}

/** Resolved (normalized) rule defaults. */
export class ResolvedRuleDefaults extends Schema.TaggedClass<ResolvedRuleDefaults>()('ResolvedRuleDefaults', {
  enabled: Schema.Union(Schema.Boolean, Schema.Literal('auto')),
  severity: Severity_.Severity,
}) {
  static is = Schema.is(ResolvedRuleDefaults)
}

/** Resolved (normalized) rule config. */
export class ResolvedRuleConfig extends Schema.TaggedClass<ResolvedRuleConfig>()('ResolvedRuleConfig', {
  overrides: ResolvedRuleDefaults,
  options: Schema.Object,
}) {
  static is = Schema.is(ResolvedRuleConfig)
}

/** Resolved (normalized) configuration. */
export class ResolvedConfig extends Schema.TaggedClass<ResolvedConfig>()('ResolvedConfig', {
  defaults: ResolvedRuleDefaults,
  rules: Schema.Record({ key: Schema.String, value: ResolvedRuleConfig }),
  /** Only run rules matching these IDs. */
  onlyRules: Schema.optional(Schema.Array(Schema.String)),
  /** Skip rules matching these IDs. */
  skipRules: Schema.optional(Schema.Array(Schema.String)),
}) {
  static is = Schema.is(ResolvedConfig)
}

/** System defaults. */
const systemDefaults = ResolvedRuleDefaults.make({
  enabled: 'auto',
  severity: Severity_.Error.make(),
})

/**
 * Normalize user config to resolved config.
 * Precedence: system defaults -> config.defaults -> per-rule config
 */
export const resolveConfig = (config: Partial<Config>): ResolvedConfig => {
  // Merge global defaults
  const defaults = ResolvedRuleDefaults.make({
    enabled: config.defaults?.enabled ?? systemDefaults.enabled,
    severity: config.defaults?.severity ?? systemDefaults.severity,
  })

  // Normalize each rule config
  const rules: Record<string, ResolvedRuleConfig> = {}
  if (config.rules) {
    for (const [id, input] of Object.entries(config.rules) as [RuleId, RuleConfigInput][]) {
      rules[id] = normalizeRuleConfig(input, defaults)
    }
  }

  return ResolvedConfig.make({
    defaults,
    rules,
    onlyRules: config.onlyRules,
    skipRules: config.skipRules,
  })
}

const isSeverity = (input: RuleConfigInput): input is Severity => {
  return typeof input === 'object' && input !== null && '_tag' in input
    && (input._tag === 'SeverityError' || input._tag === 'SeverityWarn')
}

const normalizeRuleConfig = (input: RuleConfigInput, globalDefaults: ResolvedRuleDefaults): ResolvedRuleConfig => {
  // Severity shorthand
  if (isSeverity(input)) {
    return ResolvedRuleConfig.make({
      overrides: ResolvedRuleDefaults.make({
        enabled: globalDefaults.enabled,
        severity: input,
      }),
      options: {},
    })
  }

  // Tuple shorthand [Severity, options]
  if (Array.isArray(input)) {
    const [severity, options] = input
    return ResolvedRuleConfig.make({
      overrides: ResolvedRuleDefaults.make({
        enabled: globalDefaults.enabled,
        severity,
      }),
      options,
    })
  }

  // Full RuleConfig object
  const ruleConfig = input as RuleConfig
  return ResolvedRuleConfig.make({
    overrides: ResolvedRuleDefaults.make({
      enabled: ruleConfig.overrides.enabled ?? globalDefaults.enabled,
      severity: ruleConfig.overrides.severity ?? globalDefaults.severity,
    }),
    options: ruleConfig.options,
  })
}
