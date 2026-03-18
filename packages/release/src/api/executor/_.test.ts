import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, it as test } from '@effect/vitest'
import { Effect, FileSystem, Ref } from 'effect'
import { execute, executeObservable, toPayload } from './execute.js'
import {
  decodeJsonRecordSync,
  decodeSemverFromManifest,
  makeHarness,
  makePackageJson,
  planCandidate,
  planEphemeral,
  planOfficial,
  tag,
} from './test-support.js'

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const coreManifestPath = Fs.Path.AbsFile.fromString('/repo/packages/core/package.json')
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
const quiet = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect

describe('Executor integration', () => {
  test.live(
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

          const packCalls = yield* Ref.get(harness.packCalls)
          expect(packCalls).toHaveLength(1)
          expect(packCalls[0]!.manifestSnapshot['version']).toBe('1.1.0')

          const publishCalls = yield* Ref.get(harness.publishCalls)
          expect(publishCalls).toHaveLength(1)
          expect(Fs.Path.toString(publishCalls[0]!.tarball)).toBe(
            '/repo/.release/artifacts/kitz-core-1.1.0.tgz',
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

  test.live('fails preflight on conflicting tag and does not publish', () =>
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

        const outcome = yield* execute(plan, { dryRun: false }).pipe(
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

  test.live('fails preflight when git working tree is dirty', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tagCore('1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: false,
          },
          diskLayout: {
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          },
        })

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

        const outcome = yield* execute(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )

        expect(outcome._tag).toBe('Failure')
        if (outcome._tag === 'Failure') {
          expect(outcome.failure._tag).toBe('ExecutorPreflightError')
          if (outcome.failure._tag === 'ExecutorPreflightError') {
            expect(outcome.failure.context.check).toBe('env.git-clean')
          }
        }

        const publishAttempts = yield* Ref.get(harness.publishAttempts)
        expect(publishAttempts).toBe(0)
      }),
    ),
  )

  test.live('fails preflight when official release is attempted off trunk', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            branch: 'feat/release',
            tags: [tagCore('1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: true,
          },
          diskLayout: {
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
          },
        })

        const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

        const outcome = yield* execute(plan, { dryRun: false, trunk: 'main' }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )

        expect(outcome._tag).toBe('Failure')
        if (outcome._tag === 'Failure') {
          expect(outcome.failure._tag).toBe('ExecutorPreflightError')
          if (outcome.failure._tag === 'ExecutorPreflightError') {
            expect(outcome.failure.context.check).toBe('env.release-branch-allowed')
          }
        }

        const publishAttempts = yield* Ref.get(harness.publishAttempts)
        expect(publishAttempts).toBe(0)
      }),
    ),
  )

  test.live('fails before workflow start when planned packages form a local dependency cycle', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tagA('1.0.0'), tagB('1.0.0'), tagC('1.0.0')],
            commits: [
              Git.Memory.commit('feat(a): add feature'),
              Git.Memory.commit('feat(b): add feature'),
            ],
            isClean: true,
          },
          diskLayout: {
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
          },
        })

        const plan = yield* planOfficial(cycleWorkspacePackages).pipe(
          Effect.provide(harness.planLayer),
        )

        expect(plan.cascades.some((item) => item.package.name.moniker === '@kitz/c')).toBe(true)

        const outcome = yield* execute(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )

        expect(outcome._tag).toBe('Failure')
        if (outcome._tag === 'Failure') {
          expect(outcome.failure._tag).toBe('ExecutorDependencyCycleError')
          if (outcome.failure._tag === 'ExecutorDependencyCycleError') {
            expect(outcome.failure.context.packages).toEqual(['@kitz/a', '@kitz/b'])
            expect(outcome.failure.context.edges).toEqual([
              '@kitz/a -> @kitz/b',
              '@kitz/b -> @kitz/a',
            ])
          }
        }

        const packCalls = yield* Ref.get(harness.packCalls)
        expect(packCalls).toHaveLength(0)

        const publishAttempts = yield* Ref.get(harness.publishAttempts)
        expect(publishAttempts).toBe(0)
      }),
    ),
  )

  test.live('direct payload construction fails for dependency cycles', () =>
    quiet(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tagA('1.0.0'), tagB('1.0.0'), tagC('1.0.0')],
            commits: [
              Git.Memory.commit('feat(a): add feature'),
              Git.Memory.commit('feat(b): add feature'),
            ],
            isClean: true,
          },
          diskLayout: {
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
          },
        })

        const plan = yield* planOfficial(cycleWorkspacePackages).pipe(
          Effect.provide(harness.planLayer),
        )

        const outcome = yield* toPayload(plan).pipe(
          Effect.provide(harness.planLayer),
          Effect.result,
        )

        expect(outcome._tag).toBe('Failure')
        if (outcome._tag === 'Failure') {
          expect(outcome.failure._tag).toBe('ExecutorDependencyCycleError')
          if (outcome.failure._tag === 'ExecutorDependencyCycleError') {
            expect(outcome.failure.context.packages).toEqual(['@kitz/a', '@kitz/b'])
            expect(outcome.failure.context.edges).toEqual([
              '@kitz/a -> @kitz/b',
              '@kitz/b -> @kitz/a',
            ])
          }
        }

        const observableAttempt = yield* executeObservable(plan, {
          dryRun: true,
          dbPath: `/tmp/kitz-release-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
        }).pipe(Effect.provide(harness.planLayer), Effect.result)

        expect(observableAttempt._tag).toBe('Failure')
        if (observableAttempt._tag === 'Failure') {
          expect(observableAttempt.failure._tag).toBe('ExecutorDependencyCycleError')
        }
      }),
    ),
  )

  test.live(
    'maps publish failures to ExecutorPublishError and restores manifest after retries',
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

          const outcome = yield* execute(plan, { dryRun: false }).pipe(
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

  test.live('surfaces pack-hook cleanup guidance when artifact preparation fails', () =>
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

        const outcome = yield* execute(plan, { dryRun: false }).pipe(
          Effect.provide(harness.workflowLayer),
          Effect.result,
        )

        expect(outcome._tag).toBe('Failure')
        if (outcome._tag === 'Failure') {
          expect(outcome.failure._tag).toBe('ExecutorPublishError')
          if (outcome.failure._tag === 'ExecutorPublishError') {
            expect(outcome.failure.context.detail).toContain('mock pack failure')
            expect(outcome.failure.context.detail).toContain('Manifest cleanup restored version')
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

  test.live('updates existing GitHub candidate release when tag option is next', () =>
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

        const result = yield* execute(plan, { dryRun: false, tag: 'next' }).pipe(
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

  test.live(
    'updates existing GitHub candidate release when tag option uses a custom candidate dist-tag',
    () =>
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

          const plan = yield* planCandidate(workspacePackages).pipe(
            Effect.provide(harness.planLayer),
          )

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
      ),
  )

  test.live('creates a new GitHub candidate release with the custom candidate dist-tag title', () =>
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

        const plan = yield* planCandidate(workspacePackages).pipe(Effect.provide(harness.planLayer))

        const plannedRelease = plan.releases[0]
        expect(plannedRelease).toBeDefined()
        const candidateTag = tag(
          plannedRelease!.package.name,
          Semver.toString(plannedRelease!.nextVersion),
        )

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
    ),
  )

  test.live(
    'publishes ephemeral releases with a custom dist-tag while keeping GitHub prerelease semantics versioned',
    () =>
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

          const result = yield* execute(plan, { dryRun: false, tag: 'preview-42' }).pipe(
            Effect.provide(harness.workflowLayer),
          )

          expect(result.createdGHReleases).toHaveLength(1)

          const publishCalls = yield* Ref.get(harness.publishCalls)
          const pushedTags = yield* Ref.get(harness.gitState.pushedTags)
          const createdReleases = yield* Ref.get(harness.githubState.createdReleases)

          expect(publishCalls[0]?.tag).toBe('preview-42')
          expect(pushedTags[0]).toMatchObject({ force: false })
          expect(createdReleases[0]?.title).toContain(' v0.0.0-pr.42.1.')
          expect(createdReleases[0]?.prerelease).toBe(true)
        }),
      ),
  )

  test.live('observable workflow exposes graph in dry-run mode', () =>
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
        const observable = yield* executeObservable(plan, {
          dryRun: true,
          dbPath,
        }).pipe(Effect.provide(harness.planLayer))

        const allActivities = observable.graph.layers.flatMap((layer) => [...layer])
        expect(allActivities).toContain('Prepare:@kitz/core')
        expect(allActivities).toContain('Publish:@kitz/core')
        expect(allActivities).toContain(`CreateTag:${tagCore('1.1.0')}`)
        expect(allActivities).toContain(`PushTag:${tagCore('1.1.0')}`)
        expect(allActivities).toContain(`CreateGHRelease:${tagCore('1.1.0')}`)
      }),
    ),
  )

  test.live('observable workflow builds the release payload only once', () =>
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

        expect(observable.graph.layers.flatMap((layer) => [...layer])).toContain(
          'Prepare:@kitz/core',
        )
        expect(yield* Ref.get(manifestReads)).toBe(1)
      }),
    ),
  )

  test.live('observable execution uses caller-provided runtime services', () =>
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

        const observable = yield* executeObservable(plan, {
          dryRun: false,
          dbPath: `/tmp/kitz-release-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
        }).pipe(Effect.provide(harness.planLayer))

        const result = yield* observable.execute.pipe(Effect.provide(harness.workflowLayer))

        expect(result.releasedPackages).toEqual(['@kitz/core'])
        expect(result.createdTags).toEqual([tagCore('1.1.0')])
        expect(result.createdGHReleases).toEqual([tagCore('1.1.0')])
      }),
    ),
  )
})
