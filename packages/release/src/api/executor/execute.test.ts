import { Str } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Test } from '@kitz/test'
import { Effect, Exit, Layer, Option, Ref } from 'effect'
import { describe, expect, test } from 'bun:test'
import { ReleaseCommit } from '../analyzer/models/commit.js'
import { Official } from '../planner/models/item-official.js'
import { Plan } from '../planner/models/plan.js'
import { OfficialIncrement } from '../version/models/official-increment.js'
import {
  type BeforeMutationHook,
  executeObservable,
  formatExecutionStatus,
  formatLifecycleEvent,
  type MutationContext,
  toPayload,
} from './execute.js'
import { ExecutorBeforeMutationError } from './errors.js'
import { makeHarness, makePackageJson, planOfficial, tag } from './test-support.js'

const makePackage = (scope: string) => ({
  scope,
  name: Pkg.Moniker.parse(`@kitz/${scope}`),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const makeRelease = (
  scope: string,
  from: string,
  to: string,
  commits: ReturnType<typeof ReleaseCommit.make>[] = [],
) =>
  Official.make({
    package: makePackage(scope),
    version: OfficialIncrement.make({
      from: Semver.fromString(from),
      to: Semver.fromString(to),
      bump: 'minor',
    }),
    commits,
  })

describe('executor execute helpers', () => {
  test('formats lifecycle events into printable log lines', () => {
    expect(formatLifecycleEvent({ _tag: 'ActivityStarted', activity: 'publish' } as any)).toEqual({
      level: 'info',
      message: '  › Starting: publish',
    })
    expect(formatLifecycleEvent({ _tag: 'ActivityCompleted', activity: 'publish' } as any)).toEqual(
      {
        level: 'info',
        message: '✓ Completed: publish',
      },
    )
    expect(
      formatLifecycleEvent({
        _tag: 'ActivityFailed',
        activity: 'publish',
        error: 'boom',
      } as any),
    ).toEqual({
      level: 'error',
      message: '✗ Failed: publish - boom',
    })
    expect(formatLifecycleEvent({ _tag: 'WorkflowStarted' } as any)).toBeUndefined()
  })

  test('renders colored lifecycle events and workflow status summaries', () => {
    const completed = formatLifecycleEvent(
      { _tag: 'ActivityCompleted', activity: 'publish' } as any,
      { color: true },
    )
    const status = formatExecutionStatus(
      {
        state: 'not-started',
        executionId: 'release-official:test',
        lifecycle: 'official',
        plannedPackages: ['@kitz/core'],
      },
      { color: true },
    )

    expect(completed?.message).toContain('\u001b[')
    expect(Str.Visual.strip(completed?.message ?? '')).toContain('Completed: publish')
    expect(status).toContain('\u001b[')
    expect(Str.Visual.strip(status)).toContain('Run `release apply` to start the workflow.')
  })

  test('builds workflow payloads in dependency order and normalizes commit data', async () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-03-23T00:00:00.000Z',
      releases: [makeRelease('cli', '1.0.0', '1.1.0'), makeRelease('core', '1.0.0', '1.1.0')],
      cascades: [],
    })

    const payload = await Effect.runPromise(
      toPayload(plan, {
        dryRun: true,
        tag: 'next',
        registry: 'https://registry.npmjs.org',
        publishing: {
          official: { mode: 'manual' },
          candidate: { mode: 'manual' },
          ephemeral: { mode: 'manual' },
        },
        trunk: 'main',
      }).pipe(
        Effect.provide(
          Fs.Memory.layer({
            '/repo/packages/core/package.json': JSON.stringify({
              name: '@kitz/core',
              version: '1.0.0',
            }),
            '/repo/packages/cli/package.json': JSON.stringify({
              name: '@kitz/cli',
              version: '1.0.0',
              dependencies: {
                '@kitz/core': 'workspace:*',
              },
            }),
          }),
        ),
      ),
    )

    expect(payload.releases.map((release) => release.packageName)).toEqual([
      '@kitz/core',
      '@kitz/cli',
    ])
    expect(payload.releases[1]!.dependsOn).toEqual(['@kitz/core'])
    expect(payload.releases[0]!.currentVersion).toEqual(Option.some('1.0.0'))
    expect(payload.options).toEqual({
      dryRun: true,
      planDigest: expect.any(String),
      rehearsedArtifacts: false,
      atomicTagPush: false,
      tag: 'next',
      registry: 'https://registry.npmjs.org',
      lifecycle: 'official',
      publishing: {
        official: { mode: 'manual' },
        candidate: { mode: 'manual' },
        ephemeral: { mode: 'manual' },
      },
      trunk: 'main',
      packDriver: 'npm',
      publishInvoker: 'npm',
    })
  })
})

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const seamWorkspacePackages: Parameters<typeof planOfficial>[0] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: corePackagePath,
  },
]
const tagCore = (version: string) => tag(Pkg.Moniker.parse('@kitz/core'), version)

const makeSeamHarness = () =>
  makeHarness({
    git: {
      tags: [tagCore('1.0.0')],
      commits: [Git.Memory.commit('feat(core): new API')],
      isClean: true,
    },
    diskLayout: {
      '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
    },
  })

const uniqueDbPath = () =>
  `/tmp/kitz-release-seam-${Date.now()}-${Math.random().toString(16).slice(2)}.db`

describe('executeObservable beforeMutation seam', () => {
  // The executor stays proof-blind: it forwards generic mutation identity to the
  // injected hook and knows nothing about proofs. These tests prove the seam
  // contract (hook fires before each mutation; a hook failure aborts the
  // mutation before any side effect runs), independent of any proof semantics.
  Test.live('invokes beforeMutation before every mutating node, never for non-mutating nodes', () =>
    Effect.gen(function* () {
      const harness = yield* makeSeamHarness()
      const plan = yield* planOfficial(seamWorkspacePackages).pipe(
        Effect.provide(harness.planLayer),
      )

      const seen = yield* Ref.make<readonly MutationContext[]>([])
      const beforeMutation: BeforeMutationHook = (ctx) =>
        Ref.update(seen, (entries) => [...entries, ctx])

      const workflowContext = yield* Layer.build(harness.workflowLayer)
      const observable = yield* executeObservable(plan, {
        dryRun: false,
        dbPath: uniqueDbPath(),
        beforeMutation,
      }).pipe(Effect.provide(workflowContext))
      const result = yield* observable.execute.pipe(Effect.provide(workflowContext))

      expect(result.releasedPackages).toEqual(['@kitz/core'])

      const observed = yield* Ref.get(seen)
      // One mutation per mutating node for a single-package official release:
      // registry-publish, git-tag-create, git-tag-push, github-release-create.
      // No Prepare/VerifyPublish node ever drives the hook.
      expect(observed.map((ctx) => ctx.kind)).toEqual([
        'registry-publish',
        'git-tag-create',
        'git-tag-push',
        'github-release-create',
      ])
      expect(observed.every((ctx) => typeof ctx.subject === 'string')).toBe(true)
      expect(observed[0]!.subject).toBe(tagCore('1.1.0'))
    }),
  )

  Test.live('a beforeMutation failure aborts the run before the mutation side effect runs', () =>
    Effect.gen(function* () {
      const harness = yield* makeSeamHarness()
      const plan = yield* planOfficial(seamWorkspacePackages).pipe(
        Effect.provide(harness.planLayer),
      )

      // Block at the very first mutation (registry-publish) so no side effect
      // should ever fire.
      const beforeMutation: BeforeMutationHook = (ctx) =>
        ctx.kind === 'registry-publish'
          ? Effect.fail(
              new ExecutorBeforeMutationError({
                context: { kind: ctx.kind, subject: ctx.subject, detail: 'gate rejected' },
              }),
            )
          : Effect.void

      const workflowContext = yield* Layer.build(harness.workflowLayer)
      const observable = yield* executeObservable(plan, {
        dryRun: false,
        dbPath: uniqueDbPath(),
        beforeMutation,
      }).pipe(Effect.provide(workflowContext))
      const exit = yield* observable.execute.pipe(Effect.provide(workflowContext), Effect.exit)

      expect(Exit.isFailure(exit)).toBe(true)

      // The publish mutation never ran: no publish call, no created tag, no
      // pushed tag, no GitHub release.
      const publishCalls = yield* Ref.get(harness.publishCalls)
      expect(publishCalls).toHaveLength(0)
      const createdTags = yield* Ref.get(harness.gitState.createdTags)
      expect(createdTags).toHaveLength(0)
      const pushedTags = yield* Ref.get(harness.gitState.pushedTags)
      expect(pushedTags).toHaveLength(0)
      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      expect(createdReleases).toHaveLength(0)
    }),
  )
})
