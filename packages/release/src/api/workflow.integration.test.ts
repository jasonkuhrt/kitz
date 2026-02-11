import { CommandExecutor } from '@effect/platform'
import { describe, expect, it as test } from '@effect/vitest'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer, Ref, Schema, Stream } from 'effect'
import * as PlanApi from './plan/__.js'
import { executeWorkflow, executeWorkflowObservable, makeTestWorkflowRuntime } from './workflow.js'

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const coreManifestPath = Fs.Path.AbsFile.fromString('/repo/packages/core/package.json')

const workspacePackages: ReadonlyArray<PlanApi.Context['packages'][number]> = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: corePackagePath,
  },
]

const makePackageJson = (name: string, version: string) => JSON.stringify({ name, version }, null, 2)

const tag = (name: Pkg.Moniker.Moniker, version: string) =>
  Pkg.Pin.toString(
    Pkg.Pin.Exact.make({ name, version: Schema.decodeUnknownSync(Semver.Schema)(version) }),
  )

const tagCore = (version: string) => tag(Pkg.Moniker.parse('@kitz/core'), version)

const decodeSemverFromManifest = (value: unknown): Semver.Semver =>
  typeof value === 'string'
    ? Schema.decodeUnknownSync(Semver.Schema)(value)
    : Schema.decodeUnknownSync(Semver.Semver)(value)

const makeMockCommandExecutorLayer = (whoamiUsername: string) => {
  const runString = (command: any) => {
    if (command?._tag === 'StandardCommand' && command.command === 'npm' && command.args?.[0] === 'whoami') {
      return Effect.succeed(`${whoamiUsername}\n`)
    }
    return Effect.die(`Unexpected command in mock executor: ${command?.command ?? 'unknown'}`)
  }

  const executor: CommandExecutor.CommandExecutor = {
    [CommandExecutor.TypeId]: CommandExecutor.TypeId,
    exitCode: () => Effect.succeed(CommandExecutor.ExitCode(0)),
    start: () => Effect.die('start not implemented in mock command executor') as any,
    string: runString,
    lines: (command) =>
      runString(command).pipe(
        Effect.map((output) => output.trim().split('\n').filter((line) => line.length > 0)),
      ),
    stream: () => Stream.empty,
    streamLines: () => Stream.empty,
  }

  return Layer.succeed(CommandExecutor.CommandExecutor, executor)
}

interface Harness {
  readonly planLayer: Layer.Layer<any>
  readonly workflowLayer: Layer.Layer<any>
  readonly gitState: Git.Memory.GitMemoryState
  readonly githubState: Github.Memory.GithubMemoryState
  readonly publishCalls: Ref.Ref<Array<{ cwd: Fs.Path.AbsDir; tag?: string; registry?: string }>>
  readonly publishAttempts: Ref.Ref<number>
}

const makeHarness = (options: {
  readonly git: Parameters<typeof Git.Memory.makeWithState>[0]
  readonly diskLayout: Fs.Memory.DiskLayout
  readonly failPublish?: boolean
}): Effect.Effect<Harness> =>
  Effect.gen(function*() {
    const envLayer = Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') })
    const fsLayer = Fs.Memory.layer(options.diskLayout)

    const { layer: gitLayer, state: gitState } = yield* Git.Memory.makeWithState(options.git)
    const { layer: githubLayer, state: githubState } = yield* Github.Memory.makeWithState({})

    const publishCalls = yield* Ref.make<Array<{ cwd: Fs.Path.AbsDir; tag?: string; registry?: string }>>([])
    const publishAttempts = yield* Ref.make(0)

    const npmLayer = Layer.succeed(
      NpmRegistry.NpmCli,
      {
        whoami: () => Effect.succeed('mock-user'),
        publish: (publishOptions) =>
          Effect.gen(function*() {
            yield* Ref.update(publishAttempts, (n) => n + 1)
            yield* Ref.update(publishCalls, (calls) => [
              ...calls,
              {
                cwd: publishOptions.cwd,
                ...(publishOptions.tag && { tag: publishOptions.tag }),
                ...(publishOptions.registry && { registry: publishOptions.registry }),
              },
            ])

            if (options.failPublish) {
              return yield* Effect.fail(
                new NpmRegistry.NpmCliError({
                  context: {
                    operation: 'publish',
                    detail: 'mock publish failure',
                  },
                  cause: new Error('mock publish failure'),
                }),
              )
            }
          }),
      } satisfies NpmRegistry.NpmCliService,
    )

    const commandLayer = makeMockCommandExecutorLayer('mock-user')

    const planLayer = Layer.mergeAll(gitLayer, fsLayer, envLayer)

    const workflowLayer = Layer.mergeAll(
      planLayer,
      makeTestWorkflowRuntime(),
      githubLayer,
      npmLayer,
      commandLayer,
    )

    return {
      planLayer,
      workflowLayer,
      gitState,
      githubState,
      publishCalls,
      publishAttempts,
    }
  })

describe('Workflow integration', () => {
  test.effect('runs non-dry-run stable workflow with mocked services and restores manifest semver', (_ctx) =>
    Effect.gen(function*() {
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

      const plan = yield* PlanApi.stable({ packages: workspacePackages }).pipe(
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

      const publishCalls = yield* Ref.get(harness.publishCalls)
      expect(publishCalls).toHaveLength(1)
      expect(Fs.Path.toString(publishCalls[0]!.cwd)).toBe('/repo/packages/core/')

      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      expect(createdReleases).toHaveLength(1)
      expect(createdReleases[0]!.tag).toBe(tagCore('1.1.0'))
      expect(createdReleases[0]!.title).toBe('@kitz/core v1.1.0')

      const manifestRaw = yield* Fs.readString(coreManifestPath).pipe(
        Effect.provide(harness.workflowLayer),
      )
      const manifest = JSON.parse(manifestRaw)
      expect(
        Semver.equivalence(
          decodeSemverFromManifest(manifest.version),
          Semver.fromString('1.0.0'),
        ),
      ).toBe(true)
    }))

  test.effect('fails preflight on conflicting tag and does not publish', (_ctx) =>
    Effect.gen(function*() {
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

      const plan = yield* PlanApi.stable({ packages: workspacePackages }).pipe(
        Effect.provide(harness.planLayer),
      )
      const plannedRelease = plan.releases[0]
      expect(plannedRelease).toBeDefined()
      const conflictingTag = tag(plannedRelease!.package.name, Semver.toString(plannedRelease!.nextVersion))
      yield* Ref.update(harness.gitState.tags, (tags) => [...tags, conflictingTag])

      const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.either,
      )

      expect(outcome._tag).toBe('Left')
      if (outcome._tag === 'Left') {
        expect(outcome.left._tag).toBe('WorkflowPreflightError')
        if (outcome.left._tag === 'WorkflowPreflightError') {
          expect(outcome.left.context.check).toBe('plan.tags-unique')
        }
      }

      const publishAttempts = yield* Ref.get(harness.publishAttempts)
      expect(publishAttempts).toBe(0)

      const createdTags = yield* Ref.get(harness.gitState.createdTags)
      expect(createdTags).toHaveLength(0)
    }))

  test.effect('maps publish failures to WorkflowPublishError and restores manifest after retries', (_ctx) =>
    Effect.gen(function*() {
      const harness = yield* makeHarness({
        git: {
          tags: [tagCore('1.0.0')],
          commits: [Git.Memory.commit('feat(core): new API')],
          isClean: true,
        },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        },
        failPublish: true,
      })

      const plan = yield* PlanApi.stable({ packages: workspacePackages }).pipe(
        Effect.provide(harness.planLayer),
      )

      const outcome = yield* executeWorkflow(plan, { dryRun: false }).pipe(
        Effect.provide(harness.workflowLayer),
        Effect.either,
      )

      expect(outcome._tag).toBe('Left')
      if (outcome._tag === 'Left') {
        expect(outcome.left._tag).toBe('WorkflowPublishError')
        if (outcome.left._tag === 'WorkflowPublishError') {
          expect(outcome.left.context.packageName).toBe('@kitz/core')
          expect(outcome.left.context.detail).toContain('mock publish failure')
        }
      }

      const publishAttempts = yield* Ref.get(harness.publishAttempts)
      expect(publishAttempts).toBe(3)

      const createdTags = yield* Ref.get(harness.gitState.createdTags)
      expect(createdTags).toHaveLength(0)

      const manifestRaw = yield* Fs.readString(coreManifestPath).pipe(
        Effect.provide(harness.workflowLayer),
      )
      const manifest = JSON.parse(manifestRaw)
      expect(
        Semver.equivalence(
          decodeSemverFromManifest(manifest.version),
          Semver.fromString('1.0.0'),
        ),
      ).toBe(true)
    }))

  test.effect('updates existing GitHub preview release when tag option is next', (_ctx) =>
    Effect.gen(function*() {
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

      const plan = yield* PlanApi.preview({ packages: workspacePackages }).pipe(
        Effect.provide(harness.planLayer),
      )

      const plannedRelease = plan.releases[0]
      expect(plannedRelease).toBeDefined()
      const previewTag = tag(plannedRelease!.package.name, Semver.toString(plannedRelease!.nextVersion))

      yield* Effect.gen(function*() {
        const gh = yield* Github.Github
        yield* gh.createRelease({
          tag: previewTag,
          title: '@kitz/core @next',
          body: 'existing',
          prerelease: true,
        })
      }).pipe(
        Effect.provide(harness.workflowLayer),
      )

      const result = yield* executeWorkflow(plan, { dryRun: false, tag: 'next' }).pipe(
        Effect.provide(harness.workflowLayer),
      )

      expect(result.createdGHReleases).toContain(previewTag)

      const createdReleases = yield* Ref.get(harness.githubState.createdReleases)
      const updatedReleases = yield* Ref.get(harness.githubState.updatedReleases)

      expect(createdReleases.filter((r) => r.tag === previewTag)).toHaveLength(1)
      expect(updatedReleases.filter((r) => r.tag === previewTag)).toHaveLength(1)
    }))

  test.effect('observable workflow exposes graph in dry-run mode', (_ctx) =>
    Effect.gen(function*() {
      const harness = yield* makeHarness({
        git: {
          tags: [tagCore('1.0.0')],
          commits: [Git.Memory.commit('feat(core): new API')],
        },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        },
      })

      const plan = yield* PlanApi.stable({ packages: workspacePackages }).pipe(
        Effect.provide(harness.planLayer),
      )

      const dbPath = `/tmp/kitz-release-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
      const observable = yield* executeWorkflowObservable(plan, {
        dryRun: true,
        dbPath,
      })

      const allActivities = observable.graph.layers.flatMap((layer) => [...layer])
      expect(allActivities).toContain('Publish:@kitz/core')
      expect(allActivities).toContain(`CreateTag:${tagCore('1.1.0')}`)
      expect(allActivities).toContain(`PushTag:${tagCore('1.1.0')}`)
      expect(allActivities).toContain(`CreateGHRelease:${tagCore('1.1.0')}`)
    }))
})
