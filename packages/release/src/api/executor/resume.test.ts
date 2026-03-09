import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { describe, expect, it as test } from '@effect/vitest'
import { Effect, Layer, LogLevel, Logger, Ref } from 'effect'
import { execute, toPayload } from './execute.js'
import { ReleaseWorkflow } from './workflow.js'
import {
  decodeJsonRecordSync,
  makeHarness,
  makePackageJson,
  planOfficial,
  tag,
} from './test-support.js'

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const coreManifestPath = Fs.Path.AbsFile.fromString('/repo/packages/core/package.json')
const cliPackagePath = Fs.Path.AbsDir.fromString('/repo/packages/cli/')
const cliManifestPath = Fs.Path.AbsFile.fromString('/repo/packages/cli/package.json')

const workspacePackages: Parameters<typeof planOfficial>[0] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: corePackagePath,
  },
  {
    name: Pkg.Moniker.parse('@kitz/cli'),
    scope: 'cli',
    path: cliPackagePath,
  },
]

const tagCore = (version: string) => tag(Pkg.Moniker.parse('@kitz/core'), version)
const tagCli = (version: string) => tag(Pkg.Moniker.parse('@kitz/cli'), version)
const quiet = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Logger.withMinimumLogLevel(LogLevel.None))

describe('Executor workflow state', () => {
  test.scopedLive(
    'persists deterministic workflow identity after a partial multi-package publish failure',
    () =>
      quiet(
        Effect.gen(function* () {
          const harness = yield* makeHarness({
            git: {
              tags: [tagCore('1.0.0'), tagCli('1.0.0')],
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
              }),
              '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0', {
                dependencies: {
                  '@kitz/core': 'workspace:^',
                },
                imports: {
                  '#cli': './src/_.ts',
                },
                exports: {
                  '.': './src/_.ts',
                },
              }),
            },
            failPublishPackages: ['@kitz/cli'],
          })
          const workflowContext = yield* Layer.build(harness.workflowLayer)

          const plan = yield* planOfficial(workspacePackages).pipe(
            Effect.provide(harness.planLayer),
          )
          const payload = yield* toPayload(plan).pipe(Effect.provide(workflowContext))

          expect(plan.releases.map((item) => item.package.name.moniker)).toEqual(['@kitz/core'])
          expect(plan.cascades.map((item) => item.package.name.moniker)).toEqual(['@kitz/cli'])

          const executionIdBefore = yield* ReleaseWorkflow.executionId(payload).pipe(
            Effect.provide(workflowContext),
          )

          const firstRun = yield* execute(plan, { dryRun: false }).pipe(
            Effect.provide(workflowContext),
            Effect.either,
          )

          expect(firstRun._tag).toBe('Left')
          if (firstRun._tag === 'Left') {
            expect(firstRun.left._tag).toBe('ExecutorPublishError')
            if (firstRun.left._tag === 'ExecutorPublishError') {
              expect(firstRun.left.context.packageName).toBe('@kitz/cli')
              expect(firstRun.left.context.detail).toContain('mock publish failure')
            }
          }

          const firstPackCalls = yield* Ref.get(harness.packCalls)
          expect(firstPackCalls).toHaveLength(2)

          const packByPackage = Object.fromEntries(
            firstPackCalls.map((call) => [String(call.manifestSnapshot['name']), call]),
          )

          expect(packByPackage['@kitz/core']!.manifestSnapshot['version']).toBe('1.1.0')
          expect(packByPackage['@kitz/cli']!.manifestSnapshot['version']).toBe('1.0.1')
          expect(packByPackage['@kitz/cli']!.manifestSnapshot['dependencies']).toEqual({
            '@kitz/core': '^1.1.0',
          })
          expect(packByPackage['@kitz/cli']!.manifestSnapshot['imports']).toEqual({
            '#cli': './build/_.js',
          })
          expect(packByPackage['@kitz/cli']!.manifestSnapshot['exports']).toEqual({
            '.': './build/_.js',
          })

          const firstPublishCalls = yield* Ref.get(harness.publishCalls)
          expect(firstPublishCalls.map((call) => Fs.Path.toString(call.tarball))).toEqual([
            '/repo/.release/artifacts/kitz-core-1.1.0.tgz',
            '/repo/.release/artifacts/kitz-cli-1.0.1.tgz',
          ])

          const firstCreatedTags = yield* Ref.get(harness.gitState.createdTags)
          expect(firstCreatedTags.map((entry) => entry.tag)).toEqual([])

          const executionIdAfter = yield* ReleaseWorkflow.executionId(payload).pipe(
            Effect.provide(workflowContext),
          )
          expect(executionIdAfter).toBe(executionIdBefore)
          expect(yield* ReleaseWorkflow.exists(payload).pipe(Effect.provide(workflowContext))).toBe(
            true,
          )

          const publishAttempts = yield* Ref.get(harness.publishAttempts)
          expect(publishAttempts).toBe(2)

          const coreManifest = decodeJsonRecordSync(
            yield* Fs.readString(coreManifestPath).pipe(Effect.provide(workflowContext)),
          )
          const cliManifest = decodeJsonRecordSync(
            yield* Fs.readString(cliManifestPath).pipe(Effect.provide(workflowContext)),
          )
          expect(coreManifest['version']).toBe('1.0.0')
          expect(cliManifest['version']).toBe('1.0.0')
          expect(cliManifest['dependencies']).toEqual({
            '@kitz/core': 'workspace:^',
          })

          yield* Ref.set(harness.failPublishPackages, [])

          const secondRun = yield* execute(plan, { dryRun: false }).pipe(
            Effect.provide(workflowContext),
            Effect.either,
          )

          expect(secondRun._tag).toBe('Right')
          if (secondRun._tag === 'Right') {
            expect(secondRun.right).toEqual({
              releasedPackages: ['@kitz/core', '@kitz/cli'],
              createdTags: [tagCore('1.1.0'), tagCli('1.0.1')],
              createdGHReleases: [tagCore('1.1.0'), tagCli('1.0.1')],
            })
          }

          const finalPublishCalls = yield* Ref.get(harness.publishCalls)
          expect(finalPublishCalls.map((call) => Fs.Path.toString(call.tarball))).toEqual([
            '/repo/.release/artifacts/kitz-core-1.1.0.tgz',
            '/repo/.release/artifacts/kitz-cli-1.0.1.tgz',
            '/repo/.release/artifacts/kitz-cli-1.0.1.tgz',
          ])

          const finalCreatedTags = yield* Ref.get(harness.gitState.createdTags)
          expect(finalCreatedTags.map((entry) => entry.tag)).toEqual([
            tagCore('1.1.0'),
            tagCli('1.0.1'),
          ])
        }),
      ),
  )
})
