import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import * as Version from '../../version/__.js'
import { ItemBaseFields } from './item-official.js'

/**
 * An ephemeral release plan item for PR testing.
 * Version format: `0.0.0-pr.${prNumber}.${iteration}.${sha}`
 */
export class Ephemeral extends S.TaggedClass<Ephemeral>()('Ephemeral', {
  ...ItemBaseFields,
  prerelease: Version.Ephemeral,
}) {
  static is = S.is(Ephemeral)

  get nextVersion(): Semver.Semver {
    return Semver.withPre(Semver.zero, ['pr', this.prerelease.prNumber, this.prerelease.iteration, this.prerelease.sha])
  }

  get currentVersion(): Option.Option<Semver.Semver> {
    return Option.none()
  }

  get bumpType(): undefined {
    return undefined
  }
}
