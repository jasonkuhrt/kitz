import { Effect } from 'effect'
import { Pkg } from '@kitz/pkg'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, FixStep, GuideFix, Hint, Violation } from '../models/violation.js'
import { Environment, File } from '../models/violation-location.js'
import {
  type PlannedManifest,
  loadPlannedManifests,
  summarizePackages,
} from './package-manifest-shared.js'

interface Offender {
  readonly packageName: string
  readonly packageJsonPath: string
  readonly targets: readonly string[]
}

const findOffenders = (manifests: readonly PlannedManifest[]) =>
  manifests.flatMap((entry): readonly Offender[] => {
    const targets = [
      ...Pkg.Manifest.findBuildRuntimeTargets(entry.manifest.imports),
      ...Pkg.Manifest.findBuildRuntimeTargets(entry.manifest.exports),
    ]

    return targets.length === 0
      ? []
      : [
          {
            packageName: entry.packageName,
            packageJsonPath: entry.packageJsonPath,
            targets,
          },
        ]
  })

/** Verifies that planned package manifests remain source-oriented in the repo. */
export const rule = RuntimeRule.create({
  id: RuleId.make('plan.packages-runtime-targets-source-oriented'),
  description: 'planned package manifests keep runtime targets source-oriented in the repo',
  preventsDescriptions: [
    'stale publish-time manifest rewrites leaving package.json runtime entries pointed at build output',
    'local source-first development accidentally depending on prior build artifacts',
  ],
  preconditions: [Precondition.HasReleasePlan.make()],
  check: loadPlannedManifests.pipe(
    Effect.map((manifests) => {
      const offenders = findOffenders(manifests)
      if (offenders.length === 0) {
        return { metadata: { packageCount: manifests.length } }
      }

      const names = offenders.map((entry) => entry.packageName)
      const example = offenders[0]!
      const exampleTargets = example.targets.slice(0, 3).join(', ')

      return Violation.make({
        location:
          offenders.length === 1
            ? File.make({ path: example.packageJsonPath })
            : Environment.make({
                message:
                  `${String(offenders.length)} planned packages still point runtime entries at build output. ` +
                  `Example targets: ${exampleTargets}.`,
              }),
        summary:
          `Source-first development is currently broken because ${summarizePackages(names)} ` +
          `${names.length === 1 ? 'still points' : 'still point'} package runtime targets at build output.`,
        detail:
          'This repo expects local `imports` and `exports` runtime targets to stay on `./src/*.ts`, ' +
          'with publish temporarily rewriting them to `./build/*.js` and then restoring them. ' +
          'When this rule fails, the usual cause is an interrupted or failed publish cleanup.',
        fix: GuideFix.make({
          summary: 'Restore local runtime targets to source paths before the next release attempt.',
          steps: [
            FixStep.make({
              description:
                'Edit affected package.json files so runtime targets under `imports` and `exports` point back to `./src/*.ts`.',
            }),
            FixStep.make({
              description:
                'Leave `types` declarations pointing at declaration output; only restore runtime entries.',
            }),
            FixStep.make({
              description:
                'Re-run `release doctor --onlyRule plan.packages-runtime-targets-source-oriented` before retrying publish.',
            }),
          ],
          docs: [
            DocLink.make({
              label: 'Node package exports',
              url: 'https://nodejs.org/api/packages.html#exports',
            }),
          ],
        }),
        hints: [
          Hint.make({
            description:
              'If this appeared right after a failed publish, inspect the affected package manifests before attempting another release.',
          }),
        ],
      })
    }),
  ),
})
