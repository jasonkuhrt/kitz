import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { ReleasePlan } from '../services/__.js'
import { rule } from './plan-packages-publish-hooks-present.js'

const releasePlanLayer = ReleasePlan.make([
  {
    packageName: Pkg.Moniker.parse('@kitz/core'),
    packagePath: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
    version: Semver.fromString('1.0.1'),
  },
])

describe('plan.packages-publish-hooks-present', () => {
  test.each([
    [{ prepack: 'tsgo -p tsconfig.build.json' }],
    [{ prepare: 'tsgo -p tsconfig.build.json' }],
    [{ postpack: 'echo done' }],
    [{ prepack: 'tsgo -p tsconfig.build.json', postpack: 'echo done' }],
  ])('warns when planned packages define pack-time npm hooks: %j', async (scripts) => {
    const layer = Layer.mergeAll(
      Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': JSON.stringify(
          {
            name: '@kitz/core',
            version: '1.0.0',
            scripts: {
              ...scripts,
              publish: 'echo publish',
            },
          },
          null,
          2,
        ),
      }),
      releasePlanLayer,
    )

    const result = await Effect.runPromise(rule.check.pipe(Effect.provide(layer)))

    expect(Violation.is(result)).toBe(true)
    expect(Violation.is(result) ? result.summary : undefined).toContain('tarballs')
    expect(Violation.is(result) ? result.detail : undefined).toContain('artifact-preparation phase')
  })

  test('passes when no publish hooks are present', async () => {
    const layer = Layer.mergeAll(
      Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': JSON.stringify(
          {
            name: '@kitz/core',
            version: '1.0.0',
            scripts: {
              build: 'tsgo -p tsconfig.build.json',
            },
          },
          null,
          2,
        ),
      }),
      releasePlanLayer,
    )

    const result = await Effect.runPromise(rule.check.pipe(Effect.provide(layer)))

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected rule metadata')
    }

    expect(result.metadata).toEqual({ packageCount: 1 })
  })
})
