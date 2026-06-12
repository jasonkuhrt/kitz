import { RuleId } from '../models/rule-defaults.js'
import { DocLink, Hint } from '../models/violation.js'
import { manifestRule, summarizePackages } from './package-manifest-shared.js'

/** Verifies that planned releases are not blocked by `private: true`. */
export const rule = manifestRule({
  id: RuleId.make('plan.packages-not-private'),
  description: 'planned packages are not marked private',
  findOffenders: (manifests) => manifests.filter((entry) => entry.manifest.private === true),
  violation: ({ offenders, names }) => ({
    environmentMessage: `${String(offenders.length)} planned packages are marked private.`,
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
  }),
})
