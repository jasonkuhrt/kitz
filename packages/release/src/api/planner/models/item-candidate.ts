import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import * as Version from '../../version/__.js'
import { ItemBaseFields } from './item-official.js'

const SemverSchema = Semver.Semver

/**
 * A candidate release plan item.
 * Version format: `${baseVersion}-next.${iteration}`
 */
export class Candidate extends S.TaggedClass<Candidate>()('Candidate', {
  ...ItemBaseFields,
  baseVersion: SemverSchema,
  prerelease: Version.Candidate,
}) {
  static make = this.makeUnsafe
  static is = S.is(Candidate)
  static decode = S.decodeUnknownEffect(Candidate)
  static decodeSync = S.decodeUnknownSync(Candidate)
  static encode = S.encodeUnknownEffect(Candidate)
  static encodeSync = S.encodeUnknownSync(Candidate)
  static equivalence = S.toEquivalence(Candidate)
  static ordered = false as const

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
