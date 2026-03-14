import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Semver } from '@kitz/semver'
import { Effect, Schema } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment, File } from '../models/violation-location.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { ReleasePlanService } from '../services/release-plan.js'
import { summarizePackages } from './package-manifest-shared.js'

const OptionsSchema = Schema.Struct({
  registry: Schema.optional(Schema.String),
})
type Options = typeof OptionsSchema.Type

interface Metadata {
  readonly packageCount: number
}

/** Verifies that planned package versions are not already published to npm. */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('plan.versions-unpublished'),
  description: 'planned package versions are not already published to npm',
  preventsDescriptions: [
    'npm publish failing because the exact version is already present in the registry',
  ],
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [new Precondition.HasReleasePlan()],
  optionsSchema: OptionsSchema,
  check: Effect.gen(function* () {
    const plan = yield* ReleasePlanService
    const options = (yield* RuleOptionsService) as Options

    const conflicts = yield* Effect.forEach(
      plan.releases,
      (release) =>
        NpmRegistry.Cli.hasVersion(
          release.packageName.moniker,
          Semver.toString(release.version),
          options.registry ? { registry: options.registry } : undefined,
        ).pipe(
          Effect.map((exists) =>
            exists
              ? {
                  packageName: release.packageName.moniker,
                  packageJsonPath: `${Fs.Path.toString(release.packagePath)}package.json`,
                  version: Semver.toString(release.version),
                }
              : null,
          ),
        ),
      { concurrency: 8 },
    ).pipe(Effect.map((results) => results.filter((entry) => entry !== null)))

    if (conflicts.length === 0) {
      return { metadata: { packageCount: plan.releases.length } satisfies Metadata }
    }

    const names = conflicts.map((entry) => `${entry.packageName}@${entry.version}`)
    const example = conflicts[0]!

    return Violation.make({
      location:
        conflicts.length === 1
          ? File.make({ path: example.packageJsonPath })
          : Environment.make({
              message: `${String(conflicts.length)} planned package versions already exist on npm.`,
            }),
      summary: `Publishing would collide because ${summarizePackages(names)} ${names.length === 1 ? 'already exists' : 'already exist'} on npm.`,
      detail:
        'npm does not allow the same package version to be published twice. ' +
        'If a planned version already exists, the release plan is stale or a prior publish attempt already succeeded.',
      hints: [
        Hint.make({
          description:
            'Regenerate the release plan after fetching the latest tags and published versions.',
        }),
        Hint.make({
          description:
            'If a prior publish partially succeeded, inspect the published version and bump forward instead of retrying the same version.',
        }),
      ],
      docs: [
        DocLink.make({
          label: 'npm publish',
          url: 'https://docs.npmjs.com/cli/v11/commands/npm-publish',
        }),
      ],
    })
  }),
})
