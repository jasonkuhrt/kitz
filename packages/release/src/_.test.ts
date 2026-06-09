import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Test } from '@kitz/test'
import { Effect, Layer, Option, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as ReleaseConfig from './api/config.js'
import { Analyzer, Planner, Publishing, ReleaseContract } from './__.js'

const mockPackages: Analyzer.Workspace.Package[] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
  },
  {
    name: Pkg.Moniker.parse('@kitz/cli'),
    scope: 'cli',
    path: Fs.Path.AbsDir.fromString('/repo/packages/cli/'),
  },
  {
    name: Pkg.Moniker.parse('@kitz/utils'),
    scope: 'utils',
    path: Fs.Path.AbsDir.fromString('/repo/packages/utils/'),
  },
]

const testEnv = Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') })

const makeTestLayer = (
  gitConfig: Parameters<typeof Git.Memory.make>[0],
  diskLayout: Fs.Memory.DiskLayout = {},
) => Layer.mergeAll(Git.Memory.make(gitConfig), Fs.Memory.layer(diskLayout), testEnv)

const makePackageJson = (
  name: string,
  version: string,
  options?: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  },
) =>
  JSON.stringify(
    {
      name,
      version,
      ...(options?.dependencies && { dependencies: options.dependencies }),
      ...(options?.devDependencies && { devDependencies: options.devDependencies }),
      ...(options?.peerDependencies && { peerDependencies: options.peerDependencies }),
    },
    null,
    2,
  )

const expectVersion = (actual: Semver.Semver | undefined, expected: string) => {
  expect(actual).toBeDefined()
  expect(Semver.equivalence(actual!, Semver.fromString(expected))).toBe(true)
}

const pkgJson = (
  scope: string,
  options?: Parameters<typeof makePackageJson>[2],
): readonly [string, string] => [
  `/repo/packages/${scope}/package.json`,
  makePackageJson(`@kitz/${scope}`, '1.0.0', options),
]

const packageJsons = (...entries: readonly (readonly [string, string])[]) =>
  Object.fromEntries(entries)

const analyzeAndPlanOfficial = (
  packages: readonly Analyzer.Workspace.Package[],
  options?: Planner.Options,
) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({
      packages,
      tags,
      resolvedConventionalCommitTypes: ReleaseConfig.resolveConventionalCommitTypes({}),
    })
    return yield* Planner.official(analysis, { packages }, options)
  })

const analyzeWorkspace = ({
  git,
  diskLayout,
  until,
}: {
  readonly git: Parameters<typeof Git.Memory.make>[0]
  readonly diskLayout?: Fs.Memory.DiskLayout
  readonly until?: string
}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const gitService = yield* Git.Git
      return yield* Analyzer.analyze({
        packages: mockPackages,
        tags: yield* gitService.getTags(),
        ...(until === undefined ? {} : { until }),
        resolvedConventionalCommitTypes: ReleaseConfig.resolveConventionalCommitTypes({}),
      })
    }).pipe(Effect.provide(makeTestLayer(git, diskLayout))),
  )

const runOfficial = ({
  git,
  diskLayout,
  options,
}: {
  readonly git: Parameters<typeof Git.Memory.make>[0]
  readonly diskLayout?: Fs.Memory.DiskLayout
  readonly options?: Planner.Options
}) =>
  Effect.runPromise(
    analyzeAndPlanOfficial(mockPackages, options).pipe(
      Effect.provide(makeTestLayer(git, diskLayout)),
    ),
  )

describe('release status cli', () => {
  test('reports not-started for a custom plan before .release exists', () => {
    const projectDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-status-'))

    try {
      writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'fixture', private: true, type: 'module' }, null, 2),
      )

      const plan = Planner.Plan.make({
        lifecycle: 'official',
        timestamp: '2026-06-09T00:00:00.000Z',
        releases: [],
        cascades: [],
        planDigest: ReleaseContract.PlanDigest.make({
          algorithm: 'sha256',
          value: 'a'.repeat(64),
        }),
        publishIntent: ReleaseContract.publishIntentFromSemantics({
          semantics: Publishing.resolvePublishSemantics({ lifecycle: 'official' }),
          trunk: 'main',
        }),
      })
      writeFileSync(
        path.join(projectDir, 'release plan.json'),
        `${JSON.stringify(Schema.encodeSync(Planner.Plan)(plan), null, 2)}\n`,
      )

      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./cli/cli.ts', import.meta.url)),
          'status',
          '--from',
          'release plan.json',
        ],
        {
          cwd: projectDir,
          encoding: 'utf8',
          env: process.env,
        },
      )

      if (result.error) {
        throw result.error
      }

      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Release workflow status: [NOT-STARTED]')
      expect(result.stdout).toContain("Run `release apply --from 'release plan.json'`")
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })
})

describe('Planner.official', () => {
  test('no releases when no commits since last tag', async () => {
    const result = await runOfficial({
      git: {
        tags: ['@kitz/core@1.0.0'],
        commits: [],
      },
    })

    expect(result.releases).toHaveLength(0)
    expect(result.cascades).toHaveLength(0)
  })

  test('uses the most recent package tag in git history as analysis baseline', async () => {
    const result = await runOfficial({
      git: {
        tags: ['@kitz/core@9.0.0', '@kitz/cli@1.0.0'],
        commits: [
          Git.Memory.commit('chore: housekeeping'),
          Git.Memory.commit('feat(cli): 1.0.0 release'),
          Git.Memory.commit('chore: bridge'),
          Git.Memory.commit('feat(core): 9.0.0 release'),
        ],
      },
    })

    expect(result.releases).toHaveLength(0)
    expect(result.cascades).toHaveLength(0)
  })

  test('keeps unreleased package commits even when another package was released more recently', async () => {
    const result = await runOfficial({
      git: {
        tags: ['@kitz/core@9.0.0', '@kitz/cli@1.0.0'],
        commits: [
          Git.Memory.commit('feat(cli): 1.0.0 release'),
          Git.Memory.commit('fix(core): patch after the core release'),
          Git.Memory.commit('feat(core): feature after the core release'),
          Git.Memory.commit('feat(core): 9.0.0 release'),
        ],
      },
    })

    expect(result.releases).toHaveLength(1)
    expect(result.releases[0]!.package.name.moniker).toBe('@kitz/core')
    expect(result.releases[0]!.bumpType).toBe('minor')
    expectVersion(result.releases[0]!.nextVersion, '9.1.0')
    expect(result.releases[0]!.commits).toHaveLength(2)
  })

  Test.describe('bump detection')
    .inputType<{ tags: string[]; commit: string }>()
    .outputType<{ bump: Semver.BumpType; version: string }>()
    .cases(
      {
        input: { tags: ['@kitz/core@1.0.0'], commit: 'fix(core): bug fix' },
        output: { bump: 'patch', version: '1.0.1' },
        comment: 'fix → patch',
      },
      {
        input: { tags: ['@kitz/core@1.0.0'], commit: 'feat(core): new feature' },
        output: { bump: 'minor', version: '1.1.0' },
        comment: 'feat → minor',
      },
      {
        input: { tags: ['@kitz/core@1.0.0'], commit: 'feat(core)!: breaking change' },
        output: { bump: 'major', version: '2.0.0' },
        comment: 'breaking → major',
      },
      {
        input: { tags: [], commit: 'feat(core): initial' },
        output: { bump: 'minor', version: '0.1.0' },
        comment: 'first release starts at 0.x.x',
      },
    )
    .test(async ({ input, output }) => {
      const result = await runOfficial({
        git: { tags: input.tags, commits: [Git.Memory.commit(input.commit)] },
      })

      expect(result.releases).toHaveLength(1)
      expect(result.releases[0]!.bumpType).toBe(output.bump)
      expectVersion(result.releases[0]!.nextVersion, output.version)
    })

  test('aggregates multiple commits to highest bump', async () => {
    const result = await runOfficial({
      git: {
        tags: ['@kitz/core@1.0.0'],
        commits: [
          Git.Memory.commit('fix(core): bug fix 1'),
          Git.Memory.commit('feat(core): new feature'),
          Git.Memory.commit('fix(core): bug fix 2'),
        ],
      },
    })

    expect(result.releases).toHaveLength(1)
    expect(result.releases[0]!.bumpType).toBe('minor')
    expect(result.releases[0]!.commits).toHaveLength(3)
  })

  test('handles multiple packages', async () => {
    const result = await runOfficial({
      git: {
        tags: ['@kitz/core@1.0.0', '@kitz/cli@2.0.0'],
        commits: [
          Git.Memory.commit('feat(core): core feature'),
          Git.Memory.commit('fix(cli): cli fix'),
        ],
      },
    })

    expect(result.releases).toHaveLength(2)

    const core = result.releases.find((r) => r.package.name.moniker === '@kitz/core')
    const cli = result.releases.find((r) => r.package.name.moniker === '@kitz/cli')

    expect(core!.bumpType).toBe('minor')
    expectVersion(core!.nextVersion, '1.1.0')

    expect(cli!.bumpType).toBe('patch')
    expectVersion(cli!.nextVersion, '2.0.1')
  })

  test('respects package filter', async () => {
    const result = await runOfficial({
      git: {
        tags: [],
        commits: [Git.Memory.commit('feat(core): core'), Git.Memory.commit('feat(cli): cli')],
      },
      options: { packages: ['@kitz/core'] },
    })

    expect(result.releases).toHaveLength(1)
    expect(result.releases[0]!.package.name.moniker).toBe('@kitz/core')
  })
})

describe('Cascade', () => {
  test('detects dependent packages', async () => {
    const result = await runOfficial({
      git: {
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
        commits: [Git.Memory.commit('feat(core): new API')],
      },
      diskLayout: packageJsons(
        pkgJson('core'),
        pkgJson('cli', {
          dependencies: {
            '@kitz/core': 'workspace:*',
          },
        }),
      ),
    })

    expect(result.releases).toHaveLength(1)
    expect(result.releases[0]!.package.name.moniker).toBe('@kitz/core')

    expect(result.cascades).toHaveLength(1)
    expect(result.cascades[0]!.package.name.moniker).toBe('@kitz/cli')
    expect(result.cascades[0]!.bumpType).toBe('patch')
  })

  test('detects transitive cascades', async () => {
    const result = await runOfficial({
      git: {
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0', '@kitz/utils@1.0.0'],
        commits: [Git.Memory.commit('feat(core): new API')],
      },
      diskLayout: packageJsons(
        pkgJson('core'),
        pkgJson('cli', {
          dependencies: {
            '@kitz/core': 'workspace:*',
          },
        }),
        pkgJson('utils', {
          dependencies: {
            '@kitz/core': 'workspace:*',
          },
        }),
      ),
    })

    expect(result.cascades).toHaveLength(2)
    const cascadeNames = result.cascades.map((c) => c.package.name.moniker)
    expect(cascadeNames).toContain('@kitz/cli')
    expect(cascadeNames).toContain('@kitz/utils')
  })

  test('annotates cascade commits with triggering primary release', async () => {
    const result = await runOfficial({
      git: {
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
        commits: [Git.Memory.commit('feat(core): new API')],
      },
      diskLayout: packageJsons(
        pkgJson('core'),
        pkgJson('cli', {
          dependencies: {
            '@kitz/core': 'workspace:*',
          },
        }),
      ),
    })

    expect(result.cascades).toHaveLength(1)
    const cascade = result.cascades[0]!
    const info = cascade.commits[0]!.forScope(cascade.package.scope)

    expect(info.description).toContain('Depends on @kitz/core@1.1.0')
  })
})

describe('Analyzer', () => {
  test('records cascade trigger packages in analysis output', async () => {
    const analysis = await analyzeWorkspace({
      git: {
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
        commits: [Git.Memory.commit('feat(core): new API')],
      },
      diskLayout: packageJsons(
        pkgJson('core'),
        pkgJson('cli', {
          dependencies: {
            '@kitz/core': 'workspace:*',
          },
        }),
      ),
    })

    expect(analysis.cascades).toHaveLength(1)
    expect(analysis.cascades[0]!.triggeredBy.map((pkg) => pkg.name.moniker)).toContain('@kitz/core')
  })

  test('ignores dev and peer dependency edges when recording cascades', async () => {
    const analysis = await analyzeWorkspace({
      git: {
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0', '@kitz/utils@1.0.0'],
        commits: [Git.Memory.commit('feat(core): new API')],
      },
      diskLayout: packageJsons(
        pkgJson('core'),
        pkgJson('cli', {
          devDependencies: {
            '@kitz/core': 'workspace:*',
          },
        }),
        pkgJson('utils', {
          peerDependencies: {
            '@kitz/core': 'workspace:*',
          },
        }),
      ),
    })

    expect(analysis.impacts).toHaveLength(1)
    expect(analysis.impacts[0]!.package.name.moniker).toBe('@kitz/core')
    expect(analysis.cascades).toHaveLength(0)
  })

  test('respects until boundary when analyzing commits', async () => {
    const olderHash = Git.Sha.make('1111111')
    const newerHash = Git.Sha.make('2222222')

    const analysis = await analyzeWorkspace({
      git: {
        tags: [],
        commits: [
          Git.Memory.commit('feat(core): should be excluded by until', { hash: newerHash }),
          Git.Memory.commit('chore(core): boundary commit', { hash: olderHash }),
        ],
      },
      until: olderHash,
    })

    expect(analysis.impacts).toHaveLength(0)
  })

  test('treats until tag lookup failures as an empty newer-commit window after tag discovery', async () => {
    const untilTag = 'release-boundary'
    const layer = makeTestLayer({
      tags: [untilTag],
      commits: [Git.Memory.commit('feat(core): newer change')],
    })

    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const baseGit = yield* Git.Git
          const tags = yield* baseGit.getTags()

          return yield* Analyzer.analyze({
            packages: mockPackages,
            tags,
            until: untilTag,
            resolvedConventionalCommitTypes: ReleaseConfig.resolveConventionalCommitTypes({}),
          }).pipe(
            Effect.provideService(Git.Git, {
              ...baseGit,
              getCommitsSince: (tag) =>
                tag === untilTag
                  ? Effect.fail(
                      new Git.GitError({
                        context: {
                          operation: 'getCommitsSince',
                          detail: `forced until lookup failure for ${tag}`,
                        },
                        cause: new Error(`forced until lookup failure for ${tag}`),
                      }),
                    )
                  : baseGit.getCommitsSince(tag),
            }),
          )
        }),
        layer,
      ).pipe(Effect.result),
    )

    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(result.success.impacts.map((impact) => impact.package.name.moniker)).toContain(
        '@kitz/core',
      )
    }
  })
})
