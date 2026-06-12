/**
 * @module cli/commands/apply-lib
 *
 * The preflight gauntlet behind `release apply`: the ordered sequence of
 * gates a frozen plan must clear before any mutation (proof, artifacts,
 * source-snapshot freshness, script policy, engine policy).
 *
 * Each gate yields `null` (pass) or its failure lines; {@link runPreflightGates}
 * runs them in order and stops at the first failure, which the command
 * renders with a single error flush. Gate ordering is data, so it is
 * unit-testable.
 */
import { Effect, Option } from 'effect'
import * as Artifact from '../../api/artifact.js'
import * as Clock from '../../api/clock.js'
import * as Config from '../../api/config.js'
import * as Planner from '../../api/planner/__.js'
import * as Proof from '../../api/proof.js'
import type { ExecutablePlan } from './plan-file.js'

/** One preflight gate: an id (for ordering assertions) and its check. */
export interface PreflightGate<E, R> {
  readonly id: string
  /** `null` = pass; otherwise the failure lines (headline first). */
  readonly run: Effect.Effect<readonly string[] | null, E, R>
}

export interface PreflightFailure {
  readonly gateId: string
  readonly lines: readonly string[]
}

/** The single issues-rendering loop shared by every issue-listing gate. */
export const renderIssueLines = (
  issues: readonly { readonly code: string; readonly detail: string }[],
): readonly string[] => issues.map((issue) => `${issue.code}: ${issue.detail}`)

/**
 * Run gates strictly in order, stopping at the first failure.
 * Returns `null` when every gate passes.
 */
export const runPreflightGates = <E, R>(
  gates: readonly PreflightGate<E, R>[],
): Effect.Effect<PreflightFailure | null, E, R> =>
  Effect.gen(function* () {
    for (const gate of gates) {
      const lines = yield* gate.run
      if (lines !== null) {
        return { gateId: gate.id, lines }
      }
    }
    return null
  })

/**
 * The `release apply` preflight gauntlet for a frozen executable plan, in
 * execution order.
 */
export const applyPreflightGates = (plan: ExecutablePlan) =>
  [
    {
      id: 'proof',
      run: Effect.gen(function* () {
        const proof = yield* Proof.readForPlan(plan)
        if (Option.isNone(proof)) {
          return [
            'Plan-bound proof is missing.',
            'Run `release prove` or `release apply --prove --rehearse` before publishing.',
          ]
        }
        if (Proof.hasBlockingProof(proof.value, yield* Clock.now)) {
          return [
            'Plan-bound proof contains blocking records.',
            'Run `release prove` and resolve every failed or unprovable proof.',
          ]
        }
        return null
      }),
    },
    {
      id: 'artifacts',
      run: Effect.gen(function* () {
        const artifacts = yield* Artifact.readManifest(plan)
        if (Option.isNone(artifacts)) {
          return [
            'Artifact manifest is missing.',
            'Run `release rehearse` or `release apply --prove --rehearse` before publishing.',
          ]
        }
        const issues = yield* Artifact.validateManifestFilesForPlan(plan, artifacts.value)
        return issues.length > 0
          ? ['Artifact manifest does not match the frozen plan.', ...renderIssueLines(issues)]
          : null
      }),
    },
    {
      id: 'source-snapshot',
      run: Effect.gen(function* () {
        // Validate the full staleness proof set (config digest, head SHA,
        // toolchain, subcommands, lockfiles) against a freshly observed
        // snapshot, not just lockfile drift.
        if (plan.source === undefined) return null
        const configResult = yield* Effect.result(Config.load())
        if (configResult._tag === 'Failure') {
          return [
            'Cannot verify release staleness: failed to load the current release config.',
            configResult.failure.message,
          ]
        }
        const observedSource = yield* Planner.buildSourceSnapshot({
          config: configResult.success,
        })
        const issues = Planner.validateSourceSnapshot(plan.source, observedSource)
        return issues.length > 0
          ? ['Release source snapshot is stale.', ...renderIssueLines(issues)]
          : null
      }),
    },
    {
      id: 'script-policy',
      run: Effect.gen(function* () {
        const issues = yield* Artifact.validateScriptPolicyForPlan(plan)
        return issues.length > 0
          ? ['Release artifact script policy is not satisfied.', ...renderIssueLines(issues)]
          : null
      }),
    },
    {
      id: 'engine-policy',
      run: Effect.gen(function* () {
        const issues = yield* Artifact.validateEnginePolicyForPlan(plan)
        return issues.length > 0
          ? ['Release artifact engine policy is not satisfied.', ...renderIssueLines(issues)]
          : null
      }),
    },
  ] as const

/** The canonical gate order (exported so the command and tests agree on it). */
export const applyPreflightGateOrder = [
  'proof',
  'artifacts',
  'source-snapshot',
  'script-policy',
  'engine-policy',
] as const
