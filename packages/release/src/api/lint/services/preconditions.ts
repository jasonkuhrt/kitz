import { Layer, Context } from 'effect'
import type { Precondition } from '../models/precondition.js'

/**
 * Evaluated precondition states for the current context.
 *
 * Each key is a {@link Precondition} and the value records whether it is
 * satisfied. This is provided as a service so the lint check can evaluate
 * rule preconditions against the current environment.
 */
export type EvaluatedPreconditions = Readonly<Record<Precondition, boolean>>

/** Service providing evaluated precondition states. */
export class EvaluatedPreconditionsService extends Context.Service<
  EvaluatedPreconditionsService,
  EvaluatedPreconditions
>()('EvaluatedPreconditionsService') {}

const allUnsatisfied: EvaluatedPreconditions = {
  hasOpenPR: false,
  hasDiff: false,
  isMonorepo: false,
  hasGitHubAccess: false,
  hasReleasePlan: false,
}

/**
 * Create a layer with custom precondition values.
 * Unspecified preconditions default to unsatisfied.
 */
export const make = (
  preconditions: Partial<EvaluatedPreconditions>,
): Layer.Layer<EvaluatedPreconditionsService> =>
  Layer.succeed(EvaluatedPreconditionsService, { ...allUnsatisfied, ...preconditions })

/**
 * Default layer with all preconditions unsatisfied.
 *
 * Safe default that skips rules requiring external context (PR, GitHub, etc).
 * Rules without preconditions will still run.
 */
export const DefaultLayer = make({})
