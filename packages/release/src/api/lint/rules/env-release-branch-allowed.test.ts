import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Violation } from '../models/violation.js'
import { ReleaseContext } from '../services/__.js'
import { ReleasePlan } from '../services/__.js'
import { rule } from './env-release-branch-allowed.js'

const withPlan = (layer: Layer.Layer<any>, releases: number) =>
  Layer.mergeAll(
    layer,
    ReleasePlan.make(
      Array.from({ length: releases }, (_, index) => ({
        packageName: Pkg.Moniker.parse(`@kitz/pkg-${String(index + 1)}`),
        packagePath: Fs.Path.AbsDir.fromString(`/repo/packages/pkg-${String(index + 1)}/`),
        version: Semver.fromString('1.0.0'),
      })),
    ),
  )

describe('env.release-branch-allowed', () => {
  test('violates when official release is evaluated off trunk', async () => {
    const layer = withPlan(
      ReleaseContext.make({
        lifecycle: 'official',
        trunk: 'main',
        currentBranch: 'feat/release',
      }),
      1,
    )

    const result = await Effect.runPromise(rule.check.pipe(Effect.provide(layer)))

    expect(Violation.is(result)).toBe(true)
    expect(Violation.is(result) ? result.summary : undefined).toContain('official releases')
  })

  test('allows candidate release on trunk and ephemeral off trunk', async () => {
    const candidateResult = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(
          withPlan(
            ReleaseContext.make({
              lifecycle: 'candidate',
              trunk: 'main',
              currentBranch: 'main',
            }),
            1,
          ),
        ),
      ),
    )

    const ephemeralResult = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(
          withPlan(
            ReleaseContext.make({
              lifecycle: 'ephemeral',
              trunk: 'main',
              currentBranch: 'feat/release',
            }),
            1,
          ),
        ),
      ),
    )

    expect(candidateResult).toBeUndefined()
    expect(ephemeralResult).toBeUndefined()
  })

  test('does not violate when no packages are planned', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(
          withPlan(
            ReleaseContext.make({
              lifecycle: 'official',
              trunk: 'main',
              currentBranch: 'feat/release',
            }),
            0,
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })
})
