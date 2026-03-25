import { ConventionalCommits } from '@kitz/conventional-commits'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, HashMap, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Analysis } from '../analyzer/models/analysis.js'
import { Impact } from '../analyzer/models/impact.js'
import { ReleaseCommit } from '../analyzer/models/commit.js'
import { candidate } from './candidate.js'
import { analyzeRequested, detect } from './cascade.js'
import { ephemeral } from './ephemeral.js'
import { Official } from './models/item-official.js'
import { OfficialIncrement } from '../version/models/official-increment.js'

const repoRoot = Fs.Path.AbsDir.fromString('/repo/')

const makePackage = (scope: string, name = `@kitz/${scope}`) => ({
  scope,
  name: Pkg.Moniker.parse(name),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const makePackageJson = (
  name: string,
  version: string,
  dependencies?: Record<string, string>,
) =>
  JSON.stringify(
    {
      name,
      version,
      ...(dependencies ? { dependencies } : {}),
    },
    null,
    2,
  )

const makeCommit = (hash: string, scope: string, type: 'feat' | 'fix' = 'feat') =>
  ReleaseCommit.make({
    hash: Git.Sha.make(hash),
    author: Git.Author.make({ name: 'Release Bot', email: 'bot@example.com' }),
    date: new Date('2024-01-01T00:00:00.000Z'),
    message: ConventionalCommits.Commit.Single.make({
      type: ConventionalCommits.Type.Standard.parse(type),
      scopes: [scope],
      breaking: false,
      message: `${scope} change`,
      body: Option.none(),
      footers: [],
    }),
  })

const makeImpact = (
  scope: string,
  bump: 'major' | 'minor' | 'patch',
  currentVersion: string | null,
) =>
  Impact.make({
    package: makePackage(scope),
    bump,
    commits: [makeCommit('abc1234', scope, bump === 'patch' ? 'fix' : 'feat')],
    currentVersion: currentVersion ? Option.some(Semver.fromString(currentVersion)) : Option.none(),
  })

const makeOfficialRelease = (
  scope: string,
  from: string,
  to: string,
  bump: 'major' | 'minor' | 'patch',
) =>
  Official.make({
    package: makePackage(scope),
    version: OfficialIncrement.make({
      from: Semver.fromString(from),
      to: Semver.fromString(to),
      bump,
    }),
    commits: [makeCommit('def5678', scope, bump === 'patch' ? 'fix' : 'feat')],
  })

describe('planner coverage helpers', () => {
  test('plans candidate cascade releases with the next prerelease iteration', async () => {
    const packages = [makePackage('core'), makePackage('cli')]
    const analysis = Analysis.make({
      impacts: [makeImpact('core', 'minor', '1.0.0')],
      cascades: [],
      unchanged: [],
      tags: ['@kitz/cli@1.0.0', '@kitz/cli@1.0.1-next.2'],
    })

    const layer = Layer.mergeAll(
      Fs.Memory.layer({
        '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0', {
          '@kitz/core': 'workspace:*',
        }),
      }),
      Env.Test({ cwd: repoRoot }),
    )

    const plan = await Effect.runPromise(Effect.provide(candidate(analysis, { packages }), layer))

    expect(plan.releases).toHaveLength(1)
    expect(plan.releases[0]!.nextVersion.toString()).toBe('1.1.0-next.1')
    expect(plan.cascades).toHaveLength(1)
    expect(plan.cascades[0]!.package.name.moniker).toBe('@kitz/cli')
    expect(plan.cascades[0]!.nextVersion.toString()).toBe('1.0.1-next.3')
  })

  test('plans ephemeral cascade releases with the next prerelease iteration', async () => {
    const packages = [makePackage('core'), makePackage('cli')]
    const analysis = Analysis.make({
      impacts: [makeImpact('core', 'minor', '1.0.0')],
      cascades: [],
      unchanged: [],
      tags: ['@kitz/cli@0.0.0-pr.42.2.deadbee'],
    })

    const layer = Layer.mergeAll(
      Git.Memory.make({
        tags: [],
        commits: [],
        headSha: Git.Sha.make('abc1234'),
      }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0', {
          '@kitz/core': 'workspace:*',
        }),
      }),
      Env.Test({ cwd: repoRoot }),
    )

    const plan = await Effect.runPromise(
      Effect.provide(ephemeral(analysis, { packages }, { prNumber: 42 }), layer),
    )

    expect(plan.releases).toHaveLength(1)
    expect(plan.releases[0]!.nextVersion.toString()).toBe('0.0.0-pr.42.1.abc1234')
    expect(plan.cascades).toHaveLength(1)
    expect(plan.cascades[0]!.package.name.moniker).toBe('@kitz/cli')
    expect(plan.cascades[0]!.nextVersion.toString()).toBe('0.0.0-pr.42.3.abc1234')
  })

  test('analyzes requested cascades by scope and reports missing packages', async () => {
    const packages = [makePackage('core'), makePackage('cli')]
    const releases = [makeOfficialRelease('core', '1.0.0', '1.1.0', 'minor')]

    const layer = Layer.mergeAll(
      Fs.Memory.layer({
        '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0', {
          '@kitz/core': 'workspace:*',
        }),
      }),
      Env.Test({ cwd: repoRoot }),
    )

    const results = await Effect.runPromise(
      Effect.provide(
        analyzeRequested(packages, releases, ['core', 'missing'], ['@kitz/cli@1.0.0']),
        layer,
      ),
    )

    expect(results).toHaveLength(2)
    expect(results[0]!.requestedPackage).toBe('core')
    expect(results[0]!.packageName).toBe('@kitz/core')
    expect(results[0]!.cascades.map((cascade) => cascade.package.name.moniker)).toEqual([
      '@kitz/cli',
    ])
    expect(results[1]).toEqual({
      requestedPackage: 'missing',
      packageName: null,
      cascades: [],
    })
  })

  test('uses generic cascade commits for transitive releases and ignores unknown packages', () => {
    const packages = [makePackage('core'), makePackage('utils'), makePackage('cli')]
    const releases = [makeOfficialRelease('core', '1.0.0', '1.1.0', 'minor')]
    const dependencyGraph = HashMap.fromIterable<string, readonly string[]>([
      ['@kitz/core', ['@kitz/utils', '@kitz/ghost']],
      ['@kitz/utils', ['@kitz/cli']],
    ])

    const cascades = detect(packages, releases, dependencyGraph, [])
    const names = cascades.map((cascade) => cascade.package.name.moniker).sort()
    const cliCascade = cascades.find((cascade) => cascade.package.name.moniker === '@kitz/cli')

    expect(names).toEqual(['@kitz/cli', '@kitz/utils'])
    expect(cliCascade?.nextVersion.toString()).toBe('0.0.1')
    expect(cliCascade?.commits[0]?.forScope('cli').description).toBe('Cascade release')
  })
})
