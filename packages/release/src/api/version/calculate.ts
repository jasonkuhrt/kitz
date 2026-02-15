import { Semver } from '@kitz/semver'
import { Option } from 'effect'

/**
 * Calculate the next version given a current version and bump type.
 *
 * Applies phase-aware bump mapping:
 * - Initial phase (0.x.x): major/minor -> minor, patch -> patch
 * - Public phase (1.x.x+): standard semver semantics
 */
export const calculateNextVersion = (
  current: Option.Option<Semver.Semver>,
  bump: Semver.BumpType,
): Semver.Semver =>
  Option.match(current, {
    onNone: () => {
      // First release - ALWAYS start in initial phase (0.x.x)
      switch (bump) {
        case 'major':
        case 'minor':
          return Semver.make(0, 1, 0)
        case 'patch':
          return Semver.make(0, 0, 1)
      }
    },
    onSome: (version) => {
      // Apply phase-aware bump mapping
      const effectiveBump = Semver.mapBumpForPhase(version, bump)
      return Semver.increment(version, effectiveBump)
    },
  })
