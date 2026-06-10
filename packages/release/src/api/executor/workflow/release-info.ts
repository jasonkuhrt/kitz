import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import type { ReleaseInfo } from '../publish.js'
import type { ReleasePayloadType } from './payload.js'

export type ReleasePayloadEntry = ReleasePayloadType['releases'][number]

export const formatTag = (name: Pkg.Moniker.Moniker, version: Semver.Semver): string =>
  Pkg.Pin.toString(Pkg.Pin.Exact.make({ name, version }))

export const toReleaseInfo = (release: ReleasePayloadEntry): ReleaseInfo => ({
  package: {
    name: Pkg.Moniker.parse(release.packageName),
    path: Fs.Path.AbsDir.fromString(release.packagePath),
    scope: release.packageName.startsWith('@')
      ? release.packageName.split('/')[1]!
      : release.packageName,
  },
  nextVersion: Semver.fromString(release.nextVersion),
})

export const tagForRelease = (release: ReleasePayloadEntry): string =>
  formatTag(Pkg.Moniker.parse(release.packageName), Semver.fromString(release.nextVersion))
