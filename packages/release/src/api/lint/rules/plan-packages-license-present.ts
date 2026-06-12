import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import { DocLink, Hint } from '../models/violation.js'
import { manifestRule, summarizePackages } from './package-manifest-shared.js'

/** Advises when planned packages do not declare a license. */
export const rule = manifestRule({
  id: RuleId.make('plan.packages-license-present'),
  description: 'planned packages declare a license',
  defaults: RuleDefaults.make({ severity: 'warn' }),
  findOffenders: (manifests) => manifests.filter((entry) => !entry.manifest.license),
  violation: ({ offenders, names }) => ({
    environmentMessage: `${String(offenders.length)} planned packages are missing a license field.`,
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
  }),
})
