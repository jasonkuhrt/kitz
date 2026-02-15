import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import { PreviewPrerelease } from '../../analyzer/prerelease.js'
import { ItemBaseFields } from './item-stable.js'

/**
 * A preview (canary) release plan item.
 * Version format: `${baseVersion}-next.${iteration}`
 */
export class Preview extends S.Class<Preview>('Preview')({
  ...ItemBaseFields,
  baseVersion: Semver.Semver,
  prerelease: PreviewPrerelease,
}) {
  static is = S.is(Preview)

  get nextVersion(): Semver.Semver {
    return Semver.withPre(this.baseVersion, ['next', this.prerelease.iteration])
  }

  get currentVersion(): Option.Option<Semver.Semver> {
    return Option.some(this.baseVersion)
  }

  get bumpType(): undefined {
    return undefined
  }
}
