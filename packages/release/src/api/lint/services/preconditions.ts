import { Context, Layer } from 'effect'

/**
 * Evaluated precondition states for the current context.
 *
 * Each field represents whether a precondition is satisfied.
 * This is provided as a service so the lint check can evaluate
 * rule preconditions against the current environment.
 */
export interface EvaluatedPreconditions {
  /** Current branch has an open pull request. */
  readonly hasOpenPR: boolean
  /** PR has file changes. */
  readonly hasDiff: boolean
  /** Project is a pnpm workspace. */
  readonly isMonorepo: boolean
  /** GitHub API token available with repo read access. */
  readonly hasGitHubAccess: boolean
  /** A release plan is available. */
  readonly hasReleasePlan: boolean
}

/** Service providing evaluated precondition states. */
export class EvaluatedPreconditionsService extends Context.Tag('EvaluatedPreconditionsService')<
  EvaluatedPreconditionsService,
  EvaluatedPreconditions
>() {}

/**
 * Default layer with all preconditions false.
 *
 * Safe default that skips rules requiring external context (PR, GitHub, etc).
 * Rules without preconditions will still run.
 */
export const DefaultLayer = Layer.succeed(EvaluatedPreconditionsService, {
  hasOpenPR: false,
  hasDiff: false,
  isMonorepo: false,
  hasGitHubAccess: false,
  hasReleasePlan: false,
})

/**
 * Create a layer with custom precondition values.
 */
export const make = (preconditions: Partial<EvaluatedPreconditions>): Layer.Layer<EvaluatedPreconditionsService> =>
  Layer.succeed(EvaluatedPreconditionsService, {
    hasOpenPR: preconditions.hasOpenPR ?? false,
    hasDiff: preconditions.hasDiff ?? false,
    isMonorepo: preconditions.isMonorepo ?? false,
    hasGitHubAccess: preconditions.hasGitHubAccess ?? false,
    hasReleasePlan: preconditions.hasReleasePlan ?? false,
  })
