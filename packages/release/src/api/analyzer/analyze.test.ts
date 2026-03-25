import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { analyze } from './analyze.js'

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
      }).pipe(Effect.provide(layer)),
    )

    expect(result.impacts.map((impact) => impact.package.name.moniker)).toEqual(['@kitz/core'])
    expect(result.cascades.map((impact) => impact.package.name.moniker)).toEqual(['@kitz/utils'])
    expect(result.unchanged).toEqual([])
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
    } satisfies Git.GitService)

    const result = await Effect.runPromise(
      analyze({
        since: 'baseline',
        until: '@kitz/core@1.0.0',
        packages: [makePackage('core')],
        tags,
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
})
