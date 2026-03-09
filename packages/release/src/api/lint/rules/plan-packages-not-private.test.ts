import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { ReleasePlan } from '../services/__.js'
import { rule } from './plan-packages-not-private.js'

describe('plan.packages-not-private', () => {
  test('violates when a planned package is marked private', async () => {
    const diskLayout: Fs.Memory.DiskLayout = {
      '/repo/packages/core/package.json': JSON.stringify(
        {
          name: '@kitz/core',
          version: '1.0.0',
          private: true,
        },
        null,
        2,
      ),
    }

    const layer = Layer.mergeAll(
      Fs.Memory.layer(diskLayout),
      ReleasePlan.make([
        {
          packageName: Pkg.Moniker.parse('@kitz/core'),
          packagePath: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
          version: Semver.fromString('1.0.1'),
        },
      ]),
    )

    const result = await Effect.runPromise(rule.check.pipe(Effect.provide(layer)))

    expect(Violation.is(result)).toBe(true)
    expect(Violation.is(result) ? result.summary : undefined).toContain('@kitz/core')
  })
})
