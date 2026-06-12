import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Effect } from 'effect'
import type { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { type DocLink, type Hint, Violation, type ViolationFix } from '../models/violation.js'
import { Environment, File } from '../models/violation-location.js'
import { ReleasePlanService } from '../services/release-plan.js'

export interface PlannedManifest {
  readonly packageName: string
  readonly packageJsonPath: string
  readonly manifest: Pkg.Manifest.Manifest
}

export const loadPlannedManifests = Effect.gen(function* () {
  const plan = yield* ReleasePlanService
  return yield* Effect.forEach(plan.releases, (release) =>
    Pkg.Manifest.resource.readOrEmpty(release.packagePath).pipe(
      Effect.map((manifest) => ({
        packageName: release.packageName.moniker,
        packageJsonPath: Fs.Path.toString(
          Fs.Path.join(release.packagePath, Fs.Path.RelFile.fromString('./package.json')),
        ),
        manifest,
      })),
    ),
  )
})

export const summarizePackages = (names: readonly string[]): string => {
  if (names.length <= 3) return names.join(', ')
  const head = names.slice(0, 3).join(', ')
  return `${head}, +${String(names.length - 3)} more`
}

/** A planned package that violates a manifest rule. */
export interface ManifestRuleOffender {
  readonly packageName: string
  readonly packageJsonPath: string
}

/** Violation content produced by a manifest rule when offenders exist. */
export interface ManifestRuleViolationContent {
  /** Environment-location message used when more than one package offends. */
  readonly environmentMessage: string
  readonly summary: string
  readonly detail: string
  readonly fix?: ViolationFix
  readonly hints?: readonly Hint[]
  readonly docs?: readonly DocLink[]
}

/**
 * Build a rule over the planned package manifests.
 *
 * Encapsulates the shared manifest-rule skeleton: load planned manifests,
 * find offenders, return `{ packageCount }` metadata when clean, and
 * otherwise report a violation located at the offending package.json
 * (single offender) or the environment (multiple offenders).
 */
export const manifestRule = <Offender extends ManifestRuleOffender>(cfg: {
  readonly id: RuleId
  readonly description: string
  readonly preventsDescriptions?: readonly string[]
  readonly defaults?: RuleDefaults
  readonly findOffenders: (manifests: readonly PlannedManifest[]) => readonly Offender[]
  readonly violation: (ctx: {
    readonly offenders: readonly Offender[]
    readonly names: readonly string[]
    readonly example: Offender
  }) => ManifestRuleViolationContent
}) =>
  RuntimeRule.create({
    id: cfg.id,
    description: cfg.description,
    ...(cfg.preventsDescriptions ? { preventsDescriptions: cfg.preventsDescriptions } : {}),
    ...(cfg.defaults ? { defaults: cfg.defaults } : {}),
    preconditions: ['hasReleasePlan'],
    check: () =>
      loadPlannedManifests.pipe(
        Effect.map((manifests) => {
          const offenders = cfg.findOffenders(manifests)
          if (offenders.length === 0) {
            return { metadata: { packageCount: manifests.length } }
          }

          const names = offenders.map((offender) => offender.packageName)
          const example = offenders[0]!
          const content = cfg.violation({ offenders, names, example })

          return Violation.make({
            location:
              offenders.length === 1
                ? File.make({ path: example.packageJsonPath })
                : Environment.make({ message: content.environmentMessage }),
            summary: content.summary,
            detail: content.detail,
            ...(content.fix ? { fix: content.fix } : {}),
            ...(content.hints ? { hints: content.hints } : {}),
            ...(content.docs ? { docs: content.docs } : {}),
          })
        }),
      ),
  })
