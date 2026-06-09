/* oxlint-disable kitz/effect/no-effect-run-in-library-code, kitz/error/require-typed-effect-errors -- This module is the explicit Promise adapter boundary for non-Effect callers. */
import { Effect, Layer } from 'effect'
import * as Api from './api/__.js'
import type { Plan } from './api/planner/models/plan.js'

export interface AdapterDependencies {
  readonly layer?: Layer.Layer<any, any, any>
}

type RehearseOptions = NonNullable<Parameters<typeof Api.Artifact.rehearse>[1]>

const isAdapterDependencies = (
  value: RehearseOptions | AdapterDependencies | undefined,
): value is AdapterDependencies => value !== undefined && 'layer' in value

const run = <A>(
  effect: Effect.Effect<A, unknown, unknown>,
  dependencies?: AdapterDependencies,
): Promise<A> =>
  Effect.runPromise(
    (dependencies?.layer === undefined
      ? effect
      : effect.pipe(Effect.provide(dependencies.layer))) as Effect.Effect<A, unknown>,
  )

export const digestPlan = Api.Proof.digestForPlan
export const makeProofArtifact = Api.Proof.makeProofArtifact
export const validateProof = Api.Proof.validateProof
export const validateArtifactManifest = Api.Artifact.validateManifestForPlan
export const classifyReconciliation = Api.Reconciler.classify
export const inspectLegitimacy = Api.Reconciler.inspectVerdict

export const prove = (plan: Plan, dependencies?: AdapterDependencies) =>
  run(Api.Proof.prove(plan), dependencies)

export const rehearse = (
  plan: Plan,
  optionsOrDependencies?: RehearseOptions | AdapterDependencies,
  dependencies?: AdapterDependencies,
) => {
  const options = isAdapterDependencies(optionsOrDependencies) ? {} : (optionsOrDependencies ?? {})
  const resolvedDependencies = isAdapterDependencies(optionsOrDependencies)
    ? optionsOrDependencies
    : dependencies

  return run(Api.Artifact.rehearse(plan, options), resolvedDependencies)
}

export const apply = (
  plan: Plan,
  options: Parameters<typeof Api.Executor.execute>[1] = {},
  dependencies?: AdapterDependencies,
) => run(Api.Executor.execute(plan, options), dependencies)

export const status = (
  plan: Plan,
  options: Parameters<typeof Api.Executor.status>[1] = {},
  dependencies?: AdapterDependencies,
) => run(Api.Executor.status(plan, options), dependencies)

export const reconcile = (plan: Plan, dependencies?: AdapterDependencies) =>
  run(Api.Reconciler.reconcile(plan), dependencies)
