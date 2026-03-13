import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import * as Severity from '../models/severity.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment, File } from '../models/violation-location.js'
import { loadPlannedManifests, summarizePackages } from './package-manifest-shared.js'

/** Advises when planned packages do not declare repository metadata. */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('plan.packages-repository-present'),
  description: 'planned packages declare repository metadata',
  defaults: new RuleDefaults({ severity: new Severity.Warn() }),
  preconditions: [new Precondition.HasReleasePlan()],
  check: loadPlannedManifests.pipe(
    Effect.map((manifests) => {
      const offenders = manifests.filter((entry) => !entry.manifest.repository)
      if (offenders.length === 0) {
        return { metadata: { packageCount: manifests.length } }
      }

      const names = offenders.map((entry) => entry.packageName)
      const example = offenders[0]!

      return new Violation({
        location:
          offenders.length === 1
            ? new File({ path: example.packageJsonPath })
            : new Environment({
                message: `${String(offenders.length)} planned packages are missing repository metadata.`,
              }),
        summary: `Repository metadata is missing for ${summarizePackages(names)}.`,
        detail:
          'npm can publish without `repository`, but source links, provenance surfaces, and downstream tooling become weaker when packages do not point back to their canonical repo.',
        hints: [
          new Hint({
            description:
              'Add a `repository` field so npm and GitHub can link releases back to source.',
          }),
        ],
        docs: [
          new DocLink({
            label: 'npm package.json repository field',
            url: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json',
          }),
        ],
      })
    }),
  ),
})
