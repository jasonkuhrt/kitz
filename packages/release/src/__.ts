/**
 * Public entrypoint for `@kitz/release` configuration files.
 */

export {
  Config,
  defineConfig,
  init,
  load,
  ResolvedConfig,
  resolveConventionalCommitTypes,
} from './api/config.js'

export type {
  CommitOverride,
  CommitOverrides,
  ConventionalCommitSettings,
  ConventionalCommitTypeImpact,
  ConfigError,
  CustomTypes,
  InitOptions,
  InitResult,
  LoadOptions,
} from './api/config.js'

export * as Severity from './api/lint/models/severity.js'
