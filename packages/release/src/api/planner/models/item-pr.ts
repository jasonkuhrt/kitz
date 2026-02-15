import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import { PrPrerelease } from '../../analyzer/prerelease.js'
import { ItemBaseFields } from './item-stable.js'

/**
 * A PR-specific release plan item for testing.
 * Version format: `0.0.0-pr.${prNumber}.${iteration}.${sha}`
 */
export class Pr extends S.Class<Pr>('Pr')({
  ...ItemBaseFields,
  prerelease: PrPrerelease,
}) {
  static is = S.is(Pr)

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
