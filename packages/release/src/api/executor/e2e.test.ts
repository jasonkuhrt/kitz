import { ClusterWorkflowEngine, SingleRunner } from '@effect/cluster'
import { Command, CommandExecutor, FileSystem } from '@effect/platform'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { SqliteClient } from '#platform:executor/sqlite-client'
import { describe, expect, it as test } from '@effect/vitest'
import {
  Duration,
  Effect,
  Inspectable,
  Layer,
  LogLevel,
  Logger,
  Ref,
  Scope,
  Sink,
  Stream,
} from 'effect'
import { CommandExecutorLayer, FileSystemLayer } from '../../platform.js'
import { execute } from './execute.js'
import { decodeJsonRecord, planOfficial, tag } from './test-support.js'

interface FixturePackage {
  readonly name: string
  readonly dependencies?: Readonly<Record<string, string>>
  readonly scripts?: Readonly<Record<string, string>>
}

interface RealHarnessOptions {
  readonly packages: readonly FixturePackage[]
  readonly commits: readonly Git.Commit[]
  readonly failPublishPackages?: readonly string[]
}

interface RealHarness {
  readonly rootDir: Fs.Path.AbsDir
  readonly workspacePackages: Parameters<typeof planOfficial>[0]
  readonly packageJsonPaths: Readonly<Record<string, Fs.Path.AbsFile>>
  readonly planLayer: Layer.Layer<any, never, any>
  readonly workflowLayer: Layer.Layer<any, any, any>
  readonly gitState: Git.Memory.GitMemoryState
  readonly githubState: Github.Memory.GithubMemoryState
  readonly packCalls: Ref.Ref<readonly string[]>
  readonly publishCalls: Ref.Ref<readonly string[]>
  readonly failPublishPackages: Ref.Ref<readonly string[]>
}

const textEncoder = new TextEncoder()

const makeProcess = (stdout: string, exitCode: number): CommandExecutor.Process => ({
  [CommandExecutor.ProcessTypeId]: CommandExecutor.ProcessTypeId,
  pid: CommandExecutor.ProcessId(1),
  exitCode: Effect.succeed(CommandExecutor.ExitCode(exitCode)),
  isRunning: Effect.succeed(false),
  kill: () => Effect.void,
  stderr: Stream.empty,
  stdin: Sink.drain,
  stdout: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
  toJSON: () => ({ _tag: 'MockProcess', pid: 1, exitCode }),
  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON()
  },
})

const slugPackageName = (packageName: string): string =>
  packageName.replace(/^@/u, '').replace(/\//gu, '-')

const quiet = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Logger.withMinimumLogLevel(LogLevel.None))

const withFileSystem = <A, E, R>(effect: Effect.Effect<A, E, R | FileSystem.FileSystem>) =>
  effect.pipe(Effect.provide(FileSystemLayer))

const makeRuntimeTargets = (scope: string) => ({
  imports: {
    [`#${scope}`]: './src/_.ts',
  },
  exports: {
    '.': './src/_.ts',
  },
})

const makePackageJson = (pkg: FixturePackage) =>
  JSON.stringify(
    {
      name: pkg.name,
      version: '1.0.0',
      type: 'module',
      license: 'MIT',
      files: ['build', 'src'],
      ...makeRuntimeTargets(pkg.name.split('/').at(-1)!),
      ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
      ...(pkg.scripts ? { scripts: pkg.scripts } : {}),
    },
    null,
    2,
  ) + '\n'

const writeFixtureWorkspace = (
  rootDir: Fs.Path.AbsDir,
  packages: readonly FixturePackage[],
): Effect.Effect<Readonly<Record<string, Fs.Path.AbsFile>>, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const rootDirString = Fs.Path.toString(rootDir)
    const packageJsonPaths: Record<string, Fs.Path.AbsFile> = {}

    yield* Fs.write(
      Fs.Path.AbsFile.fromString(`${rootDirString}package.json`),
      JSON.stringify(
        {
          name: '@fixture/workspace',
          private: true,
          workspaces: ['packages/*'],
        },
        null,
        2,
      ) + '\n',
    ).pipe(Effect.orDie)

    for (const pkg of packages) {
      const scope = pkg.name.split('/').at(-1)!
      const packageDir = Fs.Path.AbsDir.fromString(`${rootDirString}packages/${scope}/`)
      const srcDir = Fs.Path.AbsDir.fromString(`${Fs.Path.toString(packageDir)}src/`)
      const buildDir = Fs.Path.AbsDir.fromString(`${Fs.Path.toString(packageDir)}build/`)

      yield* Fs.write(srcDir, { recursive: true }).pipe(Effect.orDie)
      yield* Fs.write(buildDir, { recursive: true }).pipe(Effect.orDie)
      yield* Fs.write(
        Fs.Path.AbsFile.fromString(`${Fs.Path.toString(srcDir)}_.ts`),
        `export const ${scope} = '${scope}'\n`,
      ).pipe(Effect.orDie)
      yield* Fs.write(
        Fs.Path.AbsFile.fromString(`${Fs.Path.toString(buildDir)}_.js`),
        `export const ${scope} = '${scope}'\n`,
      ).pipe(Effect.orDie)
      yield* Fs.write(
        Fs.Path.AbsFile.fromString(`${Fs.Path.toString(buildDir)}_.d.ts`),
        `export declare const ${scope}: string\n`,
      ).pipe(Effect.orDie)

      const packageJsonPath = Fs.Path.AbsFile.fromString(
        `${Fs.Path.toString(packageDir)}package.json`,
      )
      yield* Fs.write(packageJsonPath, makePackageJson(pkg)).pipe(Effect.orDie)
      packageJsonPaths[pkg.name] = packageJsonPath
    }

    return packageJsonPaths
  })

const makeCommandLayer = () => {
  const baseLayer = CommandExecutorLayer

  return Layer.effect(
    CommandExecutor.CommandExecutor,
    Effect.gen(function* () {
      const base = yield* CommandExecutor.CommandExecutor

      const commandOf = (command: Parameters<typeof base.string>[0]) =>
        (Command.flatten(command)[0] ?? undefined) as
          | { command?: string; args?: readonly string[] }
          | undefined

      const wrapStart: typeof base.start = (command) => {
        const standard = commandOf(command)
        if (
          standard?.command === 'npm' &&
          standard.args?.[0] === '--silent' &&
          standard.args?.[1] === 'view'
        ) {
          return Effect.succeed(
            makeProcess(
              JSON.stringify(
                {
                  error: {
                    code: 'E404',
                    summary: 'fixture version not found',
                  },
                },
                null,
                2,
              ) + '\n',
              1,
            ),
          ) as any
        }
        return base.start(command)
      }

      const wrapString: typeof base.string = (command, encoding) => {
        const standard = commandOf(command)
        if (standard?.command === 'npm' && standard.args?.[0] === 'whoami') {
          return Effect.succeed('fixture-user\n') as any
        }
        return base.string(command, encoding)
      }

      return {
        ...base,
        start: wrapStart,
        string: wrapString,
      } satisfies CommandExecutor.CommandExecutor
    }),
  ).pipe(Layer.provide(baseLayer))
}

const makeNpmLayer = (params: {
  readonly packages: readonly FixturePackage[]
  readonly packCalls: Ref.Ref<readonly string[]>
  readonly publishCalls: Ref.Ref<readonly string[]>
  readonly failPublishPackages: Ref.Ref<readonly string[]>
}) =>
  Layer.effect(
    NpmRegistry.NpmCli,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem

      const manifestFromCwd = (cwd: Fs.Path.AbsDir): Effect.Effect<Record<string, unknown>> =>
        Effect.gen(function* () {
          const packageJsonPath = Fs.Path.join(cwd, Fs.Path.RelFile.fromString('./package.json'))
          const manifestRaw = yield* fs
            .readFileString(Fs.Path.toString(packageJsonPath))
            .pipe(Effect.orDie)
          return yield* decodeJsonRecord(manifestRaw).pipe(Effect.orDie)
        })

      const packageNameFromCwd = (cwd: Fs.Path.AbsDir): Effect.Effect<string> =>
        Effect.gen(function* () {
          const manifest = yield* manifestFromCwd(cwd)
          const packageName = manifest['name']
          if (typeof packageName !== 'string') {
            return yield* Effect.die(new Error('fixture package.json missing name'))
          }
          return packageName
        })

      const packageNameFromTarball = (tarball: Fs.Path.AbsFile) => {
        const tarballPath = Fs.Path.toString(tarball)
        return params.packages.find((pkg) => tarballPath.includes(`${slugPackageName(pkg.name)}-`))
          ?.name
      }

      return {
        whoami: () => Effect.succeed('fixture-user'),
        pack: ((options) =>
          Effect.gen(function* () {
            const manifest = yield* manifestFromCwd(options.cwd)
            const packageName = yield* packageNameFromCwd(options.cwd)
            yield* Ref.update(params.packCalls, (calls) => [...calls, packageName])

            const version = manifest['version']
            if (typeof version !== 'string') {
              return yield* Effect.die(new Error('fixture package.json missing version'))
            }

            const scripts = manifest['scripts']
            const failingPackHook =
              typeof scripts === 'object' &&
              scripts !== null &&
              [`prepack`, `postpack`].some((hookName) => {
                const script = Reflect.get(scripts, hookName)
                return typeof script === 'string' && script.includes(`exit 23`)
              })

            if (failingPackHook) {
              return yield* Effect.fail(
                new NpmRegistry.NpmCliError({
                  context: {
                    operation: 'pack',
                    detail: 'fixture pack hook failure',
                  },
                  cause: new Error('fixture pack hook failure'),
                }),
              )
            }

            const filename = `${slugPackageName(packageName)}-${version}.tgz`
            const tarball = Fs.Path.join(
              options.packDestination,
              Fs.Path.RelFile.fromString(`./${filename}`),
            )

            yield* fs
              .writeFileString(Fs.Path.toString(tarball), `packed:${packageName}@${version}`)
              .pipe(Effect.orDie)

            return {
              tarball,
              filename,
            }
          })) satisfies NpmRegistry.NpmCliService['pack'],
        publish: ((options) =>
          Effect.gen(function* () {
            const packageName = packageNameFromTarball(options.tarball)
            if (packageName === undefined) {
              return yield* Effect.die(new Error('could not resolve package name from tarball'))
            }

            yield* Ref.update(params.publishCalls, (calls) => [...calls, packageName])

            const blocked = yield* Ref.get(params.failPublishPackages)
            if (blocked.includes(packageName)) {
              return yield* Effect.fail(
                new NpmRegistry.NpmCliError({
                  context: {
                    operation: 'publish',
                    detail: 'fixture publish failure',
                  },
                  cause: new Error('fixture publish failure'),
                }),
              )
            }
          })) satisfies NpmRegistry.NpmCliService['publish'],
      } satisfies NpmRegistry.NpmCliService
    }),
  )

const makeRealHarness = (
  options: RealHarnessOptions,
): Effect.Effect<RealHarness, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const rootDir = Fs.Path.AbsDir.fromString(`/tmp/kitz-release-e2e-${crypto.randomUUID()}/`)
      yield* withFileSystem(
        Fs.write(Fs.Path.AbsDir.fromString(`${Fs.Path.toString(rootDir)}.release/`), {
          recursive: true,
        }),
      ).pipe(Effect.orDie)
      const packageJsonPaths = yield* withFileSystem(
        writeFixtureWorkspace(rootDir, options.packages),
      )

      const workspacePackages = options.packages.map((pkg) => {
        const scope = pkg.name.split('/').at(-1)!
        return {
          name: Pkg.Moniker.parse(pkg.name),
          scope,
          path: Fs.Path.AbsDir.fromString(`${Fs.Path.toString(rootDir)}packages/${scope}/`),
        }
      }) satisfies Parameters<typeof planOfficial>[0]

      const tags = options.packages.map((pkg) => tag(Pkg.Moniker.parse(pkg.name), '1.0.0'))

      const envLayer = Env.Test({ cwd: rootDir })
      const { layer: gitLayer, state: gitState } = yield* Git.Memory.makeWithState({
        branch: 'main',
        tags,
        commits: [...options.commits],
        isClean: true,
      })
      const { layer: githubLayer, state: githubState } = yield* Github.Memory.makeWithState({})
      const packCalls = yield* Ref.make<readonly string[]>([])
      const publishCalls = yield* Ref.make<readonly string[]>([])
      const failPublishPackages = yield* Ref.make<readonly string[]>(
        options.failPublishPackages ?? [],
      )

      const planLayer = Layer.mergeAll(envLayer, FileSystemLayer, gitLayer)
      const commandLayer = makeCommandLayer()
      const npmLayer = makeNpmLayer({
        packages: options.packages,
        packCalls,
        publishCalls,
        failPublishPackages,
      }).pipe(Layer.provide(Layer.mergeAll(FileSystemLayer, commandLayer)))

      const workflowLayer = Layer.mergeAll(
        planLayer,
        githubLayer,
        commandLayer,
        npmLayer,
        makeWorkflowTestRuntime(`${Fs.Path.toString(rootDir)}.release/workflow.db`),
      )

      return {
        rootDir,
        workspacePackages,
        packageJsonPaths,
        planLayer,
        workflowLayer,
        gitState,
        githubState,
        packCalls,
        publishCalls,
        failPublishPackages,
      }
    }),
    (harness) =>
      withFileSystem(Fs.remove(harness.rootDir, { recursive: true, force: true })).pipe(
        Effect.orDie,
      ),
  )

const alphaPackages: readonly FixturePackage[] = [
  { name: '@kitz/a' },
  { name: '@kitz/b' },
  { name: '@kitz/c' },
]

const graphPackages: readonly FixturePackage[] = [
  { name: '@kitz/a' },
  { name: '@kitz/b' },
  { name: '@kitz/c' },
  { name: '@kitz/d', dependencies: { '@kitz/a': 'workspace:^' } },
  { name: '@kitz/e', dependencies: { '@kitz/b': 'workspace:^' } },
  { name: '@kitz/f', dependencies: { '@kitz/c': 'workspace:^' } },
]

const graphCommits = [
  Git.Memory.commit('feat(a): add feature'),
  Git.Memory.commit('feat(b): add feature'),
  Git.Memory.commit('feat(c): add feature'),
] as const

const graphResult = {
  releasedPackages: ['@kitz/a', '@kitz/b', '@kitz/c', '@kitz/d', '@kitz/e', '@kitz/f'],
  createdTags: [
    tag(Pkg.Moniker.parse('@kitz/a'), '1.1.0'),
    tag(Pkg.Moniker.parse('@kitz/b'), '1.1.0'),
    tag(Pkg.Moniker.parse('@kitz/c'), '1.1.0'),
    tag(Pkg.Moniker.parse('@kitz/d'), '1.0.1'),
    tag(Pkg.Moniker.parse('@kitz/e'), '1.0.1'),
    tag(Pkg.Moniker.parse('@kitz/f'), '1.0.1'),
  ],
  createdGHReleases: [
    tag(Pkg.Moniker.parse('@kitz/a'), '1.1.0'),
    tag(Pkg.Moniker.parse('@kitz/b'), '1.1.0'),
    tag(Pkg.Moniker.parse('@kitz/c'), '1.1.0'),
    tag(Pkg.Moniker.parse('@kitz/d'), '1.0.1'),
    tag(Pkg.Moniker.parse('@kitz/e'), '1.0.1'),
    tag(Pkg.Moniker.parse('@kitz/f'), '1.0.1'),
  ],
} as const

const withScripts = (
  packages: readonly FixturePackage[],
  packageName: string,
  scripts: Readonly<Record<string, string>>,
): readonly FixturePackage[] =>
  packages.map((pkg) => (pkg.name === packageName ? { ...pkg, scripts } : pkg))

const fixtureByName = (
  packages: readonly FixturePackage[],
  packageName: string,
): FixturePackage => {
  const pkg = packages.find((candidate) => candidate.name === packageName)
  if (pkg === undefined) {
    throw new Error(`fixture package not found: ${packageName}`)
  }
  return pkg
}

interface GraphPlanLike {
  readonly releases: readonly { package: { name: { moniker: string } } }[]
  readonly cascades: readonly { package: { name: { moniker: string } } }[]
}

const assertGraphPlan = (plan: GraphPlanLike) => {
  expect(plan.releases.map((item) => item.package.name.moniker).toSorted()).toEqual([
    '@kitz/a',
    '@kitz/b',
    '@kitz/c',
  ])
  expect(plan.cascades.map((item) => item.package.name.moniker).toSorted()).toEqual([
    '@kitz/d',
    '@kitz/e',
    '@kitz/f',
  ])
}

const assertGraphTarballsExist = (rootDir: Fs.Path.AbsDir) =>
  Effect.gen(function* () {
    for (const [packageName, version] of [
      ['@kitz/a', '1.1.0'],
      ['@kitz/b', '1.1.0'],
      ['@kitz/c', '1.1.0'],
      ['@kitz/d', '1.0.1'],
      ['@kitz/e', '1.0.1'],
      ['@kitz/f', '1.0.1'],
    ] as const) {
      const tarballPath = Fs.Path.AbsFile.fromString(
        `${Fs.Path.toString(rootDir)}.release/artifacts/${slugPackageName(packageName)}-${version}.tgz`,
      )
      expect(yield* withFileSystem(Fs.exists(tarballPath))).toBe(true)
    }
  })

interface HookFailureScenario {
  readonly name: string
  readonly packageName: string
  readonly scripts: Readonly<Record<string, string>>
  readonly firstPackCalls: readonly string[]
  readonly finalPackCalls: readonly string[]
}

const hookFailureScenarios: readonly HookFailureScenario[] = [
  {
    name: 'resumes after a primary prepack failure',
    packageName: '@kitz/b',
    scripts: { prepack: "sh -c 'exit 23'" },
    firstPackCalls: ['@kitz/a', '@kitz/b'],
    finalPackCalls: ['@kitz/a', '@kitz/b', '@kitz/b', '@kitz/c', '@kitz/d', '@kitz/e', '@kitz/f'],
  },
  {
    name: 'resumes after a primary postpack failure',
    packageName: '@kitz/b',
    scripts: { postpack: "sh -c 'exit 23'" },
    firstPackCalls: ['@kitz/a', '@kitz/b'],
    finalPackCalls: ['@kitz/a', '@kitz/b', '@kitz/b', '@kitz/c', '@kitz/d', '@kitz/e', '@kitz/f'],
  },
  {
    name: 'resumes after a cascade prepack failure',
    packageName: '@kitz/e',
    scripts: { prepack: "sh -c 'exit 23'" },
    firstPackCalls: ['@kitz/a', '@kitz/b', '@kitz/c', '@kitz/d', '@kitz/e'],
    finalPackCalls: ['@kitz/a', '@kitz/b', '@kitz/c', '@kitz/d', '@kitz/e', '@kitz/e', '@kitz/f'],
  },
  {
    name: 'resumes after a cascade postpack failure',
    packageName: '@kitz/e',
    scripts: { postpack: "sh -c 'exit 23'" },
    firstPackCalls: ['@kitz/a', '@kitz/b', '@kitz/c', '@kitz/d', '@kitz/e'],
    finalPackCalls: ['@kitz/a', '@kitz/b', '@kitz/c', '@kitz/d', '@kitz/e', '@kitz/e', '@kitz/f'],
  },
]

interface PublishFailureScenario {
  readonly name: string
  readonly packageName: string
  readonly firstPublishCalls: readonly string[]
  readonly finalPublishCalls: readonly string[]
}

const publishFailureScenarios: readonly PublishFailureScenario[] = [
  {
    name: 'resumes a partial publish when a primary package publish fails',
    packageName: '@kitz/b',
    firstPublishCalls: ['@kitz/a', '@kitz/b'],
    finalPublishCalls: [
      '@kitz/a',
      '@kitz/b',
      '@kitz/b',
      '@kitz/c',
      '@kitz/d',
      '@kitz/e',
      '@kitz/f',
    ],
  },
  {
    name: 'resumes a partial publish when a cascade package publish fails',
    packageName: '@kitz/e',
    firstPublishCalls: ['@kitz/a', '@kitz/b', '@kitz/c', '@kitz/d', '@kitz/e'],
    finalPublishCalls: [
      '@kitz/a',
      '@kitz/b',
      '@kitz/c',
      '@kitz/d',
      '@kitz/e',
      '@kitz/e',
      '@kitz/f',
    ],
  },
]

const testShardingConfig = {
  entityMessagePollInterval: Duration.millis(10),
  entityReplyPollInterval: Duration.millis(10),
  refreshAssignmentsInterval: Duration.millis(10),
  shardLockRefreshInterval: Duration.millis(25),
  shardLockExpiration: Duration.seconds(1),
} as const

const makeWorkflowTestRuntime = (dbPath: string) =>
  ClusterWorkflowEngine.layer.pipe(
    Layer.provide(
      SingleRunner.layer({
        runnerStorage: 'memory',
        shardingConfig: testShardingConfig,
      }),
    ),
    Layer.provideMerge(SqliteClient.layer({ filename: dbPath })),
  )

// These scenarios run real pack/publish-style workflow steps and need CI headroom.
const E2E_TEST_TIMEOUT_MS = 90_000

describe('Executor e2e', () => {
  test.scopedLive(
    'resumes after a prepack failure without re-packing completed packages',
    () =>
      quiet(
        Effect.gen(function* () {
          const failingPackages: readonly FixturePackage[] = [
            ...alphaPackages.slice(0, 2),
            {
              name: '@kitz/c',
              scripts: {
                prepack: "sh -c 'exit 23'",
              },
            },
          ]

          const harness = yield* makeRealHarness({
            packages: failingPackages,
            commits: [
              Git.Memory.commit('feat(a): add feature'),
              Git.Memory.commit('feat(b): add feature'),
              Git.Memory.commit('feat(c): add feature'),
            ],
          })

          const plan = yield* planOfficial(harness.workspacePackages).pipe(
            Effect.provide(harness.planLayer),
          )

          expect(plan.releases.map((item) => item.package.name.moniker).toSorted()).toEqual([
            '@kitz/a',
            '@kitz/b',
            '@kitz/c',
          ])

          const firstRun = yield* execute(plan, { dryRun: false }).pipe(
            Effect.provide(harness.workflowLayer),
            Effect.either,
          )

          expect(firstRun._tag).toBe('Left')
          expect(yield* Ref.get(harness.packCalls)).toEqual(['@kitz/a', '@kitz/b', '@kitz/c'])
          expect(yield* Ref.get(harness.publishCalls)).toEqual([])

          const failingPackageJsonPath = harness.packageJsonPaths['@kitz/c']!
          yield* withFileSystem(
            Fs.write(
              failingPackageJsonPath,
              makePackageJson({
                name: '@kitz/c',
              }),
            ),
          ).pipe(Effect.orDie)

          const secondRun = yield* execute(plan, { dryRun: false }).pipe(
            Effect.provide(harness.workflowLayer),
            Effect.either,
          )

          expect(secondRun._tag).toBe('Right')
          if (secondRun._tag === 'Right') {
            expect(secondRun.right.releasedPackages).toEqual(['@kitz/a', '@kitz/b', '@kitz/c'])
          }

          expect(yield* Ref.get(harness.packCalls)).toEqual([
            '@kitz/a',
            '@kitz/b',
            '@kitz/c',
            '@kitz/c',
          ])
          expect(yield* Ref.get(harness.publishCalls)).toEqual(['@kitz/a', '@kitz/b', '@kitz/c'])
        }),
      ),
    E2E_TEST_TIMEOUT_MS,
  )

  for (const scenario of hookFailureScenarios) {
    test.scopedLive(
      scenario.name,
      () =>
        quiet(
          Effect.gen(function* () {
            const packages = withScripts(graphPackages, scenario.packageName, scenario.scripts)
            const harness = yield* makeRealHarness({
              packages,
              commits: graphCommits,
            })

            const plan = yield* planOfficial(harness.workspacePackages).pipe(
              Effect.provide(harness.planLayer),
            )

            assertGraphPlan(plan)

            const firstRun = yield* execute(plan, { dryRun: false }).pipe(
              Effect.provide(harness.workflowLayer),
              Effect.either,
            )

            expect(firstRun._tag).toBe('Left')
            expect(yield* Ref.get(harness.packCalls)).toEqual(scenario.firstPackCalls)
            expect(yield* Ref.get(harness.publishCalls)).toEqual([])

            const fixedPackage = fixtureByName(graphPackages, scenario.packageName)
            yield* withFileSystem(
              Fs.write(
                harness.packageJsonPaths[scenario.packageName]!,
                makePackageJson(fixedPackage),
              ),
            ).pipe(Effect.orDie)

            const secondRun = yield* execute(plan, { dryRun: false }).pipe(
              Effect.provide(harness.workflowLayer),
              Effect.either,
            )

            expect(secondRun._tag).toBe('Right')
            if (secondRun._tag === 'Right') {
              expect(secondRun.right).toEqual(graphResult)
            }

            expect(yield* Ref.get(harness.packCalls)).toEqual(scenario.finalPackCalls)
            expect(yield* Ref.get(harness.publishCalls)).toEqual(graphResult.releasedPackages)
          }),
        ),
      E2E_TEST_TIMEOUT_MS,
    )
  }

  for (const scenario of publishFailureScenarios) {
    test.scopedLive(
      scenario.name,
      () =>
        quiet(
          Effect.gen(function* () {
            const harness = yield* makeRealHarness({
              packages: graphPackages,
              commits: graphCommits,
              failPublishPackages: [scenario.packageName],
            })

            const plan = yield* planOfficial(harness.workspacePackages).pipe(
              Effect.provide(harness.planLayer),
            )

            assertGraphPlan(plan)

            const firstRun = yield* execute(plan, { dryRun: false }).pipe(
              Effect.provide(harness.workflowLayer),
              Effect.either,
            )

            expect(firstRun._tag).toBe('Left')
            expect(yield* Ref.get(harness.packCalls)).toEqual(graphResult.releasedPackages)
            expect(yield* Ref.get(harness.publishCalls)).toEqual(scenario.firstPublishCalls)
            expect(yield* Ref.get(harness.gitState.createdTags)).toEqual([])
            yield* assertGraphTarballsExist(harness.rootDir)

            yield* Ref.set(harness.failPublishPackages, [])

            const secondRun = yield* execute(plan, { dryRun: false }).pipe(
              Effect.provide(harness.workflowLayer),
              Effect.either,
            )

            expect(secondRun._tag).toBe('Right')
            if (secondRun._tag === 'Right') {
              expect(secondRun.right).toEqual(graphResult)
            }

            expect(yield* Ref.get(harness.packCalls)).toEqual(graphResult.releasedPackages)
            expect(yield* Ref.get(harness.publishCalls)).toEqual(scenario.finalPublishCalls)
          }),
        ),
      E2E_TEST_TIMEOUT_MS,
    )
  }
})
