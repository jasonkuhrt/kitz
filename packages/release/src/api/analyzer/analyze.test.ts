import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as fc from 'fast-check'
import { resolveConventionalCommitTypes } from '../config.js'
import { analyze } from './analyze.js'

const defaultTypes = resolveConventionalCommitTypes({})

const repoRoot = Fs.Path.AbsDir.fromString('/repo/')

const makePackage = (scope: string) => ({
  scope,
  name: Pkg.Moniker.parse(`@kitz/${scope}`),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const makePackageJson = (name: string, version: string, dependencies?: Record<string, string>) =>
  JSON.stringify(
    {
      name,
      version,
      ...(dependencies ? { dependencies } : {}),
    },
    null,
    2,
  )

describe('analyzer.analyze', () => {
  test('respects until SHA boundaries, filters, excludes, and cascade detection', async () => {
    const coreFeature = Git.Memory.commit('feat(core): add api', { hash: Git.Sha.make('abc1234') })
    const cliFeature = Git.Memory.commit('feat(cli): add cli polish', {
      hash: Git.Sha.make('def5678'),
    })
    const utilsFix = Git.Memory.commit('fix(utils): docs', { hash: Git.Sha.make('fedcba9') })
    const cliRelease = Git.Memory.commit('feat(cli): release 1.0.0', {
      hash: Git.Sha.make('cba9876'),
    })
    const coreRelease = Git.Memory.commit('feat(core): release 1.0.0', {
      hash: Git.Sha.make('9876abc'),
    })

    const packages = [makePackage('core'), makePackage('cli'), makePackage('utils')]
    const layer = Layer.mergeAll(
      Git.Memory.make({
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
        commits: [utilsFix, cliFeature, coreFeature, cliRelease, coreRelease],
      }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0'),
        '/repo/packages/utils/package.json': makePackageJson('@kitz/utils', '1.0.0', {
          '@kitz/core': 'workspace:*',
        }),
      }),
      Env.Test({ cwd: repoRoot }),
    )

    const result = await Effect.runPromise(
      analyze({
        packages,
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
        until: cliFeature.hash,
        filter: ['core', 'cli', 'utils'],
        exclude: ['@kitz/cli'],
        resolvedConventionalCommitTypes: defaultTypes,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.impacts.map((impact) => impact.package.name.moniker)).toEqual(['@kitz/core'])
    expect(result.cascades.map((impact) => impact.package.name.moniker)).toEqual(['@kitz/utils'])
    expect(result.unchanged).toEqual([])
  })

  test('supports until tag boundaries and reports unchanged packages when no commits remain', async () => {
    const cliFeature = Git.Memory.commit('feat(cli): add cli polish', {
      hash: Git.Sha.make('abc1234'),
    })
    const coreFeature = Git.Memory.commit('feat(core): add api', { hash: Git.Sha.make('def5678') })
    const cliRelease = Git.Memory.commit('feat(cli): release 1.0.0', {
      hash: Git.Sha.make('fedcba9'),
    })
    const coreRelease = Git.Memory.commit('feat(core): release 1.0.0', {
      hash: Git.Sha.make('cba9876'),
    })

    const packages = [makePackage('core'), makePackage('cli')]
    const layer = Layer.mergeAll(
      Git.Memory.make({
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
        commits: [cliFeature, coreFeature, cliRelease, coreRelease],
      }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0'),
      }),
      Env.Test({ cwd: repoRoot }),
    )

    const result = await Effect.runPromise(
      analyze({
        packages,
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
        until: '@kitz/core@1.0.0',
        filter: ['core'],
        resolvedConventionalCommitTypes: defaultTypes,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.impacts).toEqual([])
    expect(result.cascades).toEqual([])
    expect(result.unchanged.map((pkg) => pkg.name.moniker)).toEqual(['@kitz/core'])
  })

  test('filters direct impacts while still reporting dependent cascades and unchanged packages', async () => {
    const coreFeature = Git.Memory.commit('feat(core): add api', { hash: Git.Sha.make('abc1234') })
    const cliFeature = Git.Memory.commit('feat(cli): add polish', { hash: Git.Sha.make('def5678') })

    const packages = [makePackage('core'), makePackage('cli'), makePackage('utils')]
    const layer = Layer.mergeAll(
      Git.Memory.make({
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0', '@kitz/utils@1.0.0'],
        commits: [cliFeature, coreFeature],
      }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0'),
        '/repo/packages/utils/package.json': makePackageJson('@kitz/utils', '1.0.0', {
          '@kitz/core': 'workspace:*',
        }),
      }),
      Env.Test({ cwd: repoRoot }),
    )

    const result = await Effect.runPromise(
      analyze({
        packages,
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0', '@kitz/utils@1.0.0'],
        filter: ['core', 'utils'],
        resolvedConventionalCommitTypes: defaultTypes,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.impacts.map((impact) => impact.package.name.moniker)).toEqual(['@kitz/core'])
    expect(result.cascades.map((impact) => impact.package.name.moniker)).toEqual(['@kitz/utils'])
    expect(result.unchanged).toEqual([])
  })

  test('keeps all commits when until is neither a known commit nor a tag', async () => {
    // Pins analyze's lenient until-boundary semantics: an unresolvable `until`
    // (no hash match, not a tag) silently keeps the whole commit window.
    // Notes.generate intentionally diverges (it fails); see generate.test.ts.
    const newerFeature = Git.Memory.commit('feat(core): newer change stays included', {
      hash: Git.Sha.make('abc1234'),
    })
    const olderFix = Git.Memory.commit('fix(core): older change stays included', {
      hash: Git.Sha.make('def5678'),
    })

    const layer = Layer.mergeAll(
      Git.Memory.make({ commits: [newerFeature, olderFix] }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
      }),
      Env.Test({ cwd: repoRoot }),
    )

    const result = await Effect.runPromise(
      analyze({
        packages: [makePackage('core')],
        tags: [],
        until: 'zzz9999',
        resolvedConventionalCommitTypes: defaultTypes,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.impacts).toHaveLength(1)
    expect(result.impacts[0]!.commits.map((commit) => commit.hash)).toEqual([
      Git.Sha.make('abc1234'),
      Git.Sha.make('def5678'),
    ])
    expect(result.impacts[0]!.bump).toBe('minor')
  })

  test('treats missing until-tag history as an empty newer-commit window', async () => {
    const commits = [Git.Memory.commit('feat(core): add api', { hash: Git.Sha.make('abc1234') })]
    const tags = ['@kitz/core@1.0.0']
    const gitLayer = Layer.succeed(Git.Git, {
      getTags: () => Effect.succeed(tags),
      getCurrentBranch: () => Effect.succeed('main'),
      getCommitsSince: (tag: string | undefined) =>
        tag === '@kitz/core@1.0.0'
          ? Effect.fail(
              new Git.GitError({
                context: {
                  operation: 'getCommitsSince',
                  detail: tag,
                },
                cause: new Error('tag history unavailable'),
              }),
            )
          : Effect.succeed(commits),
      isClean: () => Effect.succeed(true),
      createTag: () => Effect.void,
      pushTags: () => Effect.void,
      pushTagsAtomic: () => Effect.void,
      pushTagDryRun: () => Effect.succeed({ stdout: '' }),
      pushTagsAtomicDryRun: () => Effect.succeed({ stdout: '' }),
      getRoot: () => Effect.succeed('/repo'),
      getHeadSha: () => Effect.succeed(Git.Sha.make('abc1234')),
      getTagSha: () => Effect.succeed(Git.Sha.make('abc1234')),
      isAncestor: () => Effect.succeed(false),
      createTagAt: () => Effect.void,
      deleteTag: () => Effect.void,
      commitExists: () => Effect.succeed(true),
      pushTag: () => Effect.void,
      deleteRemoteTag: () => Effect.void,
      getRemoteUrl: () => Effect.succeed('git@github.com:example/repo.git'),
      getHooksDir: () => Effect.succeed('/repo/.git/hooks'),
    } satisfies Git.GitService)

    const result = await Effect.runPromise(
      analyze({
        since: 'baseline',
        until: '@kitz/core@1.0.0',
        packages: [makePackage('core')],
        tags,
        resolvedConventionalCommitTypes: defaultTypes,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            gitLayer,
            Fs.Memory.layer({
              '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
            }),
          ),
        ),
      ),
    )

    expect(result.impacts.map((impact) => impact.package.name.moniker)).toEqual(['@kitz/core'])
  })

  // ── Properties ─────────────────────────────────────────────────────

  // Workspace shape: n packages p0..p{n-1}; candidate edges are normalized so
  // the higher-indexed package depends on the lower-indexed one (workspace
  // dependency graphs are DAGs — npm forbids dependency cycles); commits hit
  // arbitrary scopes with arbitrary CC types (including no-bump types, which
  // must land the package in `unchanged`).
  const arbWorkspaceShape = fc.record({
    packageCount: fc.integer({ min: 1, max: 5 }),
    edges: fc.array(fc.tuple(fc.nat({ max: 4 }), fc.nat({ max: 4 })), { maxLength: 8 }),
    commitSpecs: fc.array(
      fc.tuple(fc.nat({ max: 4 }), fc.constantFrom('feat', 'fix', 'docs', 'chore', 'refactor')),
      { maxLength: 8 },
    ),
  })

  test('PROPERTY: impacts ∪ cascades ∪ unchanged exactly partitions the package set', async () => {
    await fc.assert(
      fc.asyncProperty(arbWorkspaceShape, async ({ packageCount, edges, commitSpecs }) => {
        const scopes = Array.from({ length: packageCount }, (_, index) => `p${index}`)
        const packages = scopes.map((scope) => makePackage(scope))

        // oxlint-disable-next-line kitz/domain/no-native-map-set -- Local generation scratch; never escapes this property run.
        const dependencies = new Map<number, Set<number>>()
        for (const [a, b] of edges) {
          if (a === b || a >= packageCount || b >= packageCount) continue
          const [dependency, dependent] = a < b ? [a, b] : [b, a]
          // oxlint-disable-next-line kitz/domain/no-native-map-set -- Local generation scratch; never escapes this property run.
          const existing = dependencies.get(dependent) ?? new Set<number>()
          existing.add(dependency)
          dependencies.set(dependent, existing)
        }

        const files = Object.fromEntries(
          scopes.map((scope, index) => [
            `/repo/packages/${scope}/package.json`,
            makePackageJson(
              `@kitz/${scope}`,
              '1.0.0',
              Object.fromEntries(
                [...(dependencies.get(index) ?? [])].map((dependency) => [
                  `@kitz/p${dependency}`,
                  'workspace:*',
                ]),
              ),
            ),
          ]),
        )

        const commits = commitSpecs.map(([scopeIndex, type], index) =>
          Git.Memory.commit(`${type}(p${scopeIndex % packageCount}): change ${index}`, {
            hash: Git.Sha.make((index + 1).toString(16).padStart(7, '0')),
          }),
        )

        const layer = Layer.mergeAll(
          Git.Memory.make({ commits }),
          Fs.Memory.layer(files),
          Env.Test({ cwd: repoRoot }),
        )

        const result = await Effect.runPromise(
          analyze({
            packages,
            tags: [],
            resolvedConventionalCommitTypes: defaultTypes,
          }).pipe(Effect.provide(layer)),
        )

        const partitioned = [
          ...result.impacts.map((impact) => impact.package.name.moniker),
          ...result.cascades.map((cascade) => cascade.package.name.moniker),
          ...result.unchanged.map((pkg) => pkg.name.moniker),
        ]

        // No package appears in two buckets…
        // oxlint-disable-next-line kitz/domain/no-native-map-set -- Read-only dedup for the partition assertion.
        expect(new Set(partitioned).size).toBe(partitioned.length)
        // …and no package is lost or invented.
        // oxlint-disable-next-line kitz/domain/no-native-map-set -- Read-only dedup for the partition assertion.
        expect(new Set(partitioned)).toEqual(new Set(packages.map((pkg) => pkg.name.moniker)))
      }),
      { numRuns: 30 },
    )
  })
})
