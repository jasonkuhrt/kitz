import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Analysis, Impact, makeCascadeCommit } from '../../api/analyzer/models/__.js'
import type { Package } from '../../api/analyzer/workspace.js'
import {
  computeLifecyclePlan,
  computeLifecyclePlanAttempt,
  toUnavailableLifecycleReport,
} from './doctor-lib.js'

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
  ],
  cascades: [],
  unchanged: [packages[1]!],
  tags: ['@kitz/core@1.0.0', '@kitz/cli@2.0.0'],
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

describe('doctor lifecycle planning helpers', () => {
  test('dispatches official lifecycle planning through the official planner', async () => {
    const result = await Effect.runPromise(
      computeLifecyclePlan(analysis, packages, 'official').pipe(
        Effect.provide(Layer.mergeAll(workspaceLayer, Env.Test(), Git.Memory.make())),
      ),
    )

    expect(result.lifecycle).toBe('official')
    expect(result.releases[0]?.nextVersion.toString()).toBe('1.1.0')
  })

  test('dispatches candidate lifecycle planning through the candidate planner', async () => {
    const result = await Effect.runPromise(
      computeLifecyclePlanAttempt(analysis, packages, 'candidate').pipe(
        Effect.provide(Layer.mergeAll(workspaceLayer, Env.Test(), Git.Memory.make())),
      ),
    )

    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(result.success.lifecycle).toBe('candidate')
      expect(result.success.releases[0]?.nextVersion.toString()).toBe('1.1.0-next.1')
    }
  })

  test('dispatches ephemeral lifecycle planning through the ephemeral planner', async () => {
    const result = await Effect.runPromise(
      computeLifecyclePlan(analysis, packages, 'ephemeral').pipe(
        Effect.provide(
          Layer.mergeAll(
            workspaceLayer,
            Env.Test({
              vars: {
                PR_NUMBER: '42',
              },
            }),
            Git.Memory.make({
              headSha: Git.Sha.make('abc1234'),
            }),
          ),
        ),
      ),
    )

    expect(result.lifecycle).toBe('ephemeral')
    expect(result.releases[0]?.nextVersion.toString()).toContain('0.0.0-pr.42.1.')
  })

  test('converts planner failures into unavailable lifecycle reports with the failure message', () => {
    const report = toUnavailableLifecycleReport('ephemeral', true, new Error('planner failed'))
    expect(report).toEqual({
      _tag: 'UnavailableLifecycleReport',
      lifecycle: 'ephemeral',
      required: true,
      reason: 'planner failed',
    })
  })

  test('normalizes non-Error planner failures into unavailable lifecycle reports', () => {
    const report = toUnavailableLifecycleReport('official', false, 'planner failed hard')

    expect(report.lifecycle).toBe('official')
    expect(report.required).toBe(false)
    expect(report.reason).toContain('planner failed hard')
  })
})
