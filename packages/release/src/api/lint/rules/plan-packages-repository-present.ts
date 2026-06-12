import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import { DocLink, Hint } from '../models/violation.js'
import { manifestRule, summarizePackages } from './package-manifest-shared.js'

/** Advises when planned packages do not declare repository metadata. */
export const rule = manifestRule({
  id: RuleId.make('plan.packages-repository-present'),
  description: 'planned packages declare repository metadata',
  defaults: RuleDefaults.make({ severity: 'warn' }),
  findOffenders: (manifests) => manifests.filter((entry) => !entry.manifest.repository),
  violation: ({ offenders, names }) => ({
    environmentMessage: `${String(offenders.length)} planned packages are missing repository metadata.`,
    summary: `Repository metadata is missing for ${summarizePackages(names)}.`,
    detail:
      'npm can publish without `repository`, but source links, provenance surfaces, and downstream tooling become weaker when packages do not point back to their canonical repo.',
    hints: [
      Hint.make({
        description: 'Add a `repository` field so npm and GitHub can link releases back to source.',
      }),
    ],
    docs: [
      DocLink.make({
        label: 'npm package.json repository field',
        url: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json',
      }),
    ],
  }),
})
