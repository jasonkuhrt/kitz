import { Semver } from '@kitz/semver'
import { Option } from 'effect'

/**
 * Calculate the next version given a current version and bump type.
 *
 * **Phase-aware bump mapping** prevents premature 1.0.0 releases:
 *
 * | Current Phase | Commit Impact | Effective Bump | Example               |
 * | ------------- | ------------- | -------------- | --------------------- |
 * | None (first)  | major/minor   | minor          | -> 0.1.0              |
 * | None (first)  | patch         | patch          | -> 0.0.1              |
 * | 0.x.x         | major         | minor          | 0.2.0 -> 0.3.0       |
 * | 0.x.x         | minor         | minor          | 0.2.0 -> 0.3.0       |
 * | 0.x.x         | patch         | patch          | 0.2.1 -> 0.2.2       |
 * | 1.x.x+        | major         | major          | 1.2.3 -> 2.0.0       |
 * | 1.x.x+        | minor         | minor          | 1.2.3 -> 1.3.0       |
 * | 1.x.x+        | patch         | patch          | 1.2.3 -> 1.2.4       |
 *
 * The mapping is delegated to `Semver.mapBumpForPhase()`.
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
