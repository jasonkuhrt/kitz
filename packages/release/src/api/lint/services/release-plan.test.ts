import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { make, ReleasePlanService } from './release-plan.js'

describe('ReleasePlan service', () => {
  test('make with empty releases', async () => {
    const result = await Effect.runPromise(ReleasePlanService.pipe(Effect.provide(make([]))))
    expect(result.releases).toHaveLength(0)
  })

  test('make with releases', async () => {
    const releases = [
      {
        packageName: Pkg.Moniker.parse('@kitz/core'),
        version: Semver.fromString('1.0.0'),
      },
      {
        packageName: Pkg.Moniker.parse('@kitz/cli'),
        version: Semver.fromString('2.0.0'),
      },
    ]
    const result = await Effect.runPromise(ReleasePlanService.pipe(Effect.provide(make(releases))))
    expect(result.releases).toHaveLength(2)
    expect(result.releases[0]!.packageName.moniker).toBe('@kitz/core')
  })
})
