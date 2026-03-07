import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Effect } from 'effect'
import { ReleasePlanService } from '../services/release-plan.js'

export interface PlannedManifest {
  readonly packageName: string
  readonly packageJsonPath: string
  readonly manifest: Pkg.Manifest.Manifest
}

export const loadPlannedManifests = Effect.gen(function* () {
  const plan = yield* ReleasePlanService
  return yield* Effect.forEach(plan.releases, (release) =>
    Pkg.Manifest.resource.readOrEmpty(release.packagePath).pipe(
      Effect.map((manifest) => ({
        packageName: release.packageName.moniker,
        packageJsonPath: `${Fs.Path.toString(release.packagePath)}package.json`,
        manifest,
      })),
    ),
  )
})

export const summarizePackages = (names: readonly string[]): string => {
  if (names.length <= 3) return names.join(', ')
  const head = names.slice(0, 3).join(', ')
  return `${head}, +${String(names.length - 3)} more`
}
