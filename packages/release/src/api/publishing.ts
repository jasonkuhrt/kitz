import { Sch } from '@kitz/sch'
import { Effect, Schema } from 'effect'
import type { PublishIntent } from './release-contract.js'
import { Ephemeral } from './planner/models/item-ephemeral.js'
import type { Plan } from './planner/models/plan.js'
import { PlanIntentUnavailableError } from './publishing/errors.js'
import type { Lifecycle } from './version/models/lifecycle.js'

const defaultTokenEnv = (): string => 'NPM_TOKEN'

export const PublishChannelManual = Schema.Struct({
  mode: Schema.Literal('manual'),
})

export const PublishChannelGitHubToken = Schema.Struct({
  mode: Schema.Literal('github-token'),
  workflow: Schema.String,
  tokenEnv: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.sync(defaultTokenEnv))),
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
export class Publishing extends Sch.Class<Publishing>()('Publishing', {
  official: PublishChannel.pipe(Schema.withDecodingDefaultKey(Effect.sync(defaultManualChannel))),
  candidate: PublishChannel.pipe(Schema.withDecodingDefaultKey(Effect.sync(defaultManualChannel))),
  ephemeral: PublishChannel.pipe(Schema.withDecodingDefaultKey(Effect.sync(defaultManualChannel))),
}) {}

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
    // 'ephemeral'
    default:
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
  if (params.plan.publishIntent !== undefined) {
    return publishSemanticsFromIntent(params.plan.publishIntent)
  }

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

/**
 * The single resolver that turns a plan into the frozen {@link PublishIntent}
 * an executor runs. Every producer (CLI, CI, programmatic) funnels through here
 * so the same guards apply uniformly.
 *
 * Fails with {@link PlanIntentUnavailableError} when the plan has no frozen
 * intent, or when the intent is a prerelease targeting the `latest` dist-tag
 * and `allowPrereleaseLatest` was not explicitly set (publishing a prerelease
 * to `latest` would silently move the default install target onto an unstable
 * build).
 */
export const resolvePublishIntentForPlan = (
  plan: Plan,
  options?: { readonly allowPrereleaseLatest?: boolean },
): Effect.Effect<PublishIntent, PlanIntentUnavailableError> => {
  const intent = plan.publishIntent
  if (intent === undefined) {
    return Effect.fail(
      new PlanIntentUnavailableError({
        context: {
          reason: 'missing-publish-intent',
          detail:
            'This release plan has no frozen publish intent. Regenerate it with `release plan` before applying.',
        },
      }),
    )
  }
  if (intent.prerelease && intent.distTag === 'latest' && options?.allowPrereleaseLatest !== true) {
    return Effect.fail(
      new PlanIntentUnavailableError({
        context: {
          reason: 'prerelease-targets-latest',
          detail:
            'This plan is a prerelease but its dist-tag is `latest`. Publishing a prerelease to `latest` moves the default install target onto an unstable build. Re-run with --allow-prerelease-latest to override.',
        },
      }),
    )
  }
  return Effect.succeed(intent)
}

export const publishSemanticsFromIntent = (intent: PublishIntent): PublishSemantics => ({
  lifecycle: intent.lifecycle,
  channel: intent.channel,
  distTag: intent.distTag,
  prerelease: intent.prerelease,
  forcePushTag: intent.forcePushTag,
  githubReleaseStyle: intent.githubReleaseStyle,
})

export const publishingFromIntent = (intent: PublishIntent): Publishing =>
  Publishing.make({
    official: { mode: 'manual' },
    candidate: { mode: 'manual' },
    ephemeral: { mode: 'manual' },
    [intent.lifecycle]: intent.channel,
  })

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
