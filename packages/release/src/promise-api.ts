/* oxlint-disable kitz/effect/no-effect-run-in-library-code, kitz/error/require-typed-effect-errors -- This module is the explicit Promise adapter boundary for non-Effect callers. */
import { Effect, Layer } from 'effect'
import * as Artifact from './api/artifact.js'
import * as Executor from './api/executor/__.js'
import type { Plan } from './api/planner/models/plan.js'
import * as Proof from './api/proof.js'
import * as Reconciler from './api/reconciler.js'

export interface AdapterDependencies {
  readonly layer?: Layer.Layer<any, any, any>
}

type RehearseOptions = NonNullable<Parameters<typeof Artifact.rehearse>[1]>

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

export const digestPlan = Proof.digestForPlan
export const makeProofArtifact = Proof.makeProofArtifact
export const validateProof = Proof.validateProof
export const validateArtifactManifest = Artifact.validateManifestForPlan
export const classifyReconciliation = Reconciler.classify
export const inspectLegitimacy = Reconciler.inspectVerdict

export const prove = (plan: Plan, dependencies?: AdapterDependencies) =>
  run(Proof.prove(plan), dependencies)

export const rehearse = (
  plan: Plan,
  optionsOrDependencies?: RehearseOptions | AdapterDependencies,
  dependencies?: AdapterDependencies,
) => {
  const options = isAdapterDependencies(optionsOrDependencies) ? {} : (optionsOrDependencies ?? {})
  const resolvedDependencies = isAdapterDependencies(optionsOrDependencies)
    ? optionsOrDependencies
    : dependencies

  return run(Artifact.rehearse(plan, options), resolvedDependencies)
}

export const apply = (
  plan: Plan,
  options: Parameters<typeof Executor.execute>[1] = {},
  dependencies?: AdapterDependencies,
) => run(Executor.execute(plan, options), dependencies)

export const status = (
  plan: Plan,
  options: Parameters<typeof Executor.status>[1] = {},
  dependencies?: AdapterDependencies,
) => run(Executor.status(plan, options), dependencies)

export const reconcile = (plan: Plan, dependencies?: AdapterDependencies) =>
  run(Reconciler.reconcile(plan), dependencies)
