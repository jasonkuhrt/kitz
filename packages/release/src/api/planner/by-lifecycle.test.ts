import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Analysis, Impact, makeCascadeCommit } from '../analyzer/models/__.js'
import type { Package } from '../analyzer/workspace.js'
import { byLifecycle } from './by-lifecycle.js'

const corePackage: Package = {
  scope: 'core',
  name: Pkg.Moniker.parse('@kitz/core'),
  path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
}

const analysis = Analysis.make({
  impacts: [
    Impact.make({
      package: corePackage,
      bump: 'minor',
      commits: [makeCascadeCommit('core', 'feature')],
      currentVersion: Option.some(Semver.fromString('1.0.0')),
    }),
  ],
  cascades: [],
  unchanged: [],
  tags: ['@kitz/core@1.0.0'],
})

const ctx = { packages: [corePackage] }

const workspaceLayer = Fs.Memory.layer({
  '/repo/packages/core/package.json': JSON.stringify({
    name: '@kitz/core',
    version: '1.0.0',
  }),
})

describe('byLifecycle', () => {
  test('official routes to the official planner', async () => {
    const plan = await Effect.runPromise(
      byLifecycle.official(analysis, ctx).pipe(Effect.provide(workspaceLayer)),
    )
    expect(plan.lifecycle).toBe('official')
    expect(plan.releases[0]?.nextVersion.toString()).toBe('1.1.0')
  })

  test('candidate routes to the candidate planner', async () => {
    const plan = await Effect.runPromise(
      byLifecycle.candidate(analysis, ctx).pipe(Effect.provide(workspaceLayer)),
    )
    expect(plan.lifecycle).toBe('candidate')
    expect(plan.releases[0]?.nextVersion.toString()).toBe('1.1.0-next.1')
  })

  test('ephemeral routes to the ephemeral planner', async () => {
    const plan = await Effect.runPromise(
      byLifecycle
        .ephemeral(analysis, ctx, { prNumber: 42 })
        .pipe(
          Effect.provide(Env.Test()),
          Effect.provide(workspaceLayer),
          Effect.provide(Git.Memory.make({ headSha: Git.Sha.make('def5678') })),
        ),
    )
    expect(plan.lifecycle).toBe('ephemeral')
    expect(plan.releases[0]?.nextVersion.toString()).toBe('0.0.0-pr.42.1.gdef5678')
  })

  test('covers every lifecycle exactly', () => {
    expect(Object.keys(byLifecycle).toSorted()).toEqual(['candidate', 'ephemeral', 'official'])
  })
})
