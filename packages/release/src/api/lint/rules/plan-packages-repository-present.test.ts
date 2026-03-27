import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { ReleasePlan } from '../services/__.js'
import { rule } from './plan-packages-repository-present.js'

const makePlannedRelease = (scope: string) => ({
  packageName: Pkg.Moniker.parse(`@kitz/${scope}`),
  packagePath: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
  version: Semver.fromString('1.0.0'),
})

describe('plan.packages-repository-present', () => {
  test('returns package-count metadata when all planned manifests declare repository info', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(ReleasePlan.make([makePlannedRelease('core')])),
        Effect.provide(
          Fs.Memory.layer({
            '/repo/packages/core/package.json': JSON.stringify({
              name: '@kitz/core',
              version: '1.0.0',
              repository: {
                type: 'git',
                url: 'git+https://github.com/jasonkuhrt/kitz.git',
              },
            }),
          }),
        ),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected pass metadata')
    }

    expect(result.metadata).toEqual({ packageCount: 1 })
  })

  test('reports environment-level violations when multiple planned packages are missing repository metadata', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(ReleasePlan.make([makePlannedRelease('core'), makePlannedRelease('cli')])),
        Effect.provide(
          Fs.Memory.layer({
            '/repo/packages/core/package.json': JSON.stringify({
              name: '@kitz/core',
              version: '1.0.0',
            }),
            '/repo/packages/cli/package.json': JSON.stringify({
              name: '@kitz/cli',
              version: '1.0.0',
            }),
          }),
        ),
      ),
    )

    expect(Violation.is(result)).toBe(true)
    if (!Violation.is(result)) {
      throw new Error('expected a violation')
    }

    expect(result.summary).toContain('@kitz/core, @kitz/cli')
    expect(result.location._tag).toBe('ViolationLocationEnvironment')
  })
})
