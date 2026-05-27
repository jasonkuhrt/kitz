import { Layer, Context } from 'effect'
import type { ConventionalCommitTypeImpact } from '../../config.js'

/**
 * Resolved conventional commit settings available to lint rules.
 *
 * Carries the resolved type→impact catalog derived from release config.
 * Rules use this to determine which CC types are recognized.
 */
export interface ConventionalCommitSettings {
  readonly resolvedTypes: Record<string, ConventionalCommitTypeImpact>
}

export class ConventionalCommitSettingsService extends Context.Service<
  ConventionalCommitSettingsService,
  ConventionalCommitSettings
>()('ConventionalCommitSettingsService') {}

export const make = (
  settings: ConventionalCommitSettings,
): Layer.Layer<ConventionalCommitSettingsService> =>
  Layer.succeed(ConventionalCommitSettingsService, settings)

export const DefaultConventionalCommitSettingsLayer = make({ resolvedTypes: {} })
