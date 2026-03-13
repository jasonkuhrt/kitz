import { Effect } from 'effect'
import { Pkg } from '@kitz/pkg'
import * as Severity from '../models/severity.js'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { Hint, Violation } from '../models/violation.js'
import { Environment, File } from '../models/violation-location.js'
import {
  type PlannedManifest,
  loadPlannedManifests,
  summarizePackages,
} from './package-manifest-shared.js'

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
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('plan.packages-publish-hooks-present'),
  description: 'planned packages do not define opaque npm pack hooks',
  preventsDescriptions: [
    'surprising artifact-preparation side effects that release cannot semantically inspect',
  ],
  defaults: new RuleDefaults({ severity: new Severity.Warn() }),
  preconditions: [new Precondition.HasReleasePlan()],
  check: loadPlannedManifests.pipe(
    Effect.map((manifests) => {
      const offenders = findPublishHooks(manifests)
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
                message:
                  `${String(offenders.length)} planned packages define pack hooks. ` +
                  `Example hooks: ${example.hooks.join(', ')}.`,
              }),
        summary:
          `Release detected npm pack hooks on ${summarizePackages(names)}, ` +
          'and those scripts will run while release prepares tarballs.',
        detail:
          'Release prepares tarballs before any network publish begins, so these hooks run in the artifact-preparation phase. ' +
          'That is safer than publish-time hooks, but release still cannot semantically inspect what the scripts mutate locally.',
        hints: [
          new Hint({
            description:
              'If artifact preparation or cleanup fails, inspect package.json files before retrying publish.',
          }),
          new Hint({
            description:
              'Keep pack hooks minimal and deterministic so their side effects are obvious to operators.',
          }),
        ],
      })
    }),
  ),
})
