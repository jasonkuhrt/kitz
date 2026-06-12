import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Test } from '@kitz/test'
import { Effect, Exit, FileSystem, Option, Ref } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { execute, executeObservable, toPayload } from './execute.js'
import { ReleaseWorkflow } from './workflow.js'
import { digestForPlan } from '../proof.js'
import { publishIntentFromSemantics } from '../release-contract.js'
import { resolvePublishSemantics } from '../publishing.js'
import { Plan } from '../planner/models/plan.js'
import {
  type Harness,
  decodeJsonRecordSync,
  decodeSemverFromManifest,
  makeHarness,
  makeMockSpawnerLayer,
  makePackageJson,
  planCandidate,
  planEphemeral,
  planOfficial,
  tag,
} from './test-support.js'

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const coreManifestPath = Fs.Path.AbsFile.fromString('/repo/packages/core/package.json')
const cliPackagePath = Fs.Path.AbsDir.fromString('/repo/packages/cli/')
const workspacePackages: Parameters<typeof planOfficial>[0] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: corePackagePath,
  },
]
const cycleWorkspacePackages: Parameters<typeof planOfficial>[0] = [
  {
    name: Pkg.Moniker.parse('@kitz/a'),
    scope: 'a',
    path: Fs.Path.AbsDir.fromString('/repo/packages/a/'),
  },
  {
    name: Pkg.Moniker.parse('@kitz/b'),
    scope: 'b',
    path: Fs.Path.AbsDir.fromString('/repo/packages/b/'),
  },
  {
    name: Pkg.Moniker.parse('@kitz/c'),
    scope: 'c',
    path: Fs.Path.AbsDir.fromString('/repo/packages/c/'),
  },
]

const tagCore = (version: string) => tag(Pkg.Moniker.parse('@kitz/core'), version)
const tagA = (version: string) => tag(Pkg.Moniker.parse('@kitz/a'), version)
const tagB = (version: string) => tag(Pkg.Moniker.parse('@kitz/b'), version)
const tagC = (version: string) => tag(Pkg.Moniker.parse('@kitz/c'), version)
type HarnessOptions = Parameters<typeof makeHarness>[0]

const coreGit: HarnessOptions['git'] = {
  tags: [tagCore('1.0.0')],
  commits: [Git.Memory.commit('feat(core): new API')],
  isClean: true,
}
const coreDiskLayout = {
  '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
}
const makeCoreHarness = (options?: {
  readonly git?: Partial<HarnessOptions['git']>
  readonly diskLayout?: Fs.Memory.DiskLayout
  readonly failPackPackages?: readonly string[]
  readonly failPublishPackages?: readonly string[]
  readonly missingRegistryVersions?: readonly string[]
  readonly observedDistTags?: Readonly<Record<string, string>>
}) =>
  makeHarness({
    git: { ...coreGit, ...options?.git },
    diskLayout: options?.diskLayout ?? coreDiskLayout,
    ...(options?.failPackPackages ? { failPackPackages: options.failPackPackages } : {}),
    ...(options?.failPublishPackages ? { failPublishPackages: options.failPublishPackages } : {}),
    ...(options?.missingRegistryVersions
      ? { missingRegistryVersions: options.missingRegistryVersions }
      : {}),
    ...(options?.observedDistTags ? { observedDistTags: options.observedDistTags } : {}),
  })

const cycleGit: HarnessOptions['git'] = {
  tags: [tagA('1.0.0'), tagB('1.0.0'), tagC('1.0.0')],
  commits: [Git.Memory.commit('feat(a): add feature'), Git.Memory.commit('feat(b): add feature')],
  isClean: true,
}
const cycleDiskLayout = {
  '/repo/packages/a/package.json': makePackageJson('@kitz/a', '1.0.0', {
    dependencies: {
      '@kitz/b': 'workspace:^',
    },
  }),
  '/repo/packages/b/package.json': makePackageJson('@kitz/b', '1.0.0', {
    dependencies: {
      '@kitz/a': 'workspace:^',
    },
  }),
  '/repo/packages/c/package.json': makePackageJson('@kitz/c', '1.0.0', {
    dependencies: {
      '@kitz/a': 'workspace:^',
    },
  }),
}
const makeCycleHarness = () => makeHarness({ git: cycleGit, diskLayout: cycleDiskLayout })
type FailureOutcome = {
  readonly _tag: string
  readonly failure?: {
    readonly _tag: string
    readonly context?: unknown
  }
}

const expectFailure = (outcome: FailureOutcome, tag: string) => {
  expect(outcome._tag).toBe('Failure')
  if (outcome._tag !== 'Failure') throw new Error('expected failure')
  expect(outcome.failure?._tag).toBe(tag)
  return outcome.failure!
}

const expectPreflightFailure = (outcome: FailureOutcome, check: string) => {
  const failure = expectFailure(outcome, 'ExecutorPreflightError') as {
    readonly context: { readonly check: string }
  }
  expect(failure.context.check).toBe(check)
}

const expectDependencyCycleFailure = (outcome: FailureOutcome) => {
  const failure = expectFailure(outcome, 'ExecutorDependencyCycleError') as {
    readonly context: { readonly packages: readonly string[]; readonly edges: readonly string[] }
  }
  expect(failure.context.packages).toEqual(['@kitz/a', '@kitz/b'])
  expect(failure.context.edges).toEqual(['@kitz/a -> @kitz/b', '@kitz/b -> @kitz/a'])
}

const expectRestoredCoreManifest = (manifestRaw: string) => {
  const manifest = decodeJsonRecordSync(manifestRaw)
  expect(
    Semver.equivalence(decodeSemverFromManifest(manifest[`version`]), Semver.fromString('1.0.0')),
  ).toBe(true)
  return manifest
}

const expectSingleReleaseTag = (plan: Plan) => {
  const plannedRelease = plan.releases[0]
  expect(plannedRelease).toBeDefined()
  return tag(plannedRelease!.package.name, Semver.toString(plannedRelease!.nextVersion))
}

const seedExistingCandidateRelease = (candidateTag: string) =>
  Effect.gen(function* () {
    const gh = yield* Github.Github
    yield* gh.createRelease({
      tag: candidateTag,
      title: '@kitz/core @next',
      body: 'existing',
      prerelease: true,
    })
  })

const expectFirstPublishTag = (harness: Harness, expected: string) =>
  Effect.gen(function* () {
    const publishCalls = yield* harness.publishCalls
    expect(publishCalls[0]?.tag).toBe(expected)
  })

describe('Executor integration', () => {
  Test.live(
    'runs non-dry-run official workflow with mocked services and restores manifest semver',
    () =>
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

        expect(plan.releases).toHaveLength(1)

        const result = yield* execute(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
        )

        expect(result.releasedPackages).toEqual(['@kitz/core'])
        expect(result.createdTags).toEqual([tagCore('1.1.0')])
        expect(result.createdGHReleases).toEqual([tagCore('1.1.0')])

        const createdTags = yield* Ref.get(harness.gitState.createdTags)
        expect(createdTags.map((entry) => entry.tag)).toContain(tagCore('1.1.0'))

        const pushedTags = yield* Ref.get(harness.gitState.pushedTags)
        expect(pushedTags).toHaveLength(1)

        const packCalls = yield* harness.packCalls
        expect(packCalls).toHaveLength(1)
        expect(packCalls[0]!.manifestSnapshot['version']).toBe('1.1.0')

        const publishCalls = yield* harness.publishCalls
        expect(publishCalls).toHaveLength(1)
        expect(Fs.Path.toString(publishCalls[0]!.tarball)).toBe(
          `/repo/.release/artifacts/${digestForPlan(plan).value}/kitz-core-1.1.0.tgz`,
        )
        expect(publishCalls[0]!.ignoreScripts).toBe(true)

        const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
        expect(createdReleases).toHaveLength(1)
        expect(createdReleases[0]!.tag).toBe(tagCore('1.1.0'))
        expect(createdReleases[0]!.title).toBe('@kitz/core v1.1.0')

        const manifestRaw = yield* Fs.readString(coreManifestPath).pipe(
          Effect.provide(harness.workflowLayer),
        )
        expectRestoredCoreManifest(manifestRaw)
      }),
  )

  Test.live('uses the frozen publish profile package-manager driver for pack and publish', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const contractedPlan = Plan.make({
        lifecycle: plan.lifecycle,
        timestamp: plan.timestamp,
        releases: plan.releases,
        cascades: plan.cascades,
        publishIntent: publishIntentFromSemantics({
          semantics: resolvePublishSemantics({ lifecycle: 'official' }),
          trunk: 'main',
          packageManager: 'pnpm',
        }),
      })

      yield* execute(contractedPlan, { dryRun: false }).pipe(Effect.provide(harness.workflowLayer))

      const packCalls = yield* harness.packCalls
      const publishCalls = yield* harness.publishCalls

      expect(packCalls[0]?.packageManager).toBe('pnpm')
      expect(publishCalls[0]?.packageManager).toBe('pnpm')
    }),
  )

  Test.live(
    'publishes official releases to the configured npm dist-tag without a manual tag override',
    () =>
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

        yield* execute(plan, {
          dryRun: false,
          npmTag: 'beta',
        }).pipe(Effect.provide(harness.workflowLayer))

        yield* expectFirstPublishTag(harness, 'beta')
      }),
  )

  Test.live('fails preflight on conflicting tag and does not publish', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const conflictingTag = expectSingleReleaseTag(plan)
      yield* Ref.update(harness.gitState.tags, (tags) => [...tags, conflictingTag])

      const outcome = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.result,
      )

      expectPreflightFailure(outcome, 'plan.tags-unique')

      const publishAttempts = yield* harness.publishAttempts
      expect(publishAttempts).toBe(0)

      const createdTags = yield* Ref.get(harness.gitState.createdTags)
      expect(createdTags).toHaveLength(0)
    }),
  )

  Test.live('fails preflight when git working tree is dirty', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({ git: { isClean: false } })

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

      const outcome = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.result,
      )

      expectPreflightFailure(outcome, 'env.git-clean')

      const publishAttempts = yield* harness.publishAttempts
      expect(publishAttempts).toBe(0)
    }),
  )

  Test.live('fails preflight when official release is attempted off trunk', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({ git: { branch: 'feat/release' } })

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

      const outcome = yield* execute(plan, { dryRun: false, trunk: 'main' }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.result,
      )

      expectPreflightFailure(outcome, 'env.release-branch-allowed')

      const publishAttempts = yield* harness.publishAttempts
      expect(publishAttempts).toBe(0)
    }),
  )

  Test.live('fails before workflow start when planned packages form a local dependency cycle', () =>
    Effect.gen(function* () {
      const harness = yield* makeCycleHarness()

      const plan = yield* planOfficial(cycleWorkspacePackages).pipe(
        Effect.provide(harness.planLayer),
      )

      expect(plan.cascades.some((item) => item.package.name.moniker === '@kitz/c')).toBe(true)

      const outcome = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.result,
      )

      expectDependencyCycleFailure(outcome)

      const packCalls = yield* harness.packCalls
      expect(packCalls).toHaveLength(0)

      const publishAttempts = yield* harness.publishAttempts
      expect(publishAttempts).toBe(0)
    }),
  )

  Test.live('direct payload construction fails for dependency cycles', () =>
    Effect.gen(function* () {
      const harness = yield* makeCycleHarness()

      const plan = yield* planOfficial(cycleWorkspacePackages).pipe(
        Effect.provide(harness.planLayer),
      )

      const outcome = yield* toPayload(plan).pipe(Effect.provide(harness.planLayer), Effect.result)

      expectDependencyCycleFailure(outcome)

      const observableAttempt = yield* executeObservable(plan, {
        dryRun: true,
        dbPath: `/tmp/kitz-release-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
      }).pipe(Effect.provide(harness.planLayer), Effect.result)

      expectFailure(observableAttempt, 'ExecutorDependencyCycleError')
    }),
  )

  Test.live(
    'maps publish failures to ExecutorPublishError and restores manifest after retries',
    () =>
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({
          failPublishPackages: ['@kitz/core'],
        })

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

        const outcome = yield* execute(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )
        const failure = expectFailure(outcome, 'ExecutorPublishError') as {
          readonly context: { readonly packageName: string; readonly detail: string }
        }
        expect(failure.context.packageName).toBe('@kitz/core')
        expect(failure.context.detail).toContain('publish failure injected for @kitz/core')

        const publishAttempts = yield* harness.publishAttempts
        expect(publishAttempts).toBe(1)

        const createdTags = yield* Ref.get(harness.gitState.createdTags)
        expect(createdTags).toHaveLength(0)

        const manifestRaw = yield* Fs.readString(coreManifestPath).pipe(
          Effect.provide(harness.workflowLayer),
        )
        expectRestoredCoreManifest(manifestRaw)
      }),
  )

  Test.live('surfaces pack-hook cleanup guidance when artifact preparation fails', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0', {
            imports: {
              '#core': './src/_.ts',
            },
            exports: {
              '.': './src/_.ts',
            },
            scripts: {
              prepack: 'echo preparing',
            },
          }),
        },
        failPackPackages: ['@kitz/core'],
      })

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

      const outcome = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.result,
      )

      const failure = expectFailure(outcome, 'ExecutorPublishError') as {
        readonly context: { readonly detail: string }
      }
      expect(failure.context.detail).toContain('pack failure injected for @kitz/core')
      expect(failure.context.detail).toContain('Source package manifests were not mutated')
      expect(failure.context.detail).toContain('Pack hooks detected (prepack)')
      expect(failure.context.detail).toContain('plan.packages-runtime-targets-source-oriented')

      const manifestRaw = yield* Fs.readString(coreManifestPath).pipe(
        Effect.provide(harness.workflowLayer),
      )
      const manifest = expectRestoredCoreManifest(manifestRaw)
      expect(manifest['imports']).toEqual({
        '#core': './src/_.ts',
      })
      expect(manifest['exports']).toEqual({
        '.': './src/_.ts',
      })
    }),
  )

  Test.live('updates existing GitHub candidate release when tag option is next', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({
        git: { tags: [tagCore('1.0.0'), tagCore('1.1.0-next.1')] },
      })

      const plan = yield* planCandidate(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const candidateTag = expectSingleReleaseTag(plan)

      yield* seedExistingCandidateRelease(candidateTag).pipe(Effect.provide(harness.workflowLayer))

      const result = yield* execute(plan, { dryRun: false, tag: 'next' }).pipe(
        Effect.provide(harness.workflowLayer),
      )

      expect(result.createdGHReleases).toContain(candidateTag)

      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      const updatedReleases = yield* Ref.get(harness.githubState.updatedReleases)

      expect(createdReleases.filter((r) => r.tag === candidateTag)).toHaveLength(1)
      expect(updatedReleases.filter((r) => r.tag === candidateTag)).toHaveLength(1)
    }),
  )

  Test.live('publishes candidate releases to the default next dist-tag', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planCandidate(workspacePackages).pipe(Effect.provide(harness.planLayer))

      yield* execute(plan, { dryRun: false }).pipe(Effect.provide(harness.workflowLayer))

      yield* expectFirstPublishTag(harness, 'next')
    }),
  )

  Test.live(
    'publishes candidate releases to the configured candidate dist-tag without a manual tag override',
    () =>
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planCandidate(workspacePackages).pipe(Effect.provide(harness.planLayer))

        yield* execute(plan, {
          dryRun: false,
          candidateTag: 'candidate',
        }).pipe(Effect.provide(harness.workflowLayer))

        yield* expectFirstPublishTag(harness, 'candidate')
      }),
  )

  Test.live(
    'updates existing GitHub candidate release when tag option uses a custom candidate dist-tag',
    () =>
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({
          git: { tags: [tagCore('1.0.0'), tagCore('1.1.0-next.1')] },
        })

        const plan = yield* planCandidate(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const candidateTag = expectSingleReleaseTag(plan)

        yield* seedExistingCandidateRelease(candidateTag).pipe(
          Effect.provide(harness.workflowLayer),
        )

        const result = yield* execute(plan, { dryRun: false, tag: 'candidate' }).pipe(
          Effect.provide(harness.workflowLayer),
        )

        expect(result.createdGHReleases).toContain(candidateTag)

        const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
        const updatedReleases = yield* Ref.get(harness.githubState.updatedReleases)
        const releases = yield* Ref.get(harness.githubState.releases)

        expect(createdReleases.filter((r) => r.tag === candidateTag)).toHaveLength(1)
        expect(updatedReleases.filter((r) => r.tag === candidateTag)).toHaveLength(1)
        expect(updatedReleases.find((r) => r.tag === candidateTag)?.params.title).toBe(
          '@kitz/core @candidate',
        )
        expect(releases[candidateTag]?.name).toBe('@kitz/core @candidate')
      }),
  )

  Test.live('creates a new GitHub candidate release with the custom candidate dist-tag title', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planCandidate(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const candidateTag = expectSingleReleaseTag(plan)

      const result = yield* execute(plan, { dryRun: false, tag: 'candidate' }).pipe(
        Effect.provide(harness.workflowLayer),
      )

      expect(result.createdGHReleases).toContain(candidateTag)

      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      const createdCandidateRelease = createdReleases.find((r) => r.tag === candidateTag)
      const pushedTags = yield* Ref.get(harness.gitState.pushedTags)

      expect(createdCandidateRelease).toMatchObject({
        tag: candidateTag,
        title: '@kitz/core @candidate',
        prerelease: true,
      })
      expect(pushedTags).toContainEqual({ tag: candidateTag, remote: 'origin', force: true })
    }),
  )

  Test.live(
    'publishes ephemeral releases with a custom dist-tag while keeping GitHub prerelease semantics versioned',
    () =>
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({
          git: { headSha: Git.Sha.make('abc1234') },
        })

        const plan = yield* planEphemeral(workspacePackages, { prNumber: 42 }).pipe(
          Effect.provide(harness.planLayer),
        )

        const result = yield* execute(plan, { dryRun: false, tag: 'preview-42' }).pipe(
          Effect.provide(harness.workflowLayer),
        )

        expect(result.createdGHReleases).toHaveLength(1)

        const pushedTags = yield* Ref.get(harness.gitState.pushedTags)
        const createdReleases = yield* Ref.get(harness.githubState.createdReleases)

        yield* expectFirstPublishTag(harness, 'preview-42')
        expect(pushedTags[0]).toMatchObject({ force: false })
        expect(createdReleases[0]?.title).toContain(' v0.0.0-pr.42.1.')
        expect(createdReleases[0]?.prerelease).toBe(true)
      }),
  )

  Test.live('publishes ephemeral releases to the default PR dist-tag', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({
        git: { headSha: Git.Sha.make('abc1234') },
      })

      const plan = yield* planEphemeral(workspacePackages, { prNumber: 42 }).pipe(
        Effect.provide(harness.planLayer),
      )

      yield* execute(plan, { dryRun: false }).pipe(Effect.provide(harness.workflowLayer))

      yield* expectFirstPublishTag(harness, 'pr-42')
    }),
  )

  Test.live('observable workflow exposes graph in dry-run mode', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

      const dbPath = `/tmp/kitz-release-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
      const observable = yield* executeObservable(plan, {
        dryRun: true,
        dbPath,
      }).pipe(Effect.provide(harness.planLayer))

      const allActivities = observable.graph.layers.flatMap((layer) => [...layer])
      expect(allActivities).toContain('Prepare:@kitz/core')
      expect(allActivities).toContain('Publish:@kitz/core')
      expect(allActivities).toContain('VerifyPublish:@kitz/core')
      expect(allActivities).toContain(`CreateTag:${tagCore('1.1.0')}`)
      expect(allActivities).toContain(`PushTag:${tagCore('1.1.0')}`)
      expect(allActivities).toContain(`CreateGHRelease:${tagCore('1.1.0')}`)
    }),
  )

  Test.live('observable workflow builds the release payload only once', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const manifestReads = yield* Ref.make(0)

      const observable = yield* Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem
        return yield* executeObservable(plan, {
          dryRun: true,
          dbPath: `/tmp/kitz-release-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
        }).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fileSystem,
            readFileString: (path, options) =>
              Effect.gen(function* () {
                if (path.endsWith('/package.json')) {
                  yield* Ref.update(manifestReads, (count) => count + 1)
                }
                return yield* fileSystem.readFileString(path, options)
              }),
          }),
        )
      }).pipe(Effect.provide(harness.planLayer))

      expect(observable.graph.layers.flatMap((layer) => [...layer])).toContain('Prepare:@kitz/core')
      expect(yield* Ref.get(manifestReads)).toBe(1)
    }),
  )

  Test.live('observable execution uses caller-provided runtime services', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

      const observable = yield* executeObservable(plan, {
        dryRun: false,
        dbPath: `/tmp/kitz-release-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
      }).pipe(Effect.provide(harness.planLayer))

      const result = yield* observable.execute.pipe(Effect.provide(harness.workflowLayer))

      expect(result.releasedPackages).toEqual(['@kitz/core'])
      expect(result.createdTags).toEqual([tagCore('1.1.0')])
      expect(result.createdGHReleases).toEqual([tagCore('1.1.0')])
    }),
  )

  // ── Merged from workflow.integration.test.ts (same SUT) ─────────────

  Test.live('publishes rehearsed tarballs without re-packing during apply execution', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const rehearsedPath = `/repo/.release/artifacts/${digestForPlan(plan).value}/kitz-core-1.1.0.tgz`
      yield* Fs.writeString(
        Fs.Path.AbsFile.fromString(rehearsedPath),
        'rehearsed tarball bytes',
      ).pipe(Effect.provide(harness.workflowLayer))

      const result = yield* execute(plan, {
        dryRun: false,
        rehearsedArtifacts: true,
      }).pipe(Effect.provide(harness.workflowLayer))

      expect(result.releasedPackages).toEqual(['@kitz/core'])

      const packCalls = yield* harness.packCalls
      expect(packCalls).toHaveLength(0)

      const publishCalls = yield* harness.publishCalls
      expect(publishCalls).toHaveLength(1)
      expect(Fs.Path.toString(publishCalls[0]!.tarball)).toBe(rehearsedPath)
      expect(publishCalls[0]!.ignoreScripts).toBe(true)
    }),
  )

  Test.live('test harness models npm view misses and rejects unsupported commands', () =>
    Effect.gen(function* () {
      const missing = yield* NpmRegistry.Cli.hasVersion('@kitz/core', '1.0.0')
      const present = yield* NpmRegistry.Cli.hasVersion('@kitz/core', '9.9.9')

      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const unknownCommand = yield* Effect.exit(
        spawner.spawn(ChildProcess.make('node', ['--version'])),
      )
      const pipedCommand = yield* Effect.exit(
        spawner.spawn(
          ChildProcess.make('npm', ['whoami']).pipe(
            ChildProcess.pipeTo(ChildProcess.make('cat', [])),
          ),
        ),
      )

      expect(missing).toBe(false)
      expect(present).toBe(true)
      expect(Exit.isFailure(unknownCommand)).toBe(true)
      expect(Exit.isFailure(pipedCommand)).toBe(true)
    }).pipe(Effect.scoped, Effect.provide(makeMockSpawnerLayer('mock-user'))),
  )

  Test.live('test harness npm pack rejects malformed package fixtures', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        git: { tags: [], commits: [], isClean: true },
        diskLayout: {
          '/repo/packages/core/package.json': JSON.stringify({ name: '@kitz/core' }),
        },
      })

      const exit = yield* Effect.gen(function* () {
        const npm = yield* NpmRegistry.NpmCli
        return yield* Effect.exit(
          npm.pack({
            cwd: corePackagePath,
            packDestination: Fs.Path.AbsDir.fromString('/repo/.release/artifacts/'),
          }),
        )
      }).pipe(Effect.provide(harness.workflowLayer))

      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )

  Test.live('dry-run execution reaches every side-effect layer without mutating services', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const result = yield* execute(plan, { dryRun: true }).pipe(
        Effect.provide(harness.workflowLayer),
      )

      expect(result.releasedPackages).toEqual(['@kitz/core'])
      expect(result.createdTags).toEqual([tagCore('1.1.0')])
      expect(result.createdGHReleases).toEqual([tagCore('1.1.0')])

      expect(yield* harness.packCalls).toHaveLength(0)
      expect(yield* harness.publishCalls).toHaveLength(0)
      expect(yield* Ref.get(harness.gitState.createdTags)).toHaveLength(0)
      expect(yield* Ref.get(harness.githubState.createdReleases)).toHaveLength(0)
    }),
  )

  Test.live('fails before publish when a rehearsed artifact is missing', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const outcome = yield* execute(plan, {
        dryRun: false,
        rehearsedArtifacts: true,
      }).pipe(Effect.provide(harness.workflowLayer), Effect.result)

      const failure = expectFailure(outcome, 'ExecutorPublishError') as {
        readonly context: { readonly detail: string }
      }
      expect(failure.context.detail).toContain('Rehearsed artifact is missing')

      expect(yield* harness.publishCalls).toHaveLength(0)
    }),
  )

  Test.live('fails before publish when a rehearsed artifact is empty', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const rehearsedPath = `/repo/.release/artifacts/${digestForPlan(plan).value}/kitz-core-1.1.0.tgz`
      yield* Fs.writeString(Fs.Path.AbsFile.fromString(rehearsedPath), '').pipe(
        Effect.provide(harness.workflowLayer),
      )

      const outcome = yield* execute(plan, {
        dryRun: false,
        rehearsedArtifacts: true,
      }).pipe(Effect.provide(harness.workflowLayer), Effect.result)

      const failure = expectFailure(outcome, 'ExecutorPublishError') as {
        readonly context: { readonly detail: string }
      }
      expect(failure.context.detail).toContain('Rehearsed artifact is empty')

      expect(yield* harness.publishCalls).toHaveLength(0)
    }),
  )

  Test.live('pushes official multi-package tags atomically when the plan requires it', () =>
    Effect.gen(function* () {
      const packages = [
        ...workspacePackages,
        {
          name: Pkg.Moniker.parse('@kitz/cli'),
          scope: 'cli',
          path: cliPackagePath,
        },
      ]
      const harness = yield* makeHarness({
        git: {
          tags: [tagCore('1.0.0'), tag(Pkg.Moniker.parse('@kitz/cli'), '1.0.0')],
          commits: [
            Git.Memory.commit('feat(core): new API'),
            Git.Memory.commit('feat(cli): new CLI'),
          ],
          isClean: true,
        },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0'),
        },
      })

      const plan = yield* planOfficial(packages).pipe(Effect.provide(harness.planLayer))

      yield* execute(plan, { dryRun: false, atomicTagPush: true }).pipe(
        Effect.provide(harness.workflowLayer),
      )

      const pushedTags = yield* Ref.get(harness.gitState.pushedTags)
      expect(pushedTags).toEqual([
        {
          tags: ['@kitz/cli@1.1.0', '@kitz/core@1.1.0'],
          remote: 'origin',
          force: false,
          atomic: true,
        },
      ])
    }),
  )

  Test.live('maps atomic tag push failures to ExecutorTagError before GitHub releases', () =>
    Effect.gen(function* () {
      const packages = [
        ...workspacePackages,
        {
          name: Pkg.Moniker.parse('@kitz/cli'),
          scope: 'cli',
          path: cliPackagePath,
        },
      ]
      const harness = yield* makeHarness({
        git: {
          tags: [tagCore('1.0.0'), tag(Pkg.Moniker.parse('@kitz/cli'), '1.0.0')],
          commits: [
            Git.Memory.commit('feat(core): new API'),
            Git.Memory.commit('feat(cli): new CLI'),
          ],
          isClean: true,
        },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0'),
        },
        failAtomicPush: true,
      })

      const plan = yield* planOfficial(packages).pipe(Effect.provide(harness.planLayer))
      const outcome = yield* execute(plan, {
        dryRun: false,
        atomicTagPush: true,
      }).pipe(Effect.provide(harness.workflowLayer), Effect.result)

      const failure = expectFailure(outcome, 'ExecutorTagError') as {
        readonly context: { readonly tag: string; readonly detail: string }
      }
      expect(failure.context.tag).toBe('atomic-tag-push')
      expect(failure.context.detail).toContain('mock atomic push failure')

      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      expect(createdReleases).toHaveLength(0)
    }),
  )

  Test.live('stops before tags when post-publish registry verification fails', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({
        missingRegistryVersions: ['@kitz/core@1.1.0'],
      })

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const outcome = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.result,
      )

      const failure = expectFailure(outcome, 'ExecutorPublishError') as {
        readonly context: { readonly detail: string }
      }
      expect(failure.context.detail).toContain('registry does not show @kitz/core@1.1.0')

      const createdTags = yield* Ref.get(harness.gitState.createdTags)
      expect(createdTags).toHaveLength(0)
    }),
  )

  Test.live('stops before tags when registry observation contradicts the publish intent', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({ observedDistTags: { latest: '0.0.1' } })

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const outcome = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.result,
      )

      const failure = expectFailure(outcome, 'ExecutorPublishError') as {
        readonly context: { readonly detail: string }
      }
      expect(failure.context.detail).toContain('latest does not point at @kitz/core@1.1.0')

      const createdTags = yield* Ref.get(harness.gitState.createdTags)
      expect(createdTags).toHaveLength(0)
    }),
  )

  Test.live('creates PR releases as GitHub prereleases without --tag next', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({
        git: { headSha: Git.Sha.make('abc1234') },
      })

      const plan = yield* planEphemeral(workspacePackages, { prNumber: 42 }).pipe(
        Effect.provide(harness.planLayer),
      )

      const result = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
      )

      expect(result.createdGHReleases).toHaveLength(1)

      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      expect(createdReleases).toHaveLength(1)
      expect(createdReleases[0]!.tag).toContain('-pr.42.1.')
      expect(createdReleases[0]!.prerelease).toBe(true)
    }),
  )

  Test.live('legacy payloads without lifecycle create versioned GitHub releases', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness()

      yield* ReleaseWorkflow.execute({
        releases: [
          {
            packageName: '@kitz/core',
            packagePath: '/repo/packages/core/',
            currentVersion: Option.some('1.0.0'),
            nextVersion: '1.1.0',
            bump: 'minor',
            commits: [
              {
                type: 'feat',
                message: 'new API',
                hash: Git.Sha.make('abc1234'),
                breaking: false,
              },
            ],
            dependsOn: [],
          },
        ],
        options: {
          dryRun: false,
          rehearsedArtifacts: false,
          atomicTagPush: false,
          packDriver: 'npm',
          publishInvoker: 'npm',
        },
      }).pipe(Effect.provide(harness.workflowLayer))

      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      expect(createdReleases).toHaveLength(1)
      expect(createdReleases[0]!.title).toBe('@kitz/core v1.1.0')
      expect(createdReleases[0]!.prerelease).toBeUndefined()
    }),
  )

  Test.live('test harness registry probes model missing and unrecorded versions distinctly', () =>
    Effect.gen(function* () {
      const harness = yield* makeCoreHarness({
        missingRegistryVersions: ['@kitz/core@1.1.0'],
      })

      yield* Effect.gen(function* () {
        const cli = yield* NpmRegistry.NpmCli

        expect(yield* cli.hasVersion('@kitz/core', '1.1.0')).toBe(false)
        expect(yield* cli.hasVersion('@kitz/core', '1.2.0')).toBe(false)

        const missing = yield* cli.observeVersion('@kitz/core', '1.1.0').pipe(Effect.result)
        expect(missing._tag).toBe('Failure')
        if (missing._tag === 'Failure') {
          expect(missing.failure.message).toContain('registry does not show @kitz/core@1.1.0')
        }

        const unrecorded = yield* cli.observeVersion('@kitz/core', '1.2.0').pipe(Effect.result)
        expect(unrecorded._tag).toBe('Failure')
        if (unrecorded._tag === 'Failure') {
          expect(unrecorded.failure.message).toContain(
            'registry has no publish receipt for @kitz/core@1.2.0',
          )
        }
      }).pipe(Effect.provide(harness.workflowLayer))
    }),
  )
})
