import * as Api from '../api/__.js'

interface CommandLintRuleOptions {
  readonly 'env.publish-channel-ready': {
    readonly surface?: 'execution' | 'preview'
  }
  readonly 'env.git-clean': Record<string, never>
  readonly 'env.git-remote': {
    readonly remote?: string
  }
  readonly 'env.npm-authenticated': Record<string, never>
  readonly 'plan.packages-license-present': Record<string, never>
  readonly 'plan.packages-not-private': Record<string, never>
  readonly 'plan.packages-repository-match-canonical': Record<string, never>
  readonly 'plan.packages-repository-present': Record<string, never>
  readonly 'plan.tags-unique': Record<string, never>
  readonly 'plan.versions-unpublished': Record<string, never>
  readonly 'pr.projected-squash-commit-sync': {
    readonly projectedHeader: string
  }
  readonly 'pr.type.release-kind-match-diff': Record<string, never>
}

export type CommandLintRuleId = keyof CommandLintRuleOptions

export interface CommandLintRuleSpec<K extends CommandLintRuleId = CommandLintRuleId> {
  readonly id: K
  readonly options?: CommandLintRuleOptions[K]
  readonly enabled?: boolean | 'auto'
  readonly severity?: Api.Lint.Severity
  readonly preserveExistingOverrides?: boolean
}

export const commandLintRule = <K extends CommandLintRuleId>(
  spec: CommandLintRuleSpec<K>,
): CommandLintRuleSpec<K> => spec

const buildEnabledRuleConfig = <K extends CommandLintRuleId>(
  config: Api.Config.ResolvedConfig,
  spec: CommandLintRuleSpec<K>,
): Api.Lint.ResolvedRuleConfig => {
  const existing = config.lint.rules[spec.id]
  const enabled = spec.preserveExistingOverrides
    ? (existing?.overrides.enabled ?? spec.enabled ?? 'auto')
    : (spec.enabled ?? true)
  const severity = spec.preserveExistingOverrides
    ? (existing?.overrides.severity ?? spec.severity ?? config.lint.defaults.severity)
    : (spec.severity ?? existing?.overrides.severity ?? config.lint.defaults.severity)

  return Api.Lint.ResolvedRuleConfig.make({
    overrides: Api.Lint.ResolvedRuleDefaults.make({
      enabled,
      severity,
    }),
    options: {
      ...existing?.options,
      ...(spec.options ?? {}),
    },
  })
}

const resolveRuleList = (
  override: readonly string[] | undefined,
  current: readonly string[] | undefined,
): readonly string[] | undefined => override ?? current

export const createCommandLintConfig = <
  const TRules extends readonly CommandLintRuleSpec[],
>(params: {
  readonly config: Api.Config.ResolvedConfig
  readonly rules: TRules
  readonly onlyRules?: readonly string[]
  readonly skipRules?: readonly string[]
}): Api.Lint.ResolvedConfig => {
  const rules = params.rules.reduce<Record<string, Api.Lint.ResolvedRuleConfig>>((acc, spec) => {
    acc[spec.id] = buildEnabledRuleConfig(params.config, spec)
    return acc
  }, {})

  const onlyRules = resolveRuleList(params.onlyRules, params.config.lint.onlyRules)
  const skipRules = resolveRuleList(params.skipRules, params.config.lint.skipRules)

  return Api.Lint.ResolvedConfig.make({
    defaults: params.config.lint.defaults,
    rules: {
      ...params.config.lint.rules,
      ...rules,
    },
    ...(onlyRules !== undefined ? { onlyRules: [...onlyRules] } : {}),
    ...(skipRules !== undefined ? { skipRules: [...skipRules] } : {}),
  })
}
