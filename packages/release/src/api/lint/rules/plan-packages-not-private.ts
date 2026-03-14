import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment, File } from '../models/violation-location.js'
import { loadPlannedManifests, summarizePackages } from './package-manifest-shared.js'

/** Verifies that planned releases are not blocked by `private: true`. */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('plan.packages-not-private'),
  description: 'planned packages are not marked private',
  preconditions: [new Precondition.HasReleasePlan()],
  check: loadPlannedManifests.pipe(
    Effect.map((manifests) => {
      const offenders = manifests.filter((entry) => entry.manifest.private === true)
      if (offenders.length === 0) {
        return { metadata: { packageCount: manifests.length } }
      }

      const names = offenders.map((entry) => entry.packageName)
      const example = offenders[0]!

      return Violation.make({
        location:
          offenders.length === 1
            ? File.make({ path: example.packageJsonPath })
            : Environment.make({
                message: `${String(offenders.length)} planned packages are marked private.`,
              }),
        summary: `Publishing is blocked because ${summarizePackages(names)} ${names.length === 1 ? 'is' : 'are'} marked \`private: true\`.`,
        detail:
          'npm refuses to publish packages whose package.json sets `private: true`. ' +
          'This commonly happens for new workspace packages that were bootstrapped as private and never flipped for publishing.',
        hints: [
          Hint.make({
            description:
              'Remove `private: true` from package manifests that are meant to be published.',
          }),
          Hint.make({
            description:
              'Keep the workspace root private if needed, but do not leave publishable leaf packages marked private.',
          }),
        ],
        docs: [
          DocLink.make({
            label: 'npm package.json fields',
            url: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json',
          }),
        ],
      })
    }),
  ),
})
