import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { ReleasePlan } from '../services/__.js'
import { rule } from './plan-packages-repository-match-canonical.js'

describe('plan.packages-repository-match-canonical', () => {
  test('violates when a planned package points at a different GitHub repo', async () => {
    const diskLayout: Fs.Memory.DiskLayout = {
      '/repo/packages/core/package.json': JSON.stringify(
        {
          name: '@kitz/core',
          version: '1.0.0',
          repository: {
            type: 'git',
            url: 'git+https://github.com/other-org/other-repo.git',
          },
        },
        null,
        2,
      ),
    }

    const layer = Layer.mergeAll(
      Env.Test({
        cwd: Fs.Path.AbsDir.fromString('/repo/'),
        vars: { GITHUB_REPOSITORY: 'jasonkuhrt/kitz' },
      }),
      Fs.Memory.layer(diskLayout),
      Git.Memory.make({}),
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
    expect(Violation.is(result) ? result.summary : undefined).toContain('jasonkuhrt/kitz')
  })
})
