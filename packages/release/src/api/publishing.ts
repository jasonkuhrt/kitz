import { Schema } from 'effect'
import { Ephemeral } from './planner/models/item-ephemeral.js'
import type { Plan } from './planner/models/plan.js'
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

export interface PublishSemantics {
  readonly lifecycle: Lifecycle
  readonly channel: PublishChannel
  readonly distTag: string
  readonly prerelease: boolean
  readonly forcePushTag: boolean
  readonly githubReleaseStyle: 'versioned' | 'dist-tagged'
}

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
}) {
  static is = Schema.is(Publishing)
  static decode = Schema.decodeUnknownEffect(Publishing)
  static decodeSync = Schema.decodeUnknownSync(Publishing)
  static encode = Schema.encodeUnknownEffect(Publishing)
  static encodeSync = Schema.encodeUnknownSync(Publishing)
  static equivalence = Schema.toEquivalence(Publishing)
  static ordered = false as const
  static make = this.makeUnsafe
}

export const defaultPublishing = (): Publishing => Publishing.decodeSync({})

export const resolvePublishChannel = (
  publishing: Publishing,
  lifecycle: Lifecycle,
): PublishChannel => publishing[lifecycle] ?? { mode: 'manual' as const }

export const formatEphemeralDistTag = (prNumber: number): string => `pr-${String(prNumber)}`

export const resolvePlanPrNumber = (plan: Plan): number | undefined => {
  if (plan.lifecycle !== 'ephemeral') return undefined

  const ephemeralRelease = [...plan.releases, ...plan.cascades].find(Ephemeral.is)
  return ephemeralRelease?.prerelease.prNumber
}

export const resolvePublishSemantics = (params: {
  readonly lifecycle: Lifecycle
  readonly publishing?: Publishing
  readonly tag?: string
  readonly npmTag?: string
  readonly candidateTag?: string
  readonly prNumber?: number
}): PublishSemantics => {
  const channel = resolvePublishChannel(params.publishing ?? defaultPublishing(), params.lifecycle)

  switch (params.lifecycle) {
    case 'official':
      return {
        lifecycle: params.lifecycle,
        channel,
        distTag: params.tag ?? params.npmTag ?? 'latest',
        prerelease: false,
        forcePushTag: false,
        githubReleaseStyle: 'versioned',
      }
    case 'candidate':
      return {
        lifecycle: params.lifecycle,
        channel,
        distTag: params.tag ?? params.candidateTag ?? 'next',
        prerelease: true,
        forcePushTag: true,
        githubReleaseStyle: 'dist-tagged',
      }
    case 'ephemeral':
      return {
        lifecycle: params.lifecycle,
        channel,
        distTag:
          params.tag ??
          (params.prNumber !== undefined ? formatEphemeralDistTag(params.prNumber) : 'pr'),
        prerelease: true,
        forcePushTag: false,
        githubReleaseStyle: 'versioned',
      }
  }
}

export const resolvePublishSemanticsForPlan = (params: {
  readonly plan: Plan
  readonly publishing?: Publishing
  readonly tag?: string
  readonly npmTag?: string
  readonly candidateTag?: string
}): PublishSemantics => {
  const prNumber = resolvePlanPrNumber(params.plan)

  return resolvePublishSemantics({
    lifecycle: params.plan.lifecycle,
    ...(params.publishing !== undefined ? { publishing: params.publishing } : {}),
    ...(params.tag !== undefined ? { tag: params.tag } : {}),
    ...(params.npmTag !== undefined ? { npmTag: params.npmTag } : {}),
    ...(params.candidateTag !== undefined ? { candidateTag: params.candidateTag } : {}),
    ...(prNumber !== undefined ? { prNumber } : {}),
  })
}

export const formatGithubReleaseTitle = (
  semantics: PublishSemantics,
  params: {
    readonly packageName: string
    readonly version: string
  },
): string =>
  semantics.githubReleaseStyle === 'dist-tagged'
    ? `${params.packageName} @${semantics.distTag}`
    : `${params.packageName} v${params.version}`
