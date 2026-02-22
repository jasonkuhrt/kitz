import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Effect, Option, Schema as S } from 'effect'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { GitHistory } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import * as Monotonic from '../ops/monotonic.js'

/**
 * Extract unique package names from version tags.
 *
 * Tags are expected to be in format: `packageName@version`
 */
const extractPackageNames = (tags: string[]): string[] => {
  const decodeExactPin = S.decodeUnknownOption(Pkg.Pin.Exact.FromString)
  const packageNames = new Set<string>()
  for (const tag of tags) {
    const pin = decodeExactPin(tag)
    if (Option.isSome(pin)) packageNames.add(pin.value.name.moniker)
  }
  return [...packageNames]
}

export const rule = RuntimeRule.create({
  id: RuleId.make('git.history.monotonic'),
  description: 'Versions increase with commit order (ancestry-based)',
  preconditions: [],
  check: Effect.gen(function*() {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const packageNames = extractPackageNames(tags)

    // Audit each package's version history
    for (const packageName of packageNames) {
      const result = yield* Monotonic.auditPackageHistory(packageName, tags)

      if (!result.valid && result.violations.length > 0) {
        const firstViolation = result.violations[0]!
        return Violation.make({
          location: GitHistory.make({ sha: firstViolation.later.sha }),
        })
      }
    }

    return undefined
  }),
})
