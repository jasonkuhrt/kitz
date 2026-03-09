import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { ReleasePlan } from '../services/__.js'
import { rule } from './plan-packages-runtime-targets-source-oriented.js'

const releasePlanLayer = ReleasePlan.make([
  {
    packageName: Pkg.Moniker.parse('@kitz/core'),
    packagePath: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
    version: Semver.fromString('1.0.1'),
  },
])

describe('plan.packages-runtime-targets-source-oriented', () => {
  test('violates when planned packages still point runtime targets at build output', async () => {
    const layer = Layer.mergeAll(
      Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': JSON.stringify(
          {
            name: '@kitz/core',
            version: '1.0.0',
            imports: {
              '#core': './build/_.js',
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
    expect(Violation.is(result) ? result.summary : undefined).toContain('Source-first')
  })

  test('passes when runtime targets stay source-oriented', async () => {
    const layer = Layer.mergeAll(
      Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
      Fs.Memory.layer({
        '/repo/packages/core/package.json': JSON.stringify(
          {
            name: '@kitz/core',
            version: '1.0.0',
            imports: {
              '#core': './src/_.ts',
            },
            exports: {
              '.': './src/_.ts',
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
