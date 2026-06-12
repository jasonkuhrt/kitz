import { FileSystem } from 'effect'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Otel } from '@kitz/otel'
import { Pkg } from '@kitz/pkg'
import { describe, expect } from 'bun:test'
import { Test } from '@kitz/test'
import { Effect, Layer, Ref, Scope } from 'effect'
import { FileSystemLayer } from '../../platform.js'
import { execute, executeObservable, resume, type ExecutionGraph } from './execute.js'
import { makeHarness, planOfficial, slugPackageName, tag } from './test-support.js'
import { digestForPlan } from '../proof.js'

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
  /** Ordered package names of every pack attempt (including failing ones). */
  readonly packCallNames: Effect.Effect<readonly string[]>
  /** Ordered package names of every publish attempt (including failing ones). */
  readonly publishCallNames: Effect.Effect<readonly string[]>
  readonly failPublishPackages: Ref.Ref<readonly string[]>
}

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

/**
 * Manifest-driven pack failure used to simulate failing prepack/postpack
 * hooks. The trigger lives in the on-disk manifest, so rewriting the fixture
 * package.json heals the failure across resume — exactly how real hooks
 * behave.
 */
const failingPackHook = (manifest: Readonly<Record<string, unknown>>): boolean => {
  const scripts = manifest['scripts']
  return (
    typeof scripts === 'object' &&
    scripts !== null &&
    [`prepack`, `postpack`].some((hookName) => {
      const script = Reflect.get(scripts, hookName)
      return typeof script === 'string' && script.includes(`exit 23`)
    })
  )
}

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

      const harness = yield* makeHarness({
        git: {
          branch: 'main',
          tags,
          commits: [...options.commits],
          isClean: true,
        },
        cwd: rootDir,
        fsLayer: FileSystemLayer,
        whoamiUsername: 'fixture-user',
        packShouldFail: failingPackHook,
        ...(options.failPublishPackages !== undefined
          ? { failPublishPackages: options.failPublishPackages }
          : {}),
      })

      const nameFromTarball = (tarball: Fs.Path.AbsFile): string => {
        const tarballPath = Fs.Path.toString(tarball)
        const fixture = options.packages.find((pkg) =>
          tarballPath.includes(`${slugPackageName(pkg.name)}-`),
        )
        if (fixture === undefined) {
          throw new Error(`could not resolve package name from tarball: ${tarballPath}`)
        }
        return fixture.name
      }

      return {
        rootDir,
        workspacePackages,
        packageJsonPaths,
        planLayer: harness.planLayer,
        workflowLayer: harness.workflowLayer,
        gitState: harness.gitState,
        githubState: harness.githubState,
        packCallNames: harness.packCalls.pipe(
          Effect.map((calls) => calls.map((call) => String(call.manifestSnapshot['name']))),
        ),
        publishCallNames: harness.publishCalls.pipe(
          Effect.map((calls) => calls.map((call) => nameFromTarball(call.tarball))),
        ),
        failPublishPackages: harness.failPublishPackages,
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

const assertGraphTarballsExist = (rootDir: Fs.Path.AbsDir, planDigest: string) =>
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
        `${Fs.Path.toString(rootDir)}.release/artifacts/${planDigest}/${slugPackageName(packageName)}-${version}.tgz`,
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

const releaseTraceId = 'release.integration'

const activityParts = (activity: string) => {
  const separator = activity.indexOf(':')

  return separator === -1
    ? { operation: activity }
    : {
        operation: activity.slice(0, separator),
        subject: activity.slice(separator + 1),
      }
}

const operationName = (activityOperation: string) => {
  switch (activityOperation) {
    case 'CreateGHRelease':
      return 'createRelease'
    case 'CreateTag':
      return 'createTag'
    case 'Prepare':
      return 'prepare'
    case 'Publish':
      return 'publish'
    case 'PushTag':
      return 'pushTag'
    case 'PushTagsAtomic':
      return 'pushTagsAtomic'
    case 'VerifyPublish':
      return 'verifyPublish'
    default:
      return activityOperation
  }
}

const serviceName = (activityOperation: string) => {
  switch (activityOperation) {
    case 'CreateGHRelease':
      return 'github'
    case 'CreateTag':
    case 'PushTag':
    case 'PushTagsAtomic':
      return 'git'
    case 'Prepare':
      return 'artifacter'
    case 'Publish':
    case 'VerifyPublish':
      return 'packageRegistry'
    default:
      return 'workflow'
  }
}

const activitySpanName = (activity: string) => {
  const parts = activityParts(activity)

  return operationName(parts.operation)
}

const tagAttributes = (tagName: string) => {
  const versionSeparator = tagName.lastIndexOf('@')
  const packageName = versionSeparator > 0 ? tagName.slice(0, versionSeparator) : tagName
  const version = versionSeparator > 0 ? tagName.slice(versionSeparator + 1) : undefined

  return {
    'release.package.name': packageName,
    ...(version === undefined ? {} : { 'release.version': version }),
    'release.tag': tagName,
  }
}

const activityAttributes = (activity: string) => {
  const parts = activityParts(activity)
  if (parts.subject === undefined) return undefined

  switch (parts.operation) {
    case 'CreateGHRelease':
    case 'CreateTag':
    case 'PushTag':
      return tagAttributes(parts.subject)
    case 'Prepare':
    case 'Publish':
    case 'VerifyPublish':
      return { 'release.package.name': parts.subject }
    case 'PushTagsAtomic':
      return { 'release.tags.count': parts.subject }
    default:
      return undefined
  }
}

const traceFromExecutionGraph = (graph: ExecutionGraph) =>
  Otel.Trace.make({
    traceId: releaseTraceId,
    spans: [
      Otel.Span.make({
        traceId: releaseTraceId,
        spanId: 'workflow.apply',
        name: 'apply',
        serviceName: 'workflow',
      }),
      ...graph.layers.flatMap((layer, layerIndex) => {
        const layerSpanId = `workflow.layer.${layerIndex + 1}`

        return [
          Otel.Span.make({
            traceId: releaseTraceId,
            spanId: layerSpanId,
            parentSpanId: 'workflow.apply',
            name: `stage ${layerIndex + 1}`,
            serviceName: 'workflow',
          }),
          ...layer.map((activity, activityIndex) => {
            const { operation } = activityParts(activity)
            const attributes = activityAttributes(activity)

            return Otel.Span.make({
              traceId: releaseTraceId,
              spanId: `workflow.layer.${layerIndex + 1}.activity.${activityIndex + 1}`,
              parentSpanId: layerSpanId,
              name: activitySpanName(activity),
              serviceName: serviceName(operation),
              ...(attributes === undefined ? {} : { attributes }),
            })
          }),
        ]
      }),
    ],
  })

// These scenarios run real pack/publish-style workflow steps and need CI headroom.
const E2E_TEST_TIMEOUT_MS = 90_000
const testE2E = <Error>(name: string, effect: () => Effect.Effect<void, Error, Scope.Scope>) =>
  Test.live(name, () => effect(), E2E_TEST_TIMEOUT_MS)

describe('Executor e2e', () => {
  testE2E('renders the release workflow as an otel trace snapshot', () =>
    Effect.gen(function* () {
      const harness = yield* makeRealHarness({
        packages: [
          { name: '@kitz/a' },
          { name: '@kitz/b', dependencies: { '@kitz/a': 'workspace:^' } },
        ],
        commits: [Git.Memory.commit('feat(a): add feature')],
      })

      const plan = yield* planOfficial(harness.workspacePackages).pipe(
        Effect.provide(harness.planLayer),
      )
      const workflowContext = yield* Layer.build(harness.workflowLayer)
      const observable = yield* executeObservable(plan, {
        dryRun: false,
        dbPath: `${Fs.Path.toString(harness.rootDir)}.release/workflow.db`,
      }).pipe(Effect.provide(workflowContext))
      const result = yield* observable.execute.pipe(Effect.provide(workflowContext))

      expect(result).toEqual({
        releasedPackages: ['@kitz/a', '@kitz/b'],
        createdTags: [
          tag(Pkg.Moniker.parse('@kitz/a'), '1.1.0'),
          tag(Pkg.Moniker.parse('@kitz/b'), '1.0.1'),
        ],
        createdGHReleases: [
          tag(Pkg.Moniker.parse('@kitz/a'), '1.1.0'),
          tag(Pkg.Moniker.parse('@kitz/b'), '1.0.1'),
        ],
      })

      expect(Otel.print(traceFromExecutionGraph(observable.graph), { sort: 'input' }))
        .toMatchInlineSnapshot(`
"trace release.integration (20 spans)
└─ [workflow] apply
   ├─ [workflow] stage 1
   │  ├─ [artifacter] prepare {release.package.name=@kitz/a}
   │  └─ [artifacter] prepare {release.package.name=@kitz/b}
   ├─ [workflow] stage 2
   │  └─ [packageRegistry] publish {release.package.name=@kitz/a}
   ├─ [workflow] stage 3
   │  ├─ [packageRegistry] publish {release.package.name=@kitz/b}
   │  └─ [packageRegistry] verifyPublish {release.package.name=@kitz/a}
   ├─ [workflow] stage 4
   │  ├─ [packageRegistry] verifyPublish {release.package.name=@kitz/b}
   │  └─ [git] createTag {release.package.name=@kitz/a release.version=1.1.0 release.tag=@kitz/a@1.1.0}
   ├─ [workflow] stage 5
   │  ├─ [git] createTag {release.package.name=@kitz/b release.version=1.0.1 release.tag=@kitz/b@1.0.1}
   │  └─ [git] pushTag {release.package.name=@kitz/a release.version=1.1.0 release.tag=@kitz/a@1.1.0}
   ├─ [workflow] stage 6
   │  ├─ [git] pushTag {release.package.name=@kitz/b release.version=1.0.1 release.tag=@kitz/b@1.0.1}
   │  └─ [github] createRelease {release.package.name=@kitz/a release.version=1.1.0 release.tag=@kitz/a@1.1.0}
   └─ [workflow] stage 7
      └─ [github] createRelease {release.package.name=@kitz/b release.version=1.0.1 release.tag=@kitz/b@1.0.1}"
`)
    }),
  )

  testE2E('resumes after a prepack failure without re-packing completed packages', () =>
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

      const workflowContext = yield* Layer.build(harness.workflowLayer)

      const firstRun = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(workflowContext),
        Effect.result,
      )

      expect(firstRun._tag).toBe('Failure')
      expect(yield* harness.packCallNames).toEqual(['@kitz/a', '@kitz/b', '@kitz/c'])
      expect(yield* harness.publishCallNames).toEqual([])

      const failingPackageJsonPath = harness.packageJsonPaths['@kitz/c']!
      yield* withFileSystem(
        Fs.write(
          failingPackageJsonPath,
          makePackageJson({
            name: '@kitz/c',
          }),
        ),
      ).pipe(Effect.orDie)

      const secondRun = yield* resume(plan, { dryRun: false }).pipe(
        Effect.provide(workflowContext),
        Effect.result,
      )

      expect(secondRun._tag).toBe('Success')
      if (secondRun._tag === 'Success') {
        expect(secondRun.success.releasedPackages).toEqual(['@kitz/a', '@kitz/b', '@kitz/c'])
      }

      expect(yield* harness.packCallNames).toEqual(['@kitz/a', '@kitz/b', '@kitz/c', '@kitz/c'])
      expect(yield* harness.publishCallNames).toEqual(['@kitz/a', '@kitz/b', '@kitz/c'])
    }),
  )

  for (const scenario of hookFailureScenarios) {
    testE2E(scenario.name, () =>
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

        const workflowContext = yield* Layer.build(harness.workflowLayer)

        const firstRun = yield* execute(plan, { dryRun: false }).pipe(
          Effect.provide(workflowContext),
          Effect.result,
        )

        expect(firstRun._tag).toBe('Failure')
        expect(yield* harness.packCallNames).toEqual(scenario.firstPackCalls)
        expect(yield* harness.publishCallNames).toEqual([])

        const fixedPackage = fixtureByName(graphPackages, scenario.packageName)
        yield* withFileSystem(
          Fs.write(harness.packageJsonPaths[scenario.packageName]!, makePackageJson(fixedPackage)),
        ).pipe(Effect.orDie)

        const secondRun = yield* resume(plan, { dryRun: false }).pipe(
          Effect.provide(workflowContext),
          Effect.result,
        )

        expect(secondRun._tag).toBe('Success')
        if (secondRun._tag === 'Success') {
          expect(secondRun.success).toEqual<typeof graphResult>(graphResult)
        }

        expect(yield* harness.packCallNames).toEqual(scenario.finalPackCalls)
        expect(yield* harness.publishCallNames).toEqual(graphResult.releasedPackages)
      }),
    )
  }

  for (const scenario of publishFailureScenarios) {
    testE2E(scenario.name, () =>
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

        const workflowContext = yield* Layer.build(harness.workflowLayer)

        const firstRun = yield* execute(plan, { dryRun: false }).pipe(
          Effect.provide(workflowContext),
          Effect.result,
        )

        expect(firstRun._tag).toBe('Failure')
        expect(yield* harness.packCallNames).toEqual(graphResult.releasedPackages)
        expect(yield* harness.publishCallNames).toEqual(scenario.firstPublishCalls)
        expect(yield* Ref.get(harness.gitState.createdTags)).toEqual([])
        yield* assertGraphTarballsExist(harness.rootDir, digestForPlan(plan).value)

        yield* Ref.set(harness.failPublishPackages, [])

        const secondRun = yield* resume(plan, { dryRun: false }).pipe(
          Effect.provide(workflowContext),
          Effect.result,
        )

        expect(secondRun._tag).toBe('Success')
        if (secondRun._tag === 'Success') {
          expect(secondRun.success).toEqual<typeof graphResult>(graphResult)
        }

        expect(yield* harness.packCallNames).toEqual(graphResult.releasedPackages)
        expect(yield* harness.publishCallNames).toEqual(scenario.finalPublishCalls)
      }),
    )
  }
})
