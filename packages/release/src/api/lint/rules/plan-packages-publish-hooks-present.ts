import { Effect } from 'effect'
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

const publishHookNames = [
  'prepack',
  'postpack',
  'prepublish',
  'prepublishOnly',
  'publish',
  'postpublish',
] as const

interface Offender {
  readonly packageName: string
  readonly packageJsonPath: string
  readonly hooks: readonly string[]
}

const findPublishHooks = (manifests: readonly PlannedManifest[]): readonly Offender[] =>
  manifests.flatMap((entry) => {
    const scripts = entry.manifest.scripts ?? {}
    const hooks = publishHookNames.filter((name) => name in scripts)

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
  id: RuleId.make('plan.packages-publish-hooks-present'),
  description: 'planned packages do not define opaque npm publish hooks',
  preventsDescriptions: [
    'surprising publish-time side effects that release cannot semantically inspect',
  ],
  defaults: RuleDefaults.make({ severity: Severity.Warn.make() }),
  preconditions: [Precondition.HasReleasePlan.make()],
  check: loadPlannedManifests.pipe(
    Effect.map((manifests) => {
      const offenders = findPublishHooks(manifests)
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
                message:
                  `${String(offenders.length)} planned packages define publish hooks. ` +
                  `Example hooks: ${example.hooks.join(', ')}.`,
              }),
        summary:
          `Release detected npm publish hooks on ${summarizePackages(names)}, ` +
          'but those scripts are opaque shell commands to the release engine.',
        detail:
          'Release can detect that publish-time scripts exist, but it cannot prove what they mutate ' +
          'or whether an interrupted publish left additional cleanup behind. Review these hooks before a manual release.',
        hints: [
          Hint.make({
            description:
              'If a publish fails, re-run doctor immediately and inspect package.json files before retrying.',
          }),
          Hint.make({
            description:
              'Keep publish hooks minimal and deterministic so their side effects are obvious to operators.',
          }),
        ],
      })
    }),
  ),
})
