import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Test } from '@kitz/test'
import { Effect, Exit, Option, Ref } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import {
  execute as executeWorkflow,
  executeObservable as executeWorkflowObservable,
} from './executor/execute.js'
import { ReleaseWorkflow } from './executor/workflow.js'
import { digestForPlan } from './proof.js'
import {
  decodeJsonRecordSync,
  decodeSemverFromManifest,
  makeHarness,
  makeMockSpawnerLayer,
  makePackageJson,
  planCandidate,
  planEphemeral,
  planOfficial,
  tag,
} from './executor/test-support.js'

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const cliPackagePath = Fs.Path.AbsDir.fromString('/repo/packages/cli/')
const coreManifestPath = Fs.Path.AbsFile.fromString('/repo/packages/core/package.json')
const workspacePackages: Parameters<typeof planOfficial>[0] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: corePackagePath,
  },
]

const tagCore = (version: string) => tag(Pkg.Moniker.parse('@kitz/core'), version)
const quiet = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect
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

const expectRestoredCoreManifest = (manifestRaw: string) => {
  const manifest = decodeJsonRecordSync(manifestRaw)
  expect(
    Semver.equivalence(decodeSemverFromManifest(manifest[`version`]), Semver.fromString('1.0.0')),
  ).toBe(true)
  return manifest
}

describe('Workflow integration', () => {
  Test.live(
    'runs non-dry-run official workflow with mocked services and restores manifest semver',
    () =>
      quiet(
        Effect.gen(function* () {
          const harness = yield* makeCoreHarness()

          const plan = yield* planOfficial(workspacePackages).pipe(
            Effect.provide(harness.planLayer),
          )

          expect(plan.releases).toHaveLength(1)

          const result = yield* executeWorkflow(plan, { dryRun: false }).pipe(
            Effect.provide(harness.workflowLayer),
          )

          expect(result.releasedPackages).toEqual(['@kitz/core'])
          expect(result.createdTags).toEqual([tagCore('1.1.0')])
          expect(result.createdGHReleases).toEqual([tagCore('1.1.0')])

          const createdTags = yield* Ref.get(harness.gitState.createdTags)
          expect(createdTags.map((entry) => entry.tag)).toContain(tagCore('1.1.0'))

          const pushedTags = yield* Ref.get(harness.gitState.pushedTags)
          expect(pushedTags).toHaveLength(1)

          const packCalls = yield* Ref.get(harness.packCalls)
          expect(packCalls).toHaveLength(1)
          expect(packCalls[0]!.manifestSnapshot['version']).toBe('1.1.0')

          const publishCalls = yield* Ref.get(harness.publishCalls)
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
      ),
  )

  Test.live('publishes rehearsed tarballs without re-packing during apply execution', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const rehearsedPath = `/repo/.release/artifacts/${digestForPlan(plan).value}/kitz-core-1.1.0.tgz`
        yield* Fs.writeString(
          Fs.Path.AbsFile.fromString(rehearsedPath),
          'rehearsed tarball bytes',
        ).pipe(Effect.provide(harness.workflowLayer))

        const result = yield* executeWorkflow(plan, {
          dryRun: false,
          rehearsedArtifacts: true,
        }).pipe(Effect.provide(harness.workflowLayer))

        expect(result.releasedPackages).toEqual(['@kitz/core'])

        const packCalls = yield* Ref.get(harness.packCalls)
        expect(packCalls).toHaveLength(0)

        const publishCalls = yield* Ref.get(harness.publishCalls)
        expect(publishCalls).toHaveLength(1)
        expect(Fs.Path.toString(publishCalls[0]!.tarball)).toBe(rehearsedPath)
        expect(publishCalls[0]!.ignoreScripts).toBe(true)
      }),
    ),
  )

  Test.live('test harness models npm view misses and rejects unsupported commands', () =>
    quiet(
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
    ),
  )

  Test.live('test harness npm pack rejects malformed package fixtures', () =>
    quiet(
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
    ),
  )

  Test.live('dry-run execution reaches every side-effect layer without mutating services', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const result = yield* executeWorkflow(plan, { dryRun: true }).pipe(
          Effect.provide(harness.workflowLayer),
        )

        expect(result.releasedPackages).toEqual(['@kitz/core'])
        expect(result.createdTags).toEqual([tagCore('1.1.0')])
        expect(result.createdGHReleases).toEqual([tagCore('1.1.0')])

        expect(yield* Ref.get(harness.packCalls)).toHaveLength(0)
        expect(yield* Ref.get(harness.publishCalls)).toHaveLength(0)
        expect(yield* Ref.get(harness.gitState.createdTags)).toHaveLength(0)
        expect(yield* Ref.get(harness.githubState.createdReleases)).toHaveLength(0)
      }),
    ),
  )

  Test.live('fails before publish when a rehearsed artifact is missing', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const outcome = yield* executeWorkflow(plan, {
          dryRun: false,
          rehearsedArtifacts: true,
        }).pipe(Effect.provide(harness.workflowLayer), Effect.result)

        const failure = expectFailure(outcome, 'ExecutorPublishError') as {
          readonly context: { readonly detail: string }
        }
        expect(failure.context.detail).toContain('Rehearsed artifact is missing')

        expect(yield* Ref.get(harness.publishCalls)).toHaveLength(0)
      }),
    ),
  )

  Test.live('fails before publish when a rehearsed artifact is empty', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const rehearsedPath = `/repo/.release/artifacts/${digestForPlan(plan).value}/kitz-core-1.1.0.tgz`
        yield* Fs.writeString(Fs.Path.AbsFile.fromString(rehearsedPath), '').pipe(
          Effect.provide(harness.workflowLayer),
        )

        const outcome = yield* executeWorkflow(plan, {
          dryRun: false,
          rehearsedArtifacts: true,
        }).pipe(Effect.provide(harness.workflowLayer), Effect.result)

        const failure = expectFailure(outcome, 'ExecutorPublishError') as {
          readonly context: { readonly detail: string }
        }
        expect(failure.context.detail).toContain('Rehearsed artifact is empty')

        expect(yield* Ref.get(harness.publishCalls)).toHaveLength(0)
      }),
    ),
  )

  Test.live('pushes official multi-package tags atomically when the plan requires it', () =>
    quiet(
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

        yield* executeWorkflow(plan, { dryRun: false, atomicTagPush: true }).pipe(
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
    ),
  )

  Test.live('maps atomic tag push failures to ExecutorTagError before GitHub releases', () =>
    quiet(
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
        const outcome = yield* executeWorkflow(plan, {
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
    ),
  )

  Test.live('stops before tags when post-publish registry verification fails', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({
          missingRegistryVersions: ['@kitz/core@1.1.0'],
        })

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )

        const failure = expectFailure(outcome, 'ExecutorPublishError') as {
          readonly context: { readonly detail: string }
        }
        expect(failure.context.detail).toContain('Registry does not show')

        const createdTags = yield* Ref.get(harness.gitState.createdTags)
        expect(createdTags).toHaveLength(0)
      }),
    ),
  )

  Test.live('stops before tags when registry observation contradicts the publish intent', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({ observedDistTags: { latest: '0.0.1' } })

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
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
    ),
  )

  Test.live('fails preflight on conflicting tag and does not publish', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const plannedRelease = plan.releases[0]
        expect(plannedRelease).toBeDefined()
        const conflictingTag = tag(
          plannedRelease!.package.name,
          Semver.toString(plannedRelease!.nextVersion),
        )
        yield* Ref.update(harness.gitState.tags, (tags) => [...tags, conflictingTag])

        const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )

        const failure = expectFailure(outcome, 'ExecutorPreflightError') as {
          readonly context: { readonly check: string }
        }
        expect(failure.context.check).toBe('plan.tags-unique')

        const publishAttempts = yield* Ref.get(harness.publishAttempts)
        expect(publishAttempts).toBe(0)

        const createdTags = yield* Ref.get(harness.gitState.createdTags)
        expect(createdTags).toHaveLength(0)
      }),
    ),
  )

  Test.live(
    'maps publish failures to WorkflowPublishError and restores manifest after retries',
    () =>
      quiet(
        Effect.gen(function* () {
          const harness = yield* makeCoreHarness({
            failPublishPackages: ['@kitz/core'],
          })

          const plan = yield* planOfficial(workspacePackages).pipe(
            Effect.provide(harness.planLayer),
          )

          const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
            Effect.provide(harness.workflowLayer),
            Effect.result,
          )

          const failure = expectFailure(outcome, 'ExecutorPublishError') as {
            readonly context: { readonly packageName: string; readonly detail: string }
          }
          expect(failure.context.packageName).toBe('@kitz/core')
          expect(failure.context.detail).toContain('mock publish failure')

          const publishAttempts = yield* Ref.get(harness.publishAttempts)
          expect(publishAttempts).toBe(1)

          const createdTags = yield* Ref.get(harness.gitState.createdTags)
          expect(createdTags).toHaveLength(0)

          const manifestRaw = yield* Fs.readString(coreManifestPath).pipe(
            Effect.provide(harness.workflowLayer),
          )
          expectRestoredCoreManifest(manifestRaw)
        }),
      ),
  )

  Test.live('surfaces cleanup guidance when pack hooks exist and artifact preparation fails', () =>
    quiet(
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

        const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )

        const failure = expectFailure(outcome, 'ExecutorPublishError') as {
          readonly context: { readonly detail: string }
        }
        expect(failure.context.detail).toContain('mock pack failure')
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
    ),
  )

  Test.live('updates existing GitHub candidate release when tag option is next', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({
          git: { tags: [tagCore('1.0.0'), tagCore('1.1.0-next.1')] },
        })

        const plan = yield* planCandidate(workspacePackages).pipe(Effect.provide(harness.planLayer))

        const plannedRelease = plan.releases[0]
        expect(plannedRelease).toBeDefined()
        const candidateTag = tag(
          plannedRelease!.package.name,
          Semver.toString(plannedRelease!.nextVersion),
        )

        yield* Effect.gen(function* () {
          const gh = yield* Github.Github
          yield* gh.createRelease({
            tag: candidateTag,
            title: '@kitz/core @next',
            body: 'existing',
            prerelease: true,
          })
        }).pipe(Effect.provide(harness.workflowLayer))

        const result = yield* executeWorkflow(plan, { dryRun: false, tag: 'next' }).pipe(
          Effect.provide(harness.workflowLayer),
        )

        expect(result.createdGHReleases).toContain(candidateTag)

        const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
        const updatedReleases = yield* Ref.get(harness.githubState.updatedReleases)

        expect(createdReleases.filter((r) => r.tag === candidateTag)).toHaveLength(1)
        expect(updatedReleases.filter((r) => r.tag === candidateTag)).toHaveLength(1)
      }),
    ),
  )

  Test.live('creates PR releases as GitHub prereleases without --tag next', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({
          git: { headSha: Git.Sha.make('abc1234') },
        })

        const plan = yield* planEphemeral(workspacePackages, { prNumber: 42 }).pipe(
          Effect.provide(harness.planLayer),
        )

        const result = yield* executeWorkflow(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
        )

        expect(result.createdGHReleases).toHaveLength(1)

        const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
        expect(createdReleases).toHaveLength(1)
        expect(createdReleases[0]!.tag).toContain('-pr.42.1.')
        expect(createdReleases[0]!.prerelease).toBe(true)
      }),
    ),
  )

  Test.live('legacy payloads without lifecycle create versioned GitHub releases', () =>
    quiet(
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
    ),
  )

  Test.live('test harness registry probes model missing and unrecorded versions distinctly', () =>
    quiet(
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
            expect(missing.failure.message).toContain('Registry does not show')
          }

          const unrecorded = yield* cli.observeVersion('@kitz/core', '1.2.0').pipe(Effect.result)
          expect(unrecorded._tag).toBe('Failure')
          if (unrecorded._tag === 'Failure') {
            expect(unrecorded.failure.message).toContain('mock registry has no publish receipt')
          }
        }).pipe(Effect.provide(harness.workflowLayer))
      }),
    ),
  )

  Test.live('observable workflow exposes graph in dry-run mode', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness()

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

        const dbPath = `/tmp/kitz-release-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
        const observable = yield* executeWorkflowObservable(plan, {
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
    ),
  )
})
