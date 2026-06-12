import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { FileSystem, Sink } from 'effect'
import { resolveConventionalCommitTypes } from '../config.js'
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

export const slugPackageName = (packageName: string): string =>
  packageName.replace(/^@/u, '').replace(/\//gu, '-')

const makeHandle = (stdout: string, exitCode: number): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    isRunning: Effect.succeed(false),
    unref: Effect.succeed(Effect.void),
    kill: () => Effect.void,
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    all: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  })

export const makeMockSpawnerLayer = (whoamiUsername: string) => {
  const spawner = ChildProcessSpawner.make((command) => {
    const standard = ChildProcess.isStandardCommand(command) ? command : undefined
    if (!standard) {
      return Effect.die('Unexpected piped command in mock spawner')
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
      const handle =
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
            )

      return Effect.succeed(handle)
    }

    return Effect.die(`Unexpected command in mock spawner: ${standard.command}`)
  })

  return Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)
}

export interface PackCall {
  readonly packageManager?: NpmRegistry.Cli.PackageManagerCli
  readonly cwd: Fs.Path.AbsDir
  readonly packDestination: Fs.Path.AbsDir
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly tarball: Fs.Path.AbsFile
  readonly filename: string
  readonly manifestSnapshot: Record<string, unknown>
}

export interface PublishCall {
  readonly packageManager?: NpmRegistry.Cli.PackageManagerCli
  readonly tarball: Fs.Path.AbsFile
  readonly tag?: string
  readonly registry?: string
  readonly ignoreScripts?: boolean
  readonly dryRun?: boolean
  readonly provenance?: boolean
  readonly provenanceFile?: Fs.Path.AbsFile
}

export interface Harness {
  readonly planLayer: Layer.Layer<any>
  readonly workflowLayer: Layer.Layer<any>
  readonly gitState: Git.Memory.GitMemoryState
  readonly githubState: Github.Memory.GithubMemoryState
  /** Inspectable registry state of the underlying `NpmRegistry.Memory` fake. */
  readonly npmState: NpmRegistry.Memory.NpmCliMemoryState
  /** Ordered pack attempts (including failing ones), with manifest snapshots. */
  readonly packCalls: Effect.Effect<readonly PackCall[]>
  /** Ordered publish attempts (including failing and dry-run ones). */
  readonly publishCalls: Effect.Effect<readonly PublishCall[]>
  readonly publishAttempts: Effect.Effect<number>
  readonly failPackPackages: Ref.Ref<readonly string[]>
  readonly failPublishPackages: Ref.Ref<readonly string[]>
}

export const makeHarness = (options: {
  readonly git: Parameters<typeof Git.Memory.makeWithState>[0]
  /** In-memory disk layout (ignored when `fsLayer` is provided). */
  readonly diskLayout?: Fs.Memory.DiskLayout
  /** Workspace root (default `/repo/`). */
  readonly cwd?: Fs.Path.AbsDir
  /** Filesystem override, e.g. the real platform FS for e2e fixtures. */
  readonly fsLayer?: Layer.Layer<FileSystem.FileSystem>
  readonly failPackPackages?: readonly string[]
  /**
   * Manifest-driven pack failure (e2e hook simulation): when the predicate
   * matches the manifest read at pack time, the pack fails. Because the
   * trigger lives in the on-disk manifest, rewriting the package heals the
   * failure — exactly how real pack hooks behave across resume.
   */
  readonly packShouldFail?: (manifest: Readonly<Record<string, unknown>>) => boolean
  readonly failPublishPackages?: readonly string[]
  readonly failAtomicPush?: boolean
  readonly missingRegistryVersions?: readonly string[]
  readonly observedDistTags?: Readonly<Record<string, string>>
  readonly runtimeLayer?: Layer.Layer<any>
  readonly whoamiUsername?: string
  readonly envVars?: Record<string, string | undefined>
}): Effect.Effect<Harness> =>
  Effect.gen(function* () {
    const envLayer = Env.Test({
      cwd: options.cwd ?? Fs.Path.AbsDir.fromString('/repo/'),
      vars: options.envVars ?? {},
    })
    const fsLayer = options.fsLayer ?? Fs.Memory.layer(options.diskLayout ?? {})
    const { layer: gitLayerBase, state: gitState } = yield* Git.Memory.makeWithState(options.git)
    const gitLayer = options.failAtomicPush
      ? Layer.effect(
          Git.Git,
          Effect.gen(function* () {
            const git = yield* Git.Git
            return {
              ...git,
              pushTagsAtomic: () =>
                Effect.fail(
                  new Git.GitError({
                    context: {
                      operation: 'pushTagsAtomic',
                      detail: 'mock atomic push failure',
                    },
                    cause: new Error('mock atomic push failure'),
                  }),
                ),
            }
          }),
        ).pipe(Layer.provide(gitLayerBase))
      : gitLayerBase
    const planLayer = Layer.mergeAll(envLayer, fsLayer, gitLayer)
    const { layer: githubLayer, state: githubState } = yield* Github.Memory.makeWithState({})
    // Registry semantics come from the real NpmRegistry.Memory fake; the
    // wrapper below only adds what Memory cannot know: pack-time manifest
    // snapshots (the executor restores manifests afterwards), the
    // manifest-driven hook-failure predicate, and dist-tag observation
    // overrides for contradiction scenarios.
    const { layer: npmMemoryLayer, state: npmState } = yield* NpmRegistry.Memory.makeWithState({
      user: options.whoamiUsername ?? 'mock-user',
      ...(options.failPackPackages !== undefined
        ? { failPackPackages: options.failPackPackages }
        : {}),
      ...(options.failPublishPackages !== undefined
        ? { failPublishPackages: options.failPublishPackages }
        : {}),
      ...(options.missingRegistryVersions !== undefined
        ? { missingVersions: options.missingRegistryVersions }
        : {}),
    })

    const packAttempts = yield* Ref.make<readonly PackCall[]>([])

    const npmLayerBase = Layer.effect(
      NpmRegistry.NpmCli,
      Effect.gen(function* () {
        const base = yield* NpmRegistry.NpmCli
        const fs = yield* FileSystem.FileSystem

        const pack: typeof base.pack = (packOptions) =>
          Effect.gen(function* () {
            const packageJsonPath = Fs.Path.join(
              packOptions.cwd,
              Fs.Path.RelFile.fromString('./package.json'),
            )
            const manifestSnapshot = yield* fs
              .readFileString(Fs.Path.toString(packageJsonPath))
              .pipe(
                Effect.flatMap((raw) => decodeJsonRecord(raw)),
                Effect.option,
              )

            if (
              manifestSnapshot._tag === 'Some' &&
              typeof manifestSnapshot.value['name'] === 'string' &&
              typeof manifestSnapshot.value['version'] === 'string'
            ) {
              const packageName = manifestSnapshot.value['name']
              const version = manifestSnapshot.value['version']

              // Record the attempt before any failure path (mirrors publish):
              // resume flows assert the exact ordered sequence of pack
              // attempts, including the failing one.
              yield* Ref.update(packAttempts, (calls) => [
                ...calls,
                {
                  cwd: packOptions.cwd,
                  packDestination: packOptions.packDestination,
                  ...(packOptions.packageManager !== undefined
                    ? { packageManager: packOptions.packageManager }
                    : {}),
                  ...(packOptions.env !== undefined ? { env: packOptions.env } : {}),
                  tarball: NpmRegistry.Tarball.path(
                    packOptions.packDestination,
                    packageName,
                    version,
                  ),
                  filename: NpmRegistry.Tarball.filename(packageName, version),
                  manifestSnapshot: manifestSnapshot.value,
                },
              ])

              if (options.packShouldFail?.(manifestSnapshot.value) === true) {
                return yield* Effect.fail(
                  new NpmRegistry.NpmCliError({
                    context: {
                      operation: 'pack',
                      detail: `pack hook failure injected for ${packageName}`,
                    },
                    cause: new Error(`pack hook failure injected for ${packageName}`),
                  }),
                )
              }
            }

            return yield* base.pack(packOptions)
          })

        const observeVersion: typeof base.observeVersion =
          options.observedDistTags === undefined
            ? base.observeVersion
            : (packageName, version, observeOptions) =>
                base.observeVersion(packageName, version, observeOptions).pipe(
                  Effect.map((observation) => ({
                    ...observation,
                    distTags: options.observedDistTags!,
                  })),
                )

        return {
          ...base,
          pack,
          observeVersion,
        } satisfies NpmRegistry.NpmCliService
      }),
    ).pipe(Layer.provide(npmMemoryLayer), Layer.provide(planLayer))

    const commandLayer = makeMockSpawnerLayer(options.whoamiUsername ?? 'mock-user')
    const runtimeLayer = options.runtimeLayer ?? makeTestRuntime()

    const workflowLayer = Layer.mergeAll(
      planLayer,
      runtimeLayer,
      githubLayer,
      npmLayerBase,
      commandLayer,
    )

    const publishCalls = Ref.get(npmState.calls).pipe(
      Effect.map((calls) =>
        calls.flatMap((call): PublishCall[] => {
          if (call.operation !== 'publish') return []
          const publishOptions = call.options
          return [
            {
              tarball: publishOptions.tarball,
              ...(publishOptions.packageManager !== undefined
                ? { packageManager: publishOptions.packageManager }
                : {}),
              ...(publishOptions.tag !== undefined ? { tag: publishOptions.tag } : {}),
              ...(publishOptions.registry !== undefined
                ? { registry: publishOptions.registry }
                : {}),
              ...(publishOptions.ignoreScripts !== undefined
                ? { ignoreScripts: publishOptions.ignoreScripts }
                : {}),
              ...(publishOptions.dryRun !== undefined ? { dryRun: publishOptions.dryRun } : {}),
              ...(publishOptions.provenance !== undefined
                ? { provenance: publishOptions.provenance }
                : {}),
              ...(publishOptions.provenanceFile !== undefined
                ? { provenanceFile: publishOptions.provenanceFile }
                : {}),
            },
          ]
        }),
      ),
    )

    return {
      planLayer,
      workflowLayer,
      gitState,
      githubState,
      npmState,
      packCalls: Ref.get(packAttempts),
      publishCalls,
      publishAttempts: Effect.map(publishCalls, (calls) => calls.length),
      failPackPackages: npmState.failPackPackages,
      failPublishPackages: npmState.failPublishPackages,
    }
  })

export const planOfficial = (packages: readonly Planner.Context['packages'][number][]) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({
      packages,
      tags,
      resolvedConventionalCommitTypes: resolveConventionalCommitTypes({}),
    })
    return yield* Planner.official(analysis, { packages })
  })

export const planCandidate = (packages: readonly Planner.Context['packages'][number][]) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({
      packages,
      tags,
      resolvedConventionalCommitTypes: resolveConventionalCommitTypes({}),
    })
    return yield* Planner.candidate(analysis, { packages })
  })

export const planEphemeral = (
  packages: readonly Planner.Context['packages'][number][],
  options: Planner.EphemeralOptions,
) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({
      packages,
      tags,
      resolvedConventionalCommitTypes: resolveConventionalCommitTypes({}),
    })
    return yield* Planner.ephemeral(analysis, { packages }, options)
  })
