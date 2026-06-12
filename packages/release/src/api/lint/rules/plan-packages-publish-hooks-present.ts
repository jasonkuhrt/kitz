import { Pkg } from '@kitz/pkg'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import { Hint } from '../models/violation.js'
import { manifestRule, type PlannedManifest, summarizePackages } from './package-manifest-shared.js'

interface Offender {
  readonly packageName: string
  readonly packageJsonPath: string
  readonly hooks: readonly string[]
}

const findPublishHooks = (manifests: readonly PlannedManifest[]): readonly Offender[] =>
  manifests.flatMap((entry) => {
    const hooks = Pkg.Manifest.findPackHooks(entry.manifest.scripts)

    return hooks.length === 0
      ? []
      : [
          {
            packageName: entry.packageName,
            packageJsonPath: entry.packageJsonPath,
            hooks,
          },
        ]
  })

/** Warns when planned packages define opaque npm publish hooks. */
export const rule = manifestRule({
  id: RuleId.make('plan.packages-publish-hooks-present'),
  description: 'planned packages do not define opaque npm pack hooks',
  preventsDescriptions: [
    'surprising artifact-preparation side effects that release cannot semantically inspect',
  ],
  defaults: RuleDefaults.make({ severity: 'warn' }),
  findOffenders: findPublishHooks,
  violation: ({ offenders, names, example }) => ({
    environmentMessage:
      `${String(offenders.length)} planned packages define pack hooks. ` +
      `Example hooks: ${example.hooks.join(', ')}.`,
    summary:
      `Release detected npm pack hooks on ${summarizePackages(names)}, ` +
      'and those scripts will run while release prepares tarballs.',
    detail:
      'Release prepares tarballs before any network publish begins, so these hooks run in the artifact-preparation phase. ' +
      'That is safer than publish-time hooks, but release still cannot semantically inspect what the scripts mutate locally.',
    hints: [
      Hint.make({
        description:
          'If artifact preparation or cleanup fails, inspect package.json files before retrying publish.',
      }),
      Hint.make({
        description:
          'Keep pack hooks minimal and deterministic so their side effects are obvious to operators.',
      }),
    ],
  }),
})
