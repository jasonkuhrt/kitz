import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fs } from '@kitz/fs'
import { make, ReleasePlanService } from './release-plan.js'

describe('ReleasePlan service', () => {
  test('make with empty releases', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* ReleasePlanService
      }).pipe(Effect.provide(make([]))),
    )
    expect(result.releases).toHaveLength(0)
  })

  test('make with releases', async () => {
    const releases = [
      {
        packageName: Pkg.Moniker.parse('@kitz/core'),
        packagePath: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
        version: Semver.fromString('1.0.0'),
      },
      {
        packageName: Pkg.Moniker.parse('@kitz/cli'),
        packagePath: Fs.Path.AbsDir.fromString('/repo/packages/cli/'),
        version: Semver.fromString('2.0.0'),
      },
    ]
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* ReleasePlanService
      }).pipe(Effect.provide(make(releases))),
    )
    expect(result.releases).toHaveLength(2)
    expect(result.releases[0]!.packageName.moniker).toBe('@kitz/core')
    expect(result.releases[0]!.packagePath.toString()).toContain('/repo/packages/core/')
  })
})
