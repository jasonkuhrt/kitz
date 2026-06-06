/**
 * @module cli/commands/proof-recheck-hook
 *
 * The proof-aware before-mutation gate that release commands inject into the
 * executor. The executor stays proof-blind: it runs this opaque hook immediately
 * before every mutating node and aborts the mutation if the hook fails. The hook
 * lives here, shared, because more than one command boundary drives a mutation
 * through the executor (`apply` for a fresh run, `resume` for an interrupted one)
 * and both must gate identically.
 */
import { Effect } from 'effect'
import * as Api from '../../api/__.js'
import type { BeforeMutationHook } from '../../api/executor/execute.js'

/**
 * Build the proof-aware before-mutation gate a release command injects into the
 * executor.
 *
 * The hook re-observes local credential and registry surfaces, re-derives the
 * `pre-each-mutation` proof records from those fresh observations, and blocks the
 * pending mutation when the recheck turns up a blocking record (e.g. a credential
 * or local surface changed mid-release). It persists nothing — it only re-observes
 * and gates — so its requirements stay `Git.Git | NpmRegistry.NpmCli`.
 */
export const makeProofRecheckHook =
  (params: {
    readonly plan: Api.Planner.Plan
    readonly prior: Api.ReleaseContract.ProofArtifact
  }): BeforeMutationHook =>
  (ctx) =>
    Effect.gen(function* () {
      const observations = yield* Api.Proof.collectLocalObservations(params.plan)
      const rechecked = Api.Proof.recheckProof({
        plan: params.plan,
        prior: params.prior,
        phase: 'pre-mutation',
        observations,
        now: new Date().toISOString(),
      })
      if (Api.Proof.hasBlockingProof(rechecked, params.plan.proofPolicy)) {
        return yield* Effect.fail(
          new Api.Executor.Errors.ExecutorBeforeMutationError({
            context: {
              kind: ctx.kind,
              subject: ctx.subject,
              detail:
                'A pre-each-mutation proof recheck found blocking records (a credential or local surface changed mid-release).',
            },
          }),
        )
      }
    })
