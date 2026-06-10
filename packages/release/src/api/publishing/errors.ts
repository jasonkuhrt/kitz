import { Err } from '@kitz/core'
import { Schema as S } from 'effect'
import { PublishCapability } from './models/capability.js'

const baseTags = ['kit', 'release', 'publishing'] as const

export const PublishingOperation = PublishCapability
export type PublishingOperation = typeof PublishingOperation.Type

const PublishingCapabilityErrorContext = S.Struct({
  provider: S.String,
  operation: PublishingOperation,
})

export const PublishingCapabilityError: Err.TaggedContextualErrorClass<
  'PublishingCapabilityError',
  typeof baseTags,
  typeof PublishingCapabilityErrorContext,
  undefined
> = Err.TaggedContextualError('PublishingCapabilityError', baseTags, {
  context: PublishingCapabilityErrorContext,
  message: (ctx) => `Provider ${ctx.provider} cannot prove ${ctx.operation}`,
})

export type PublishingCapabilityError = InstanceType<typeof PublishingCapabilityError>

/**
 * Reasons the single publish-intent resolver cannot hand a usable, safe intent
 * to an executor (the typed `PlanIntentUnavailable` reasons).
 *
 * - `missing-publish-intent`: the plan carries no frozen `publishIntent` (e.g.
 *   a pre-v2 plan, or one produced without `release plan`).
 * - `prerelease-targets-latest`: the frozen intent is a prerelease but its
 *   dist-tag is `latest`; publishing a prerelease to `latest` would move the
 *   default install target onto an unstable build. Gated behind an explicit
 *   `allowPrereleaseLatest` override.
 */
const PlanIntentUnavailableContext = S.Struct({
  reason: S.Literals(['missing-publish-intent', 'prerelease-targets-latest']),
  detail: S.String,
})

/**
 * #### `PlanIntentUnavailableError`
 *
 * Raised by the single publish-intent resolver when a plan cannot yield a safe
 * {@link PublishIntent} for execution. Carries a typed `reason`.
 */
export const PlanIntentUnavailableError: Err.TaggedContextualErrorClass<
  'PlanIntentUnavailableError',
  typeof baseTags,
  typeof PlanIntentUnavailableContext,
  undefined
> = Err.TaggedContextualError('PlanIntentUnavailableError', baseTags, {
  context: PlanIntentUnavailableContext,
  message: (ctx) => ctx.detail,
})

export type PlanIntentUnavailableError = InstanceType<typeof PlanIntentUnavailableError>

export type All = PublishingCapabilityError | PlanIntentUnavailableError
