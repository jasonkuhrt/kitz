import { Semver } from '@kitz/semver'
import { Option, Schema } from 'effect'
import { EphemeralSchema } from '../../version/models/ephemeral.js'
import type { ReleasePayloadType } from './payload.js'

export const resolvePayloadPrNumber = (payload: ReleasePayloadType): number | undefined => {
  if (payload.options.lifecycle !== 'ephemeral') return undefined

  for (const release of payload.releases) {
    const prerelease = Semver.getPrerelease(Semver.fromString(release.nextVersion))
    if (prerelease === undefined) continue

    const decoded = Schema.decodeUnknownOption(EphemeralSchema)(prerelease.join('.'))
    if (Option.isSome(decoded)) return decoded.value.prNumber
  }

  return undefined
}
