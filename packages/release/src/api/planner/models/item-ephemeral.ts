import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import * as Version from '../../version/__.js'
import { ItemBaseFields } from './item-official.js'

/**
 * An ephemeral release plan item for PR testing.
 * Version format: `0.0.0-pr.${prNumber}.${iteration}.g${sha}`
 */
export class Ephemeral extends S.TaggedClass<Ephemeral>()('Ephemeral', {
  ...ItemBaseFields,
  prerelease: Version.Ephemeral,
}) {
  static make = this.makeUnsafe
  static is = S.is(Ephemeral)
  static decode = S.decodeUnknownEffect(Ephemeral)
  static decodeSync = S.decodeUnknownSync(Ephemeral)
  static encode = S.encodeUnknownEffect(Ephemeral)
  static encodeSync = S.encodeUnknownSync(Ephemeral)
  static equivalence = S.toEquivalence(Ephemeral)
  static ordered = false as const

  get nextVersion(): Semver.Semver {
    return Version.Ephemeral.calculateVersion(
      this.prerelease.prNumber,
      this.prerelease.iteration,
      this.prerelease.sha,
    )
  }

  get currentVersion(): Option.Option<Semver.Semver> {
    return Option.none()
  }

  get bumpType(): undefined {
    return undefined
  }
}
