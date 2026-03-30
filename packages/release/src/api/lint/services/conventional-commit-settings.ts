import type { Semver } from '@kitz/semver'
import { Layer, ServiceMap } from 'effect'

/**
 * Resolved conventional commit settings available to lint rules.
 *
 * Carries the resolved type→bump catalog derived from release config.
 * Rules use this to determine which CC types are recognized.
 */
export interface ConventionalCommitSettings {
  readonly resolvedTypes: Record<string, Semver.BumpType>
}

export class ConventionalCommitSettingsService extends ServiceMap.Service<
  ConventionalCommitSettingsService,
  ConventionalCommitSettings
>()('ConventionalCommitSettingsService') {}

export const make = (
  settings: ConventionalCommitSettings,
): Layer.Layer<ConventionalCommitSettingsService> =>
  Layer.succeed(ConventionalCommitSettingsService, settings)

export const DefaultConventionalCommitSettingsLayer = make({ resolvedTypes: {} })
