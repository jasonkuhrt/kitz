import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer, Option, Ref, Schema, Stream } from 'effect'
import * as Analyzer from '../analyzer/__.js'
import * as Planner from '../planner/__.js'
import { makeTestRuntime } from './runtime.js'

const JsonRecordSchema = Schema.Record(Schema.String, Schema.Unknown)
const JsonRecordFromStringSchema = Schema.fromJsonString(JsonRecordSchema)
export const decodeJsonRecord = Schema.decodeUnknownEffect(JsonRecordFromStringSchema)
const textEncoder = new TextEncoder()

export const decodeJsonRecordSync = Schema.decodeUnknownSync(JsonRecordFromStringSchema)

export const decodeSemverFromManifest = (value: unknown): Semver.Semver =>
  typeof value === 'string'
    ? Schema.decodeUnknownSync(Semver.Schema)(value)
    : Schema.decodeUnknownSync(Semver.Semver)(value)

export const makePackageJson = (name: string, version: string, extra?: Record<string, unknown>) =>
  JSON.stringify({ name, version, ...extra }, null, 2)

export const tag = (name: Pkg.Moniker.Moniker, version: string) =>
  Pkg.Pin.toString(
    Pkg.Pin.Exact.make({ name, version: Schema.decodeUnknownSync(Semver.Schema)(version) }),
  )

const slugPackageName = (packageName: string): string =>
  packageName.replace(/^@/u, '').replace(/\//gu, '-')

const makeHandle = (stdout: string, exitCode: number): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stderr: Stream.empty,
    stdin: Effect.void as any,
    stdout: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    all: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    getInputFd: () => Effect.void as any,
    getOutputFd: () => Stream.empty,
  })

export const makeMockSpawnerLayer = (whoamiUsername: string) => {
  const spawner = ChildProcessSpawner.make((command) => {
    const standard = ChildProcess.isStandardCommand(command) ? command : undefined
    if (!standard) {
      return Effect.die('Unexpected piped command in mock spawner') as any
    }

    const args = standard.args

    // npm whoami
    if (standard.command === 'npm' && args?.[0] === 'whoami') {
      return Effect.succeed(makeHandle(`${whoamiUsername}\n`, 0))
    }

    // npm view
    if (standard.command === 'npm' && args?.[0] === '--silent' && args?.[1] === 'view') {
      const spec = args?.[2]
      const version =
        typeof spec === 'string'
          ? Schema.decodeUnknownOption(Pkg.Pin.Exact.FromString)(spec).pipe(
              Option.map((pin) => Semver.toString(pin.version)),
              Option.getOrUndefined,
            )
          : undefined
      return Effect.succeed(
        version === '9.9.9'
          ? makeHandle(`"${version}"\n`, 0)
          : makeHandle(
              JSON.stringify(
                {
                  error: {
                    code: 'E404',
                    summary: `No match found for version ${version ?? 'unknown'}`,
                  },
                },
                null,
                2,
              ) + '\n',
              1,
            ),
      )
    }

    return Effect.die(`Unexpected command in mock spawner: ${standard.command}`) as any
  })

  return Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)
}

export interface PackCall {
  readonly cwd: Fs.Path.AbsDir
  readonly packDestination: Fs.Path.AbsDir
  readonly tarball: Fs.Path.AbsFile
  readonly filename: string
  readonly manifestSnapshot: Record<string, unknown>
}

export interface PublishCall {
  readonly tarball: Fs.Path.AbsFile
  readonly tag?: string
  readonly registry?: string
  readonly ignoreScripts?: boolean
}

export interface Harness {
  readonly planLayer: Layer.Layer<any>
  readonly workflowLayer: Layer.Layer<any>
  readonly gitState: Git.Memory.GitMemoryState
  readonly githubState: Github.Memory.GithubMemoryState
  readonly packCalls: Ref.Ref<PackCall[]>
  readonly publishCalls: Ref.Ref<PublishCall[]>
  readonly publishAttempts: Ref.Ref<number>
  readonly failPackPackages: Ref.Ref<readonly string[]>
  readonly failPublishPackages: Ref.Ref<readonly string[]>
}

export const makeHarness = (options: {
  readonly git: Parameters<typeof Git.Memory.makeWithState>[0]
  readonly diskLayout: Fs.Memory.DiskLayout
  readonly failPackPackages?: readonly string[]
  readonly failPublishPackages?: readonly string[]
  readonly runtimeLayer?: Layer.Layer<any>
  readonly whoamiUsername?: string
}): Effect.Effect<Harness> =>
  Effect.gen(function* () {
    const envLayer = Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') })
    const fsLayer = Fs.Memory.layer(options.diskLayout)
    const { layer: gitLayer, state: gitState } = yield* Git.Memory.makeWithState(options.git)
    const planLayer = Layer.mergeAll(envLayer, fsLayer, gitLayer)
    const { layer: githubLayer, state: githubState } = yield* Github.Memory.makeWithState({})
    const packCalls = yield* Ref.make<PackCall[]>([])
    const publishCalls = yield* Ref.make<PublishCall[]>([])
    const publishAttempts = yield* Ref.make(0)
    const failPackPackages = yield* Ref.make<readonly string[]>(options.failPackPackages ?? [])
    const failPublishPackages = yield* Ref.make<readonly string[]>(
      options.failPublishPackages ?? [],
    )

    const npmLayerBase = Layer.effect(
      NpmRegistry.NpmCli,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        return {
          whoami: () => Effect.succeed(options.whoamiUsername ?? 'mock-user'),
          pack: (packOptions) =>
            Effect.gen(function* () {
              const packageJsonPath = Fs.Path.join(
                packOptions.cwd,
                Fs.Path.RelFile.fromString('./package.json'),
              )
              const manifestRaw = yield* fs
                .readFileString(Fs.Path.toString(packageJsonPath))
                .pipe(Effect.orDie)
              const manifestSnapshot = yield* decodeJsonRecord(manifestRaw).pipe(Effect.orDie)
              const packageName = manifestSnapshot['name']
              const version = manifestSnapshot['version']

              if (typeof packageName !== 'string' || typeof version !== 'string') {
                return yield* Effect.die(
                  new Error('Mock npm pack expected package.json with string name and version'),
                )
              }

              const blockedPackages = yield* Ref.get(failPackPackages)
              if (blockedPackages.includes(packageName)) {
                return yield* Effect.fail(
                  new NpmRegistry.NpmCliError({
                    context: {
                      operation: 'pack',
                      detail: 'mock pack failure',
                    },
                    cause: new Error('mock pack failure'),
                  }),
                )
              }

              const filename = `${slugPackageName(packageName)}-${version}.tgz`
              const tarball = Fs.Path.join(
                packOptions.packDestination,
                Fs.Path.RelFile.fromString(`./${filename}`),
              )

              yield* fs
                .writeFileString(Fs.Path.toString(tarball), `packed:${packageName}@${version}`)
                .pipe(Effect.orDie)
              yield* Ref.update(packCalls, (calls) => [
                ...calls,
                {
                  cwd: packOptions.cwd,
                  packDestination: packOptions.packDestination,
                  tarball,
                  filename,
                  manifestSnapshot,
                },
              ])

              return {
                tarball,
                filename,
              }
            }),
          publish: (publishOptions) =>
            Effect.gen(function* () {
              yield* Ref.update(publishAttempts, (n) => n + 1)
              yield* Ref.update(publishCalls, (calls) => [
                ...calls,
                {
                  tarball: publishOptions.tarball,
                  ...(publishOptions.tag && { tag: publishOptions.tag }),
                  ...(publishOptions.registry && { registry: publishOptions.registry }),
                  ...(publishOptions.ignoreScripts !== undefined
                    ? { ignoreScripts: publishOptions.ignoreScripts }
                    : {}),
                },
              ])

              const blockedPackages = yield* Ref.get(failPublishPackages)
              const tarballPath = Fs.Path.toString(publishOptions.tarball)
              const shouldFail = blockedPackages.some((packageName) =>
                tarballPath.includes(`${slugPackageName(packageName)}-`),
              )

              if (shouldFail) {
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
        } satisfies NpmRegistry.NpmCliService
      }),
    ).pipe(Layer.provide(planLayer))

    const commandLayer = makeMockSpawnerLayer(options.whoamiUsername ?? 'mock-user')
    const runtimeLayer = options.runtimeLayer ?? makeTestRuntime()

    const workflowLayer = Layer.mergeAll(
      planLayer,
      runtimeLayer,
      githubLayer,
      npmLayerBase,
      commandLayer,
    )

    return {
      planLayer,
      workflowLayer,
      gitState,
      githubState,
      packCalls,
      publishCalls,
      publishAttempts,
      failPackPackages,
      failPublishPackages,
    }
  })

export const planOfficial = (packages: readonly Planner.Context['packages'][number][]) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({ packages, tags })
    return yield* Planner.official(analysis, { packages })
  })

export const planCandidate = (packages: readonly Planner.Context['packages'][number][]) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({ packages, tags })
    return yield* Planner.candidate(analysis, { packages })
  })

export const planEphemeral = (
  packages: readonly Planner.Context['packages'][number][],
  options: Planner.EphemeralOptions,
) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({ packages, tags })
    return yield* Planner.ephemeral(analysis, { packages }, options)
  })
