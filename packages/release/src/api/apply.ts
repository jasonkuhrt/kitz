/**
 * @module api/apply
 *
 * The release-apply safety gauntlet: the ordered validation pipeline that must
 * pass before a plan may mutate registries and git. It re-proves the plan-bound
 * proof, re-observes credential/registry/GitHub surfaces immediately before
 * mutation, and validates the artifact manifest, source snapshot, and
 * script/engine policies, returning a typed {@link ApplyResult}.
 *
 * This op owns the orchestration and its correctness-load-bearing ordering
 * (disk-proof check → pre-mutation recheck → policy validation → runtime
 * resolution). Execution, event streaming, archiving, and all operator IO
 * (Console/exit/Terminal) stay in the CLI boundary: a `Ready` result hands the
 * rechecked artifact and resolved GitHub runtime back to the caller to drive
 * `executeObservable` with the per-mutation recheck hook.
 */
import { Env } from '@kitz/env'
import { Effect, Option, Schema } from 'effect'
import * as Artifact from './artifact.js'
import * as Config from './config.js'
import type { RuntimeConfig } from './executor/runtime.js'
import * as Explorer from './explorer/__.js'
import * as Planner from './planner/__.js'
import type { Plan } from './planner/models/plan.js'
import * as Proof from './proof.js'
import type { ProofArtifact } from './release-contract.js'

export type ApplyBlockStage =
  | 'prove'
  | 'disk-proof'
  | 'recheck'
  | 'artifact'
  | 'source-snapshot'
  | 'script-policy'
  | 'engine-policy'
  | 'runtime'

export type ApplyResult =
  | { readonly _tag: 'Canceled' }
  | { readonly _tag: 'ProofUnreadable' }
  | { readonly _tag: 'ProofMissing' }
  | {
      readonly _tag: 'Blocked'
      readonly stage: ApplyBlockStage
      readonly messages: readonly string[]
      readonly softWarnings: readonly string[]
    }
  | {
      readonly _tag: 'Ready'
      readonly rechecked: ProofArtifact
      readonly github: NonNullable<RuntimeConfig['github']>
      readonly softWarnings: readonly string[]
    }

const canceled = (): ApplyResult => ({ _tag: 'Canceled' })
const proofUnreadable = (): ApplyResult => ({ _tag: 'ProofUnreadable' })
const proofMissing = (): ApplyResult => ({ _tag: 'ProofMissing' })
const blocked = (
  stage: ApplyBlockStage,
  messages: readonly string[],
  softWarnings: readonly string[],
): ApplyResult => ({ _tag: 'Blocked', stage, messages, softWarnings })
const ready = (
  rechecked: ProofArtifact,
  github: NonNullable<RuntimeConfig['github']>,
  softWarnings: readonly string[],
): ApplyResult => ({ _tag: 'Ready', rechecked, github, softWarnings })

const softWarningsOf = (proof: ProofArtifact, plan: Plan, now?: string): readonly string[] =>
  Proof.validateProof(proof, now, plan.proofPolicy)
    .filter((issue) => issue.severity === 'soft')
    .map((issue) => `warning: ${issue.code}: ${issue.detail}`)

/**
 * Run the apply gauntlet for a frozen plan. Returns `Canceled` if the optional
 * pre-apply confirmation is declined, `ProofUnreadable`/`ProofMissing` for a
 * stale/absent plan-bound proof, `Blocked` (with the failing stage, the operator
 * messages, and any soft warnings) at the first failed gate, or `Ready` with the
 * rechecked proof artifact and resolved GitHub runtime when every gate passes.
 *
 * @param options.prove Refresh the plan-bound proof before the gauntlet.
 * @param options.rehearse Refresh the artifact manifest before the gauntlet.
 * @param options.beforeConfirm Optional confirmation gate run after prove/rehearse
 *   and before the disk-proof check; returning `false` yields `Canceled`.
 */
export const apply = <ConfirmError = never, ConfirmRequirements = never>(
  plan: Plan,
  options: {
    readonly prove: boolean
    readonly rehearse: boolean
    readonly beforeConfirm?: () => Effect.Effect<boolean, ConfirmError, ConfirmRequirements>
  },
) =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const softWarnings = Array<string>()

    if (options.prove) {
      const observations = yield* Proof.collectObservations(plan)
      const proof = yield* Proof.prove(plan, observations)
      softWarnings.push(...softWarningsOf(proof, plan))
      if (Proof.hasBlockingProof(proof, plan.proofPolicy)) {
        return blocked(
          'prove',
          ['Plan proof contains blocking records. Run `release prove` for detail.'],
          softWarnings,
        )
      }
    }

    if (options.rehearse) {
      yield* Artifact.rehearse(plan)
    }

    if (options.beforeConfirm !== undefined) {
      const approved = yield* options.beforeConfirm()
      if (!approved) return canceled()
    }

    // A plan-bound proof on disk that fails to decode (e.g. written against an
    // older proof schema version) is treated like a missing proof: the operator
    // must re-prove. Surface a typed result instead of leaking a decode error.
    const proofResult = yield* Effect.result(Proof.readForPlan(plan))
    if (proofResult._tag === 'Failure') {
      if (Schema.isSchemaError(proofResult.failure)) return proofUnreadable()
      return yield* Effect.fail(proofResult.failure)
    }
    const diskProof = proofResult.success
    if (Option.isNone(diskProof)) return proofMissing()

    softWarnings.push(...softWarningsOf(diskProof.value, plan))
    if (Proof.hasBlockingProof(diskProof.value, plan.proofPolicy)) {
      return blocked(
        'disk-proof',
        [
          'Plan-bound proof contains blocking records.',
          'Run `release prove` and resolve every failed or unprovable proof.',
        ],
        softWarnings,
      )
    }

    // Re-observe local credential and GitHub surfaces and rebuild the proof by
    // overlaying those fresh observations on the prior artifact's evidence,
    // immediately before mutation — so a credential that expired since `release
    // prove` blocks the apply. This must run after the disk-proof check (so a
    // healthy prior is required) and before execution (so the executor's
    // per-mutation hook starts from the rechecked artifact).
    const recheckObservations = yield* Proof.collectObservations(plan)
    const reproveNow = new Date().toISOString()
    const rechecked = Proof.recheckProof({
      plan,
      prior: diskProof.value,
      observations: recheckObservations,
      now: reproveNow,
    })
    yield* Proof.write(rechecked, Proof.proofPathFor(env.cwd, plan))
    softWarnings.push(...softWarningsOf(rechecked, plan, reproveNow))
    if (Proof.hasBlockingProof(rechecked, plan.proofPolicy)) {
      return blocked(
        'recheck',
        [
          'Pre-apply proof recheck found blocking records.',
          'A credential or environment surface changed since `release prove`; re-prove and resolve.',
        ],
        softWarnings,
      )
    }

    const artifacts = yield* Artifact.readManifest(plan)
    if (Option.isNone(artifacts)) {
      return blocked(
        'artifact',
        [
          'Artifact manifest is missing.',
          'Run `release rehearse` or `release apply --prove --rehearse` before publishing.',
        ],
        softWarnings,
      )
    }
    const artifactIssues = yield* Artifact.validateManifestFilesForPlan(plan, artifacts.value)
    if (artifactIssues.length > 0) {
      return blocked(
        'artifact',
        [
          'Artifact manifest does not match the frozen plan.',
          ...artifactIssues.map((issue) => `${issue.code}: ${issue.detail}`),
        ],
        softWarnings,
      )
    }

    if (plan.source !== undefined) {
      // Validate the full staleness proof set (config digest, head SHA,
      // toolchain, subcommands, lockfiles) against a freshly observed snapshot.
      const configResult = yield* Effect.result(Config.load())
      if (configResult._tag === 'Failure') {
        return blocked(
          'source-snapshot',
          [
            'Cannot verify release staleness: failed to load the current release config.',
            configResult.failure.message,
          ],
          softWarnings,
        )
      }
      const observedSource = yield* Planner.buildSourceSnapshot({ config: configResult.success })
      const sourceIssues = Planner.validateSourceSnapshot(plan.source, observedSource)
      if (sourceIssues.length > 0) {
        return blocked(
          'source-snapshot',
          [
            'Release source snapshot is stale.',
            ...sourceIssues.map((issue) => `${issue.code}: ${issue.detail}`),
          ],
          softWarnings,
        )
      }
    }

    const scriptPolicyIssues = yield* Artifact.validateScriptPolicyForPlan(plan)
    if (scriptPolicyIssues.length > 0) {
      return blocked(
        'script-policy',
        [
          'Release artifact script policy is not satisfied.',
          ...scriptPolicyIssues.map((issue) => `${issue.code}: ${issue.detail}`),
        ],
        softWarnings,
      )
    }
    const enginePolicyIssues = yield* Artifact.validateEnginePolicyForPlan(plan)
    if (enginePolicyIssues.length > 0) {
      return blocked(
        'engine-policy',
        [
          'Release artifact engine policy is not satisfied.',
          ...enginePolicyIssues.map((issue) => `${issue.code}: ${issue.detail}`),
        ],
        softWarnings,
      )
    }

    const runtime = yield* Explorer.explore()
    const runtimeConfig = Explorer.toExecutorRuntimeConfig(runtime)
    if (!runtimeConfig.github) {
      return blocked(
        'runtime',
        [
          'GitHub release target and token are required for release apply.',
          'Set GITHUB_TOKEN and ensure origin points to GitHub, then retry.',
        ],
        softWarnings,
      )
    }

    return ready(rechecked, runtimeConfig.github, softWarnings)
  })
