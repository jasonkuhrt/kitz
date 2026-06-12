import { Git } from '@kitz/git'
import { Effect } from 'effect'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { GitHistory } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import * as Monotonic from '../ops/monotonic.js'

/** Audits that version tags increase monotonically with commit ancestry. */
export const rule = RuntimeRule.create({
  id: RuleId.make('git.history.monotonic'),
  description: 'Versions increase with commit order (ancestry-based)',
  preconditions: [],
  check: () =>
    Effect.gen(function* () {
      const git = yield* Git.Git
      const tags = yield* git.getTags()

      // Parse every tag once, grouped by package
      const releaseTagsByPackage = Monotonic.groupReleaseTagsByPackage(tags)

      // Audit each package's version history
      for (const [packageName, parsedTags] of releaseTagsByPackage) {
        const tagInfos = yield* Monotonic.resolveTagShas(parsedTags)
        const result = yield* Monotonic.auditPackageHistory(packageName, tagInfos)

        if (!result.valid && result.violations.length > 0) {
          const firstViolation = result.violations[0]!
          return Violation.make({
            location: GitHistory.make({ sha: firstViolation.later.sha }),
            summary: `Version history for ${packageName} is not monotonic (${String(result.violations.length)} violation${result.violations.length === 1 ? '' : 's'}).`,
            detail: result.violations.map((violation) => violation.message).join('; '),
          })
        }
      }

      return undefined
    }),
})
