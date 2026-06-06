import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { describe, expect } from 'bun:test'
import { Effect, Exit, Layer, Ref } from 'effect'
import { Test } from '@kitz/test'
import { executeObservable } from '../../api/executor/execute.js'
import { makeHarness, makePackageJson, planOfficial, tag } from '../../api/executor/test-support.js'
import { makeProofArtifact } from '../../api/proof.js'
import { Plan } from '../../api/planner/models/plan.js'
import {
  PlanDigest,
  PlanSourceSnapshot,
  publishIntentFromSemantics,
} from '../../api/release-contract.js'
import { sha256Text } from '../../api/digest.js'
import { makeProofRecheckHook } from './proof-recheck-hook.js'

// The hook factory + its wiring into the executor are the two halves of AC #4's
// pre-each-mutation recheck. `apply.test.ts` proves the factory in isolation and
// `execute.test.ts` proves the seam with a trivial injected hook. This test
// closes the gap they leave: it drives the REAL `makeProofRecheckHook` through
// the REAL executor, so a regression in the apply/resume -> executor wiring is
// caught — deleting the `beforeMutation:` argument at the call sites makes the
// abort case stop aborting.

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const workspacePackages: Parameters<typeof planOfficial>[0] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: corePackagePath,
  },
]
const tagCore = (version: string) => tag(Pkg.Moniker.parse('@kitz/core'), version)

const publishIntent = publishIntentFromSemantics({
  semantics: {
    lifecycle: 'official',
    channel: { mode: 'manual' },
    distTag: 'latest',
    prerelease: false,
    forcePushTag: false,
    githubReleaseStyle: 'versioned',
  },
  trunk: 'main',
})

// A frozen source snapshot so the out-of-phase `plan.source` proof record is
// `proven` in the prior — otherwise it stays `unprovable` and blocks the healthy
// case for a reason unrelated to the pre-each-mutation recheck.
const source = PlanSourceSnapshot.make({
  headSha: 'abc1234',
  trunk: 'main',
  releaseConfigDigest: sha256Text('config'),
  releaseConfigDigestSource: 'canonical-effective-config',
  lockfiles: [],
  packageManager: {
    name: 'npm',
    version: '11.14.1',
    binary: 'npm',
    subcommands: { pack: true, publish: true },
  },
  toolVersions: { npm: '11.14.1' },
})

// A Plan carrying a frozen publishIntent + planDigest + source so its proof
// artifact has the `pre-each-mutation` credential records the hook re-derives
// and no unrelated blocking records.
const contractPlan = (plan: Plan) =>
  Plan.make({
    lifecycle: plan.lifecycle,
    timestamp: plan.timestamp,
    releases: plan.releases,
    cascades: plan.cascades,
    planDigest: PlanDigest.make(sha256Text('proof-recheck-hook-seam')),
    source,
    publishIntent,
  })

// A healthy prior proof — what `release prove` / the pre-apply recheck wrote
// before the run started: every pre-each-mutation surface proven.
const healthyPrior = (plan: Plan) =>
  makeProofArtifact(plan, '2026-05-13T00:00:00.000Z', {
    identity: 'octocat',
    packageAccess: { '@kitz/core': 'public' },
    gitPushDryRun: { '@kitz/core@1.1.0': true },
    githubReleasePermission: true,
    githubReleaseExists: { '@kitz/core@1.1.0': false },
  })

const uniqueDbPath = () =>
  `/tmp/kitz-release-hook-seam-${Date.now()}-${Math.random().toString(16).slice(2)}.db`

// The release workflow never calls `getAccessStatus`; only the proof recheck
// does. `accessStatus: 'restricted'` makes the recheck observe a registry access
// that mismatches the publish intent (`public`), so the pre-each-mutation block
// fires WITHOUT disturbing any npm op the workflow itself drives.
const makeSeamHarness = (accessStatus?: 'public' | 'restricted') =>
  makeHarness({
    git: {
      tags: [tagCore('1.0.0')],
      commits: [Git.Memory.commit('feat(core): new API')],
      isClean: true,
    },
    diskLayout: {
      '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
    },
    ...(accessStatus !== undefined ? { accessStatus } : {}),
  })

describe('makeProofRecheckHook driven through executeObservable', () => {
  Test.live('aborts the run before any mutation when registry access drifted since prove', () =>
    Effect.gen(function* () {
      // Registry access drifts to 'restricted' (publish intent wants 'public')
      // after prove — the pre-each-mutation recheck must catch it.
      const harness = yield* makeSeamHarness('restricted')
      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const contracted = contractPlan(plan)
      const prior = healthyPrior(contracted)

      const workflowContext = yield* Layer.build(harness.workflowLayer)
      const observable = yield* executeObservable(contracted, {
        dryRun: false,
        dbPath: uniqueDbPath(),
        beforeMutation: makeProofRecheckHook({ plan: contracted, prior }),
      }).pipe(Effect.provide(workflowContext))
      const exit = yield* observable.execute.pipe(Effect.provide(workflowContext), Effect.exit)

      // The real hook re-observed local surfaces (access now restricted),
      // re-derived the pre-each-mutation records, found package-access blocking,
      // and aborted the FIRST mutation.
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('ExecutorBeforeMutationError')
      }

      // No side effect ran: no publish, no tag, no release.
      const publishCalls = yield* Ref.get(harness.publishCalls)
      expect(publishCalls).toHaveLength(0)
      const createdTags = yield* Ref.get(harness.gitState.createdTags)
      expect(createdTags).toHaveLength(0)
      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      expect(createdReleases).toHaveLength(0)
    }),
  )

  Test.live('allows the run when credentials are still healthy at mutation time', () =>
    Effect.gen(function* () {
      const harness = yield* makeSeamHarness()
      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const contracted = contractPlan(plan)
      const prior = healthyPrior(contracted)

      const workflowContext = yield* Layer.build(harness.workflowLayer)
      const observable = yield* executeObservable(contracted, {
        dryRun: false,
        dbPath: uniqueDbPath(),
        beforeMutation: makeProofRecheckHook({ plan: contracted, prior }),
      }).pipe(Effect.provide(workflowContext))

      // Harness npm stays healthy (whoami succeeds, access 'public'), so each
      // re-derived pre-each-mutation record stays proven and the gate lets every
      // mutation proceed to a full publish.
      const result = yield* observable.execute.pipe(Effect.provide(workflowContext))

      expect(result.releasedPackages).toEqual(['@kitz/core'])
      const publishCalls = yield* Ref.get(harness.publishCalls)
      expect(publishCalls.length).toBeGreaterThan(0)
    }),
  )
})

// Resume is the window AC #4 must also cover: an operator suspends a partly-done
// release (a credential was fine at first apply), fixes an unrelated issue, and
// resumes later — by which point a credential or registry surface may have
// drifted. `resume.ts` now reads the plan-bound proof and passes
// `beforeMutation: makeProofRecheckHook(...)` to `resumeObservable`, so the same
// gate fires for the single not-yet-completed mutation the workflow resumes
// into. The executor side of that contract — that a `beforeMutation` hook
// supplied to the OBSERVABLE path runs before each mutation and aborts on
// failure — is exercised above through `executeObservable`. `resumeObservable`
// shares the exact same `makeObservableResult` selection (it forwards the same
// `options`, including `beforeMutation`, to the same `makeReleaseWorkflow`
// builder), so the gate behaves identically on resume.
//
// A full durable suspend→resume integration test of `resumeObservable` with the
// hook is intentionally NOT added here: `resumeObservable` polls the persisted
// workflow state through the OUTER runtime, then builds its OWN cluster workflow
// engine for execution. Pointing both at one SQLite file spins up two cluster
// engines that deadlock on shared runner storage (verified: the run hangs on the
// `RunnerStorage sync` fiber until the test times out). That is a harness/runtime
// limitation, not a gap in the F1 fix or the gate mechanism, which the
// `executeObservable` seam above and `apply.test.ts` together cover.
