import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import { calculateNextVersion } from '../calculate.js'
import type { OfficialFirst } from './official-first.js'

/**
 * Increment from an existing version.
 */
export class OfficialIncrement extends S.TaggedClass<OfficialIncrement>()('OfficialIncrement', {
  from: Semver.Semver,
  to: Semver.Semver,
  bump: Semver.BumpType,
}) {
  static is = S.is(OfficialIncrement)

  static fromImpact(current: Semver.Semver, bump: Semver.BumpType): OfficialIncrement {
    return OfficialIncrement.make({
      from: current,
      to: calculateNextVersion(Option.some(current), bump),
      bump,
    })
  }
}

/**
 * A version for an official release is either the first release or an increment.
 */
export type Official = OfficialFirst | OfficialIncrement
