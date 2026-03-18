import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Env } from '@kitz/env'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Analysis, CascadeImpact, Impact, ReleaseCommit } from '../analyzer/models/__.js'
import type { Package } from '../analyzer/workspace.js'
import { tag } from '../executor/test-support.js'
import { FileSystemLayer } from '../../platform.js'
import { explain } from './explain.js'

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
  {
    scope: 'app',
    name: Pkg.Moniker.parse('@kitz/app'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/app/'),
  },
  {
    scope: 'docs',
    name: Pkg.Moniker.parse('@kitz/docs'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/docs/'),
  },
]

const makeCommit = (message: string) =>
  ReleaseCommit.make({
    hash: Git.Sha.make('abc1234'),
    author: Git.Author.make({ name: 'Jason', email: 'jason@example.com' }),
    date: new Date('2026-03-18T12:00:00Z'),
    message: ConventionalCommits.Commit.Single.make({
      type: ConventionalCommits.Type.parse('feat'),
      scopes: ['core'],
      breaking: false,
      message: message.replace(/^feat\(core\): /u, ''),
      body: Option.none(),
      footers: [],
    }),
  })

const analysis = Analysis.make({
  impacts: [
    Impact.make({
      package: packages[0]!,
      bump: 'minor',
      commits: [makeCommit('feat(core): add public explain surface')],
      currentVersion: Option.some(Semver.fromString('1.0.0')),
    }),
  ],
  cascades: [
    CascadeImpact.make({
      package: packages[1]!,
      currentVersion: Option.some(Semver.fromString('2.0.0')),
      triggeredBy: [packages[0]!],
    }),
    CascadeImpact.make({
      package: packages[2]!,
      currentVersion: Option.some(Semver.fromString('3.0.0')),
      triggeredBy: [],
    }),
  ],
  unchanged: [packages[3]!],
  tags: [
    tag(Pkg.Moniker.parse('@kitz/core'), '1.0.0'),
    tag(Pkg.Moniker.parse('@kitz/cli'), '2.0.0'),
    tag(Pkg.Moniker.parse('@kitz/app'), '3.0.0'),
    tag(Pkg.Moniker.parse('@kitz/docs'), '4.0.0'),
  ],
})

const layer = Layer.mergeAll(
  FileSystemLayer,
  Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
  Fs.Memory.layer({
    '/repo/packages/core/package.json': JSON.stringify({
      name: '@kitz/core',
      version: '1.0.0',
    }),
    '/repo/packages/cli/package.json': JSON.stringify({
      name: '@kitz/cli',
      version: '2.0.0',
      dependencies: {
        '@kitz/core': '^1.0.0',
      },
    }),
    '/repo/packages/app/package.json': JSON.stringify({
      name: '@kitz/app',
      version: '3.0.0',
      dependencies: {
        '@kitz/cli': '^2.0.0',
      },
    }),
    '/repo/packages/docs/package.json': JSON.stringify({
      name: '@kitz/docs',
      version: '4.0.0',
    }),
  }),
)

describe('planner explain', () => {
  test('explains a direct primary release', async () => {
    const result = await Effect.runPromise(
      explain(analysis, {
        packages,
        requestedPackage: 'core',
      }).pipe(Effect.provide(layer)),
    )

    expect(result.decision).toBe('primary')
    if (result.decision !== 'primary') {
      throw new Error('expected primary explanation')
    }

    expect(result.package.name).toBe('@kitz/core')
    expect(result.currentVersion).toBe('1.0.0')
    expect(result.nextOfficialVersion).toBe('1.1.0')
    expect(result.bump).toBe('minor')
    expect(result.commits).toHaveLength(1)
  })

  test('explains cascade releases with transitive dependency paths', async () => {
    const result = await Effect.runPromise(
      explain(analysis, {
        packages,
        requestedPackage: '@kitz/app',
      }).pipe(Effect.provide(layer)),
    )

    expect(result.decision).toBe('cascade')
    if (result.decision !== 'cascade') {
      throw new Error('expected cascade explanation')
    }

    expect(result.package.name).toBe('@kitz/app')
    expect(result.currentVersion).toBe('3.0.0')
    expect(result.nextOfficialVersion).toBe('3.0.1')
    expect(result.triggeredBy.map((pkg) => pkg.name)).toEqual(['@kitz/core'])
    expect(result.dependencyPaths).toEqual([
      {
        packages: [
          { name: '@kitz/core', scope: 'core', path: '/repo/packages/core/' },
          { name: '@kitz/cli', scope: 'cli', path: '/repo/packages/cli/' },
          { name: '@kitz/app', scope: 'app', path: '/repo/packages/app/' },
        ],
      },
    ])
  })

  test('explains unchanged packages with the current tagged version', async () => {
    const result = await Effect.runPromise(
      explain(analysis, {
        packages,
        requestedPackage: 'docs',
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toEqual({
      decision: 'unchanged',
      requestedPackage: 'docs',
      package: {
        name: '@kitz/docs',
        scope: 'docs',
        path: '/repo/packages/docs/',
      },
      currentVersion: '4.0.0',
      nextOfficialVersion: null,
    })
  })

  test('reports missing packages and available identifiers', async () => {
    const result = await Effect.runPromise(
      explain(analysis, {
        packages,
        requestedPackage: 'missing',
      }).pipe(Effect.provide(layer)),
    )

    expect(result.decision).toBe('missing')
    if (result.decision !== 'missing') {
      throw new Error('expected missing explanation')
    }

    expect(result.availablePackages).toEqual([
      '@kitz/app',
      '@kitz/cli',
      '@kitz/core',
      '@kitz/docs',
      'app',
      'cli',
      'core',
      'docs',
    ])
  })
})
