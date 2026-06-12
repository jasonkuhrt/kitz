import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { calculateNextVersion } from '../calculate.js'
import { OfficialFirst } from './official-first.js'
import { OfficialIncrement } from './official-increment.js'

/**
 * A version for an official release is either the first release or an increment.
 */
export type Official = OfficialFirst | OfficialIncrement

export const Official = {
  /**
   * Build the official version union from the current version baseline.
   *
   * `None` (no prior release) yields an {@link OfficialFirst}; `Some` yields an
   * {@link OfficialIncrement}. The next version is derived from the bump via
   * the phase-aware {@link calculateNextVersion}.
   */
  fromCurrent: (current: Option.Option<Semver.Semver>, bump: Semver.BumpType): Official => {
    const next = calculateNextVersion(current, bump)
    return Option.isSome(current)
      ? OfficialIncrement.make({ from: current.value, to: next, bump })
      : OfficialFirst.make({ version: next, bump })
  },
}
