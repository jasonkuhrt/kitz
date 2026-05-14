import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Test } from '@kitz/test'
import { Effect, Ref } from 'effect'
import {
  execute as executeWorkflow,
  executeObservable as executeWorkflowObservable,
} from './executor/execute.js'
import { digestForPlan } from './proof.js'
import {
  decodeJsonRecordSync,
  decodeSemverFromManifest,
  makeHarness,
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

describe('Workflow integration', () => {
  Test.live(
    'runs non-dry-run official workflow with mocked services and restores manifest semver',
    () =>
      quiet(
        Effect.gen(function* () {
          const harness = yield* makeHarness({
            git: {
              tags: [tagCore('1.0.0')],
              commits: [Git.Memory.commit('feat(core): new API')],
              isClean: true,
            },
            diskLayout: {
              '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
            },
          })

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
          const manifest = decodeJsonRecordSync(manifestRaw)
          expect(
            Semver.equivalence(
              decodeSemverFromManifest(manifest[`version`]),
              Semver.fromString('1.0.0'),
            ),
          ).toBe(true)
        }),
      ),
  )

  Test.live('publishes rehearsed tarballs without re-packing during apply execution', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tagCore('1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: true,
          },
          diskLayout: {
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          },
        })

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

  Test.live('stops before tags when post-publish registry verification fails', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tagCore('1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: true,
          },
          diskLayout: {
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          },
          missingRegistryVersions: ['@kitz/core@1.1.0'],
        })

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
        const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )

        expect(outcome._tag).toBe('Failure')
        if (outcome._tag === 'Failure') {
          expect(outcome.failure._tag).toBe('ExecutorPublishError')
          if (outcome.failure._tag === 'ExecutorPublishError') {
            expect(outcome.failure.context.detail).toContain('Registry does not show')
          }
        }

        const createdTags = yield* Ref.get(harness.gitState.createdTags)
        expect(createdTags).toHaveLength(0)
      }),
    ),
  )

  Test.live('fails preflight on conflicting tag and does not publish', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tagCore('1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: true,
          },
          diskLayout: {
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          },
        })

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

        expect(outcome._tag).toBe('Failure')
        if (outcome._tag === 'Failure') {
          expect(outcome.failure._tag).toBe('ExecutorPreflightError')
          if (outcome.failure._tag === 'ExecutorPreflightError') {
            expect(outcome.failure.context.check).toBe('plan.tags-unique')
          }
        }

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
          const harness = yield* makeHarness({
            git: {
              tags: [tagCore('1.0.0')],
              commits: [Git.Memory.commit('feat(core): new API')],
              isClean: true,
            },
            diskLayout: {
              '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
            },
            failPublishPackages: ['@kitz/core'],
          })

          const plan = yield* planOfficial(workspacePackages).pipe(
            Effect.provide(harness.planLayer),
          )

          const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
            Effect.provide(harness.workflowLayer),
            Effect.result,
          )

          expect(outcome._tag).toBe('Failure')
          if (outcome._tag === 'Failure') {
            expect(outcome.failure._tag).toBe('ExecutorPublishError')
            if (outcome.failure._tag === 'ExecutorPublishError') {
              expect(outcome.failure.context.packageName).toBe('@kitz/core')
              expect(outcome.failure.context.detail).toContain('mock publish failure')
            }
          }

          const publishAttempts = yield* Ref.get(harness.publishAttempts)
          expect(publishAttempts).toBe(1)

          const createdTags = yield* Ref.get(harness.gitState.createdTags)
          expect(createdTags).toHaveLength(0)

          const manifestRaw = yield* Fs.readString(coreManifestPath).pipe(
            Effect.provide(harness.workflowLayer),
          )
          const manifest = decodeJsonRecordSync(manifestRaw)
          expect(
            Semver.equivalence(
              decodeSemverFromManifest(manifest[`version`]),
              Semver.fromString('1.0.0'),
            ),
          ).toBe(true)
        }),
      ),
  )

  Test.live('surfaces cleanup guidance when pack hooks exist and artifact preparation fails', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tagCore('1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: true,
          },
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

        expect(outcome._tag).toBe('Failure')
        if (outcome._tag === 'Failure') {
          expect(outcome.failure._tag).toBe('ExecutorPublishError')
          if (outcome.failure._tag === 'ExecutorPublishError') {
            expect(outcome.failure.context.detail).toContain('mock pack failure')
            expect(outcome.failure.context.detail).toContain(
              'Source package manifests were not mutated',
            )
            expect(outcome.failure.context.detail).toContain('Pack hooks detected (prepack)')
            expect(outcome.failure.context.detail).toContain(
              'plan.packages-runtime-targets-source-oriented',
            )
          }
        }

        const manifestRaw = yield* Fs.readString(coreManifestPath).pipe(
          Effect.provide(harness.workflowLayer),
        )
        const manifest = decodeJsonRecordSync(manifestRaw)
        expect(
          Semver.equivalence(
            decodeSemverFromManifest(manifest[`version`]),
            Semver.fromString('1.0.0'),
          ),
        ).toBe(true)
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
        const harness = yield* makeHarness({
          git: {
            tags: [tagCore('1.0.0'), tagCore('1.1.0-next.1')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: true,
          },
          diskLayout: {
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          },
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
        const harness = yield* makeHarness({
          git: {
            tags: [tagCore('1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: true,
            headSha: Git.Sha.make('abc1234'),
          },
          diskLayout: {
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          },
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

  Test.live('observable workflow exposes graph in dry-run mode', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tagCore('1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
          },
          diskLayout: {
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          },
        })

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
