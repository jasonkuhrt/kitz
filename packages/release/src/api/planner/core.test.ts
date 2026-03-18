import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, HashMap, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Env } from '@kitz/env'
import { Analysis, Impact, makeCascadeCommit } from '../analyzer/models/__.js'
import type { Package } from '../analyzer/workspace.js'
import { OfficialFirst } from '../version/models/official-first.js'
import { candidate } from './candidate.js'
import { Official } from './models/item-official.js'
import { Candidate } from './models/item-candidate.js'
import { Ephemeral } from './models/item-ephemeral.js'
import { ephemeral } from './ephemeral.js'
import { planLifecycle } from './core.js'

const packages: readonly Package[] = [
  {
    scope: 'core',
    name: Pkg.Moniker.parse('@kitz/core'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
  },
  {
    scope: 'cli',
    name: Pkg.Moniker.parse('@kitz/cli'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/cli/'),
  },
]

const analysis = Analysis.make({
  impacts: [
    Impact.make({
      package: packages[0]!,
      bump: 'minor',
      commits: [makeCascadeCommit('core', 'feature')],
      currentVersion: Option.some(Semver.fromString('1.0.0')),
    }),
    Impact.make({
      package: packages[1]!,
      bump: 'patch',
      commits: [makeCascadeCommit('cli', 'fix')],
      currentVersion: Option.some(Semver.fromString('2.0.0')),
    }),
  ],
  cascades: [],
  unchanged: [],
  tags: ['@kitz/core@1.0.0'],
})

const singleImpactAnalysis = Analysis.make({
  impacts: [analysis.impacts[0]!],
  cascades: [],
  unchanged: [packages[1]!],
  tags: ['@kitz/core@1.0.0'],
})

const workspaceLayer = Fs.Memory.layer({
  '/repo/packages/core/package.json': JSON.stringify({
    name: '@kitz/core',
    version: '1.0.0',
  }),
  '/repo/packages/cli/package.json': JSON.stringify({
    name: '@kitz/cli',
    version: '2.0.0',
    dependencies: {
      '@kitz/core': 'workspace:*',
    },
  }),
})

const assertCandidateItems = (_items: readonly Candidate[]): void => undefined
const assertEphemeralItems = (_items: readonly Ephemeral[]): void => undefined

describe('planner core', () => {
  test('shares the filtered planning flow and dependency graph build across lifecycles', async () => {
    const observedPrimaryPackages: string[] = []

    const result = await Effect.runPromise(
      planLifecycle({
        analysis,
        packages,
        lifecycle: 'official',
        options: {
          packages: ['@kitz/core'],
        },
        toPrimaryRelease: (impact) => {
          observedPrimaryPackages.push(impact.package.name.moniker)

          return Official.make({
            package: impact.package,
            version: OfficialFirst.make({
              version: Semver.fromString('9.9.9'),
            }),
            commits: impact.commits,
          })
        },
        toCascades: ({ primaryReleases, dependencyGraph, tags }) => {
          expect(primaryReleases.map((release) => release.package.name.moniker)).toEqual([
            '@kitz/core',
          ])
          expect(tags).toEqual(['@kitz/core@1.0.0'])
          expect(Option.getOrUndefined(HashMap.get(dependencyGraph, '@kitz/core'))).toEqual([
            '@kitz/cli',
          ])
          return []
        },
      }).pipe(Effect.provide(workspaceLayer)),
    )

    expect(observedPrimaryPackages).toEqual(['@kitz/core'])
    expect(result.lifecycle).toBe('official')
    expect(result.releases).toHaveLength(1)
    expect(result.cascades).toHaveLength(0)
  })

  test('candidate planning preserves candidate typing and remaps cascade iterations', async () => {
    const result = await Effect.runPromise(
      candidate(
        Analysis.make({
          ...singleImpactAnalysis,
          tags: ['@kitz/core@1.0.0', '@kitz/cli@2.0.0', '@kitz/cli@2.0.1-next.4'],
        }),
        { packages },
      ).pipe(Effect.provide(workspaceLayer)),
    )

    assertCandidateItems(result.releases)
    assertCandidateItems(result.cascades)
    expect(result.lifecycle).toBe('candidate')
    expect(result.releases[0]?.nextVersion.toString()).toBe('1.1.0-next.1')
    expect(result.cascades).toHaveLength(1)
    expect(result.cascades[0]?.package.name.moniker).toBe('@kitz/cli')
    expect(result.cascades[0]?.nextVersion.toString()).toBe('2.0.1-next.5')
    expect(result.cascades[0]?.prerelease.iteration).toBe(5)
  })

  test('ephemeral planning preserves ephemeral typing and remaps cascade iterations', async () => {
    const sha = Git.Sha.make('def5678')
    const result = await Effect.runPromise(
      ephemeral(
        Analysis.make({
          ...singleImpactAnalysis,
          tags: ['@kitz/core@1.0.0', '@kitz/cli@0.0.0-pr.42.3.gabc1234'],
        }),
        { packages },
        { prNumber: 42 },
      ).pipe(
        Effect.provide(Env.Test()),
        Effect.provide(workspaceLayer),
        Effect.provide(
          Git.Memory.make({
            headSha: sha,
          }),
        ),
      ),
    )

    assertEphemeralItems(result.releases)
    assertEphemeralItems(result.cascades)
    expect(result.lifecycle).toBe('ephemeral')
    expect(result.releases[0]?.nextVersion.toString()).toBe('0.0.0-pr.42.1.gdef5678')
    expect(result.cascades).toHaveLength(1)
    expect(result.cascades[0]?.package.name.moniker).toBe('@kitz/cli')
    expect(result.cascades[0]?.nextVersion.toString()).toBe('0.0.0-pr.42.4.gdef5678')
    expect(result.cascades[0]?.prerelease.iteration).toBe(4)
    expect(result.cascades[0]?.prerelease.sha).toBe(sha)
  })
})
