import { Schema } from 'effect'
import type { Lifecycle } from './version/models/lifecycle.js'

const defaultTokenEnv = (): string => 'NPM_TOKEN'

export const PublishChannelManual = Schema.Struct({
  mode: Schema.Literal('manual'),
})

export const PublishChannelGitHubToken = Schema.Struct({
  mode: Schema.Literal('github-token'),
  workflow: Schema.String,
  tokenEnv: Schema.String.pipe(Schema.withDecodingDefaultKey(defaultTokenEnv)),
})

export const PublishChannelGitHubTrusted = Schema.Struct({
  mode: Schema.Literal('github-trusted'),
  workflow: Schema.String,
  environment: Schema.optional(Schema.String),
})

export const PublishChannel = Schema.Union([
  PublishChannelManual,
  PublishChannelGitHubToken,
  PublishChannelGitHubTrusted,
])

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
  official: PublishChannel.pipe(Schema.withDecodingDefaultKey(defaultManualChannel)),
  candidate: PublishChannel.pipe(Schema.withDecodingDefaultKey(defaultManualChannel)),
  ephemeral: PublishChannel.pipe(Schema.withDecodingDefaultKey(defaultManualChannel)),
}) {}

export const defaultPublishing = (): Publishing => Schema.decodeSync(Publishing)({})

export const resolvePublishChannel = (
  publishing: Publishing,
  lifecycle: Lifecycle,
): PublishChannel => publishing[lifecycle] ?? { mode: 'manual' as const }
