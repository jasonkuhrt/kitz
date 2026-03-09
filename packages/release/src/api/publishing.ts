import { Schema } from 'effect'
import type { Lifecycle } from './version/models/lifecycle.js'

const defaultTokenEnv = (): string => 'NPM_TOKEN'

export const PublishChannelManual = Schema.Struct({
  mode: Schema.Literal('manual'),
})

export const PublishChannelGitHubToken = Schema.Struct({
  mode: Schema.Literal('github-token'),
  workflow: Schema.String,
  tokenEnv: Schema.optionalWith(Schema.String, { default: defaultTokenEnv }),
})

export const PublishChannelGitHubTrusted = Schema.Struct({
  mode: Schema.Literal('github-trusted'),
  workflow: Schema.String,
  environment: Schema.optional(Schema.String),
})

export const PublishChannel = Schema.Union(
  PublishChannelManual,
  PublishChannelGitHubToken,
  PublishChannelGitHubTrusted,
)

export type PublishChannel = typeof PublishChannel.Type

const defaultManualChannel = (): PublishChannel => ({
  mode: 'manual',
})

/**
 * Declares how each release lifecycle is actually published.
 *
 * This is used by lint and runbook-style surfaces to decide which checks
 * are relevant and what operator guidance should be shown.
 */
export class Publishing extends Schema.Class<Publishing>('Publishing')({
  official: Schema.optionalWith(PublishChannel, { default: defaultManualChannel }),
  candidate: Schema.optionalWith(PublishChannel, { default: defaultManualChannel }),
  ephemeral: Schema.optionalWith(PublishChannel, { default: defaultManualChannel }),
}) {}

export const defaultPublishing = (): Publishing => Publishing.make({})

export const resolvePublishChannel = (
  publishing: Publishing,
  lifecycle: Lifecycle,
): PublishChannel => publishing[lifecycle]
