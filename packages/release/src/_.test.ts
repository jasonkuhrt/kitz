import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Test } from '@kitz/test'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Analyzer, Planner } from './__.js'

// ─── Test Helpers ───────────────────────────────────────────────────

const mockPackages: Analyzer.Workspace.Package[] = [
  { name: Pkg.Moniker.parse('@kitz/core'), scope: 'core', path: Fs.Path.AbsDir.fromString('/repo/packages/core/') },
  { name: Pkg.Moniker.parse('@kitz/cli'), scope: 'cli', path: Fs.Path.AbsDir.fromString('/repo/packages/cli/') },
  { name: Pkg.Moniker.parse('@kitz/utils'), scope: 'utils', path: Fs.Path.AbsDir.fromString('/repo/packages/utils/') },
]

const testEnv = Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') })

const makeTestLayer = (
  gitConfig: Parameters<typeof Git.Memory.make>[0],
  diskLayout: Fs.Memory.DiskLayout = {},
) => Layer.mergeAll(Git.Memory.make(gitConfig), Fs.Memory.layer(diskLayout), testEnv)

const makePackageJson = (
  name: string,
  version: string,
  dependencies?: Record<string, string>,
) => JSON.stringify({ name, version, ...(dependencies && { dependencies }) }, null, 2)

/** Type-safe version assertion */
const expectVersion = (actual: Semver.Semver | undefined, expected: string) => {
  expect(actual).toBeDefined()
  expect(Semver.equivalence(actual!, Semver.fromString(expected))).toBe(true)
}

/**
 * Pipeline helper: analyze → plan stable.
 * Mirrors the two-step pipeline CLI commands use.
 */
const analyzeAndPlanStable = (
  packages: readonly Analyzer.Workspace.Package[],
  options?: Planner.Options,
) =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({ packages, tags })
    return yield* Planner.stable(analysis, { packages }, options)
  })

/**
 * Pipeline helper: analyze → plan preview.
 */
const analyzeAndPlanPreview = (
  packages: readonly Analyzer.Workspace.Package[],
  options?: Planner.Options,
) =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({ packages, tags })
    return yield* Planner.preview(analysis, { packages }, options)
  })

/**
 * Pipeline helper: analyze → plan PR.
 */
const analyzeAndPlanPr = (
  packages: readonly Analyzer.Workspace.Package[],
  options?: Planner.PrOptions,
) =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({ packages, tags })
    return yield* Planner.pr(analysis, { packages }, options)
  })

// ─── Planner.stable ────────────────────────────────────────────────

describe('Planner.stable', () => {
  test('no releases when no commits since last tag', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0'],
      commits: [],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    expect(result.releases).toHaveLength(0)
    expect(result.cascades).toHaveLength(0)
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
      const layer = makeTestLayer({
        tags: input.tags,
        commits: [Git.Memory.commit(input.commit)],
      })

      const result = await Effect.runPromise(
        Effect.provide(analyzeAndPlanStable(mockPackages), layer),
      )

      expect(result.releases).toHaveLength(1)
      expect(result.releases[0]!.bumpType).toBe(output.bump)
      expectVersion(result.releases[0]!.nextVersion, output.version)
    })

  test('aggregates multiple commits to highest bump', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0'],
      commits: [
        Git.Memory.commit('fix(core): bug fix 1'),
        Git.Memory.commit('feat(core): new feature'),
        Git.Memory.commit('fix(core): bug fix 2'),
      ],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    expect(result.releases).toHaveLength(1)
    expect(result.releases[0]!.bumpType).toBe('minor')
    expect(result.releases[0]!.commits).toHaveLength(3)
  })

  test('handles multiple packages', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0', '@kitz/cli@2.0.0'],
      commits: [
        Git.Memory.commit('feat(core): core feature'),
        Git.Memory.commit('fix(cli): cli fix'),
      ],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    expect(result.releases).toHaveLength(2)

    const core = result.releases.find((r) => r.package.name.moniker === '@kitz/core')
    const cli = result.releases.find((r) => r.package.name.moniker === '@kitz/cli')

    expect(core!.bumpType).toBe('minor')
    expectVersion(core!.nextVersion, '1.1.0')

    expect(cli!.bumpType).toBe('patch')
    expectVersion(cli!.nextVersion, '2.0.1')
  })

  test('respects package filter', async () => {
    const layer = makeTestLayer({
      tags: [],
      commits: [
        Git.Memory.commit('feat(core): core'),
        Git.Memory.commit('feat(cli): cli'),
      ],
    })

    const result = await Effect.runPromise(
      Effect.provide(
        analyzeAndPlanStable(mockPackages, { packages: ['@kitz/core'] }),
        layer,
      ),
    )

    expect(result.releases).toHaveLength(1)
    expect(result.releases[0]!.package.name.moniker).toBe('@kitz/core')
  })
})

// ─── Planner.preview ───────────────────────────────────────────────

describe('Planner.preview', () => {
  test('generates preview version', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0'],
      commits: [Git.Memory.commit('feat(core): new feature')],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanPreview(mockPackages), layer),
    )

    expect(result.releases).toHaveLength(1)
    expectVersion(result.releases[0]!.nextVersion, '1.1.0-next.1')
  })

  test('increments preview number', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0', '@kitz/core@1.1.0-next.1', '@kitz/core@1.1.0-next.2'],
      commits: [Git.Memory.commit('feat(core): new feature')],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanPreview(mockPackages), layer),
    )

    expect(result.releases).toHaveLength(1)
    expectVersion(result.releases[0]!.nextVersion, '1.1.0-next.3')
  })
})

// ─── Planner.pr ────────────────────────────────────────────────────

describe('Planner.pr', () => {
  test('generates PR version with explicit prNumber', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0'],
      commits: [Git.Memory.commit('feat(core): new feature')],
      headSha: Git.Sha.make('abc1234'),
    })

    const result = await Effect.runPromise(
      Effect.provide(
        analyzeAndPlanPr(mockPackages, { prNumber: 42 }),
        layer,
      ),
    )

    expect(result.releases).toHaveLength(1)
    expectVersion(result.releases[0]!.nextVersion, '0.0.0-pr.42.1.abc1234')
  })

  test('increments PR iteration', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0', '@kitz/core@0.0.0-pr.42.1.def5678'],
      commits: [Git.Memory.commit('feat(core): new feature')],
      headSha: Git.Sha.make('abc1234'),
    })

    const result = await Effect.runPromise(
      Effect.provide(
        analyzeAndPlanPr(mockPackages, { prNumber: 42 }),
        layer,
      ),
    )

    expect(result.releases).toHaveLength(1)
    expectVersion(result.releases[0]!.nextVersion, '0.0.0-pr.42.2.abc1234')
  })

  test('detects PR number from environment', async () => {
    const envWithPr = Env.Test({
      cwd: Fs.Path.AbsDir.fromString('/repo/'),
      vars: { PR_NUMBER: '123' },
    })

    const layer = Layer.mergeAll(
      Git.Memory.make({
        tags: ['@kitz/core@1.0.0'],
        commits: [Git.Memory.commit('feat(core): feature')],
        headSha: Git.Sha.make('def7890'),
      }),
      Fs.Memory.layer({}),
      envWithPr,
    )

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanPr(mockPackages), layer),
    )

    expect(result.releases).toHaveLength(1)
    expectVersion(result.releases[0]!.nextVersion, '0.0.0-pr.123.1.def7890')
  })
})

// ─── Cascade Detection ──────────────────────────────────────────────

describe('Cascade', () => {
  test('detects dependent packages', async () => {
    const diskLayout: Fs.Memory.DiskLayout = {
      '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
      '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0', {
        '@kitz/core': 'workspace:*',
      }),
    }

    const layer = Layer.mergeAll(
      Git.Memory.make({
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
        commits: [Git.Memory.commit('feat(core): new API')],
      }),
      Fs.Memory.layer(diskLayout),
      testEnv,
    )

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    expect(result.releases).toHaveLength(1)
    expect(result.releases[0]!.package.name.moniker).toBe('@kitz/core')

    expect(result.cascades).toHaveLength(1)
    expect(result.cascades[0]!.package.name.moniker).toBe('@kitz/cli')
    expect(result.cascades[0]!.bumpType).toBe('patch')
  })

  test('detects transitive cascades', async () => {
    const diskLayout: Fs.Memory.DiskLayout = {
      '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
      '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0', {
        '@kitz/core': 'workspace:*',
      }),
      '/repo/packages/utils/package.json': makePackageJson('@kitz/utils', '1.0.0', {
        '@kitz/core': 'workspace:*',
      }),
    }

    const layer = Layer.mergeAll(
      Git.Memory.make({
        tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0', '@kitz/utils@1.0.0'],
        commits: [Git.Memory.commit('feat(core): new API')],
      }),
      Fs.Memory.layer(diskLayout),
      testEnv,
    )

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    expect(result.cascades).toHaveLength(2)
    const cascadeNames = result.cascades.map((c) => c.package.name.moniker)
    expect(cascadeNames).toContain('@kitz/cli')
    expect(cascadeNames).toContain('@kitz/utils')
  })
})

// ─── Getter Methods ───────────────────────────────────────────────

describe('PlannedRelease getters', () => {
  test('nextVersion returns correct version', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0'],
      commits: [Git.Memory.commit('feat(core): feature')],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    const release = result.releases[0]!

    expect(Semver.equivalence(release.nextVersion, Semver.fromString('1.1.0'))).toBe(true)
  })

  test('currentVersion returns Option for existing version', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0'],
      commits: [Git.Memory.commit('feat(core): feature')],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    const release = result.releases[0]!

    expect(Option.isSome(release.currentVersion)).toBe(true)
    expect(Semver.equivalence(Option.getOrThrow(release.currentVersion), Semver.fromString('1.0.0'))).toBe(true)
  })

  test('currentVersion returns None for first release', async () => {
    const layer = makeTestLayer({
      tags: [],
      commits: [Git.Memory.commit('feat(core): initial')],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    const release = result.releases[0]!

    expect(Option.isNone(release.currentVersion)).toBe(true)
  })

  test('bumpType returns bump type for stable releases', async () => {
    const layer = makeTestLayer({
      tags: ['@kitz/core@1.0.0'],
      commits: [Git.Memory.commit('feat(core): feature')],
    })

    const result = await Effect.runPromise(
      Effect.provide(analyzeAndPlanStable(mockPackages), layer),
    )

    const release = result.releases[0]!

    expect(release.bumpType).toBe('minor')
  })
})
