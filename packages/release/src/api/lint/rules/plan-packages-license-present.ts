import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import * as Severity from '../models/severity.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment, File } from '../models/violation-location.js'
import { loadPlannedManifests, summarizePackages } from './package-manifest-shared.js'

/** Advises when planned packages do not declare a license. */
export const rule = RuntimeRule.create({
  id: RuleId.make('plan.packages-license-present'),
  description: 'planned packages declare a license',
  defaults: RuleDefaults.make({ severity: Severity.Warn.make() }),
  preconditions: [Precondition.HasReleasePlan.make()],
  check: loadPlannedManifests.pipe(
    Effect.map((manifests) => {
      const offenders = manifests.filter((entry) => !entry.manifest.license)
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
                message: `${String(offenders.length)} planned packages are missing a license field.`,
              }),
        summary: `License metadata is missing for ${summarizePackages(names)}.`,
        detail:
          'npm can still publish these packages, but consumers and provenance tooling expect license metadata to be present and accurate.',
        hints: [
          Hint.make({
            description: 'Add a `license` field to each publishable package manifest.',
          }),
        ],
        docs: [
          DocLink.make({
            label: 'npm package.json license field',
            url: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json',
          }),
        ],
      })
    }),
  ),
})
