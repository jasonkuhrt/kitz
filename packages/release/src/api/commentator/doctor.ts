import { Err, Str } from '@kitz/core'
import { Option, Schema } from 'effect'
import { Failed, Finished, type Report, Skipped } from '../lint/models/report.js'
import { Violation, ViolationFix } from '../lint/models/violation.js'
import {
  PublishChannelReadyMetadataSchema,
  type PublishChannelReadyMetadata,
} from '../lint/rules/env-publish-channel-ready.js'
import type { Lifecycle } from '../version/models/lifecycle.js'

type DoctorStatus = 'pass' | 'manual' | 'deferred' | 'warn' | 'error'

interface DoctorGuidance {
  readonly label: string
  readonly summary: string
  readonly detail?: string
  readonly fix?:
    | {
        readonly summary: string
        readonly steps: readonly string[]
        readonly docs: ReadonlyArray<{ readonly label: string; readonly url: string }>
      }
    | {
        readonly summary: string
        readonly command: string
        readonly docs: ReadonlyArray<{ readonly label: string; readonly url: string }>
      }
  readonly hints: readonly string[]
  readonly docs: ReadonlyArray<{ readonly label: string; readonly url: string }>
}

interface DoctorRow {
  readonly label: string
  readonly status: DoctorStatus
  readonly notes: string
}

export interface DoctorSummary {
  readonly lifecycle: Lifecycle
  readonly rows: readonly DoctorRow[]
  readonly guidance: readonly DoctorGuidance[]
  readonly runbook?: {
    readonly title: string
    readonly commands: readonly string[]
    readonly note?: string
  }
  readonly deferredChecks: readonly {
    readonly label: string
    readonly ruleId: string
    readonly preventsDescriptions: readonly string[]
    readonly checkCommand: string
  }[]
}

interface CreateDoctorSummaryOptions {
  readonly lifecycle: Lifecycle
  readonly plannedPackages: number
  readonly runbook?: DoctorSummary['runbook']
  readonly deferredChecks?: DoctorSummary['deferredChecks']
}

const PackageCountMetadataSchema = Schema.Struct({
  packageCount: Schema.Number,
})

const RepositoryCanonicalMetadataSchema = Schema.Struct({
  canonicalRepo: Schema.String,
  packageCount: Schema.Number,
})

const TagsUniqueMetadataSchema = Schema.Struct({
  conflictingTags: Schema.Array(Schema.String),
  existingTags: Schema.Array(Schema.String),
})
const ProjectedSquashCommitMetadataSchema = Schema.Struct({
  projectedHeader: Schema.String,
})

const decodePublishChannelMetadata = Schema.decodeUnknownOption(PublishChannelReadyMetadataSchema)
const decodePackageCountMetadata = Schema.decodeUnknownOption(PackageCountMetadataSchema)
const decodeRepositoryCanonicalMetadata = Schema.decodeUnknownOption(
  RepositoryCanonicalMetadataSchema,
)
const decodeTagsUniqueMetadata = Schema.decodeUnknownOption(TagsUniqueMetadataSchema)
const decodeProjectedSquashCommitMetadata = Schema.decodeUnknownOption(
  ProjectedSquashCommitMetadataSchema,
)

const doctorRuleOrder = [
  'env.publish-channel-ready',
  'pr.projected-squash-commit-sync',
  'pr.type.release-kind-match-diff',
  'plan.packages-not-private',
  'plan.packages-license-present',
  'plan.packages-repository-present',
  'plan.packages-repository-match-canonical',
  'plan.versions-unpublished',
  'plan.tags-unique',
] as const

const doctorRuleLabels: Record<(typeof doctorRuleOrder)[number], string> = {
  'env.publish-channel-ready': 'Publish channel',
  'pr.projected-squash-commit-sync': 'Release header',
  'pr.type.release-kind-match-diff': 'Release kind',
  'plan.packages-not-private': 'Package visibility',
  'plan.packages-license-present': 'License metadata',
  'plan.packages-repository-present': 'Repository metadata',
  'plan.packages-repository-match-canonical': 'Repository provenance',
  'plan.versions-unpublished': 'Version availability',
  'plan.tags-unique': 'Tag uniqueness',
}

const escapeMarkdownCell = (value: string): string => value.replaceAll('|', '\\|')

const renderPublishChannelNote = (metadata: PublishChannelReadyMetadata): string => {
  if (metadata.status === 'manual') {
    return 'Declared as manual. Merging does not publish automatically.'
  }

  if (metadata.status === 'deferred') {
    if (metadata.workflow && metadata.activeWorkflow) {
      return `Publishes from \`${metadata.workflow}\`; this preview is running in \`${metadata.activeWorkflow}\`.`
    }
    if (metadata.workflow) {
      return `Publishes from \`${metadata.workflow}\`; this preview is not the publish job.`
    }
    return 'Publishing checks are deferred to the real publish runtime.'
  }

  if (metadata.mode === 'github-token') {
    return `Ready in \`${metadata.workflow}\` via \`${metadata.tokenEnv ?? 'NPM_TOKEN'}\`.`
  }

  if (metadata.mode === 'github-trusted') {
    return `Ready in \`${metadata.workflow}\` via npm trusted publishing.`
  }

  return 'Publish channel is ready.'
}

/** Resolve the planned-package count from rule metadata, with a fallback. */
const decodedPackageCount = (metadata: unknown, fallback: number): number =>
  decodePackageCountMetadata(metadata).pipe(
    Option.match({
      onNone: () => fallback,
      onSome: (value) => value.packageCount,
    }),
  )

type PassNoteRenderer = (metadata: unknown, plannedPackages: number) => string

const packageCountPassNote =
  (note: (count: number) => string): PassNoteRenderer =>
  (metadata, plannedPackages) =>
    note(decodedPackageCount(metadata, plannedPackages))

const passNoteByRule = {
  'env.publish-channel-ready': (metadata) =>
    decodePublishChannelMetadata(metadata).pipe(
      Option.match({
        onNone: () => 'Publish channel is ready.',
        onSome: renderPublishChannelNote,
      }),
    ),
  'pr.projected-squash-commit-sync': (metadata) =>
    decodeProjectedSquashCommitMetadata(metadata).pipe(
      Option.match({
        onNone: () => 'PR title header already matches the canonical release header.',
        onSome: (value) => `Canonical release header is \`${value.projectedHeader}\`.`,
      }),
    ),
  'pr.type.release-kind-match-diff': () => 'PR title kind matches the changed source files.',
  'plan.packages-not-private': packageCountPassNote(
    (count) =>
      `All ${String(count)} planned packages are publishable and not marked \`private: true\`.`,
  ),
  'plan.packages-license-present': packageCountPassNote(
    (count) => `All ${String(count)} planned packages declare a license.`,
  ),
  'plan.packages-repository-present': packageCountPassNote(
    (count) => `All ${String(count)} planned packages declare repository metadata.`,
  ),
  'plan.packages-repository-match-canonical': (metadata) =>
    decodeRepositoryCanonicalMetadata(metadata).pipe(
      Option.match({
        onNone: () => 'All planned packages point at the canonical GitHub repository.',
        onSome: (value) =>
          `All ${String(value.packageCount)} planned packages point at \`${value.canonicalRepo}\`.`,
      }),
    ),
  'plan.versions-unpublished': packageCountPassNote(
    (count) => `All ${String(count)} planned package versions are still unpublished on npm.`,
  ),
  'plan.tags-unique': (metadata) =>
    decodeTagsUniqueMetadata(metadata).pipe(
      Option.match({
        onNone: () => 'Planned release tags are unique.',
        onSome: (value) =>
          value.conflictingTags.length === 0
            ? 'No planned release tags collide with existing git tags.'
            : 'Planned release tags are unique.',
      }),
    ),
} as const satisfies Record<(typeof doctorRuleOrder)[number], PassNoteRenderer>

const renderPassNote = (
  ruleId: (typeof doctorRuleOrder)[number],
  metadata: unknown,
  plannedPackages: number,
): string => passNoteByRule[ruleId](metadata, plannedPackages)

const toGuidanceFix = (violation: Violation): DoctorGuidance['fix'] | undefined => {
  if (!violation.fix) return undefined

  if (ViolationFix.guards.ViolationGuideFix(violation.fix)) {
    return {
      summary: violation.fix.summary,
      steps: violation.fix.steps.map((step) => step.description),
      docs: (violation.fix.docs ?? []).map((doc) => ({ label: doc.label, url: doc.url })),
    }
  }

  if (ViolationFix.guards.ViolationCommandFix(violation.fix)) {
    return {
      summary: violation.fix.summary,
      command: violation.fix.command,
      docs: (violation.fix.docs ?? []).map((doc) => ({ label: doc.label, url: doc.url })),
    }
  }

  return undefined
}

const toGuidance = (label: string, violation: Violation): DoctorGuidance => {
  const fix = toGuidanceFix(violation)

  return {
    label,
    summary: violation.summary ?? 'Check failed.',
    ...(violation.detail ? { detail: violation.detail } : {}),
    ...(fix ? { fix } : {}),
    hints: (violation.hints ?? []).map((hint) => hint.description),
    docs: (violation.docs ?? []).map((doc) => ({ label: doc.label, url: doc.url })),
  }
}

export const createDoctorSummary = (
  report: Report,
  options: CreateDoctorSummaryOptions,
): DoctorSummary | undefined => {
  const rows: DoctorRow[] = []
  const guidance: DoctorGuidance[] = []

  for (const ruleId of doctorRuleOrder) {
    const result = report.results.find((entry) => entry.rule.id === ruleId)
    if (!result || Skipped.is(result)) continue

    const label = doctorRuleLabels[ruleId]

    if (Failed.is(result)) {
      rows.push({
        label,
        status: 'error',
        notes: Err.ensure(result.error).message,
      })
      continue
    }

    if (!Finished.is(result)) continue

    if (result.violation) {
      rows.push({
        label,
        status: result.severity,
        notes: result.violation.summary ?? result.rule.description,
      })
      guidance.push(toGuidance(label, result.violation))
      continue
    }

    const status =
      ruleId === 'env.publish-channel-ready'
        ? decodePublishChannelMetadata(result.metadata).pipe(
            Option.match({
              onNone: () => 'pass' as const,
              onSome: (value) => (value.status === 'ready' ? 'pass' : value.status),
            }),
          )
        : 'pass'

    rows.push({
      label,
      status,
      notes: renderPassNote(ruleId, result.metadata, options.plannedPackages),
    })
  }

  if (rows.length === 0) return undefined

  return {
    lifecycle: options.lifecycle,
    rows,
    guidance,
    ...(options.runbook ? { runbook: options.runbook } : {}),
    deferredChecks: options.deferredChecks ?? [],
  }
}

export const renderDoctorSummary = (summary: DoctorSummary): string => {
  const b = Str.Builder()

  b`### Doctor`
  b``
  b`| Check | Status | Notes |`
  b`| --- | --- | --- |`

  for (const row of summary.rows) {
    b`| ${escapeMarkdownCell(row.label)} | \`${row.status}\` | ${escapeMarkdownCell(row.notes)} |`
  }

  if (summary.guidance.length > 0) {
    b``
    b`<details><summary>Guidance (${String(summary.guidance.length)})</summary>`
    b``

    for (const item of summary.guidance) {
      b`- **${item.label}**: ${item.summary}`
      if (item.detail) b`  ${item.detail}`
      if (item.fix) {
        b`  Fix: ${item.fix.summary}`
        if ('steps' in item.fix) {
          for (const [index, step] of item.fix.steps.entries()) {
            b`  ${String(index + 1)}. ${step}`
          }
        }
        if ('command' in item.fix) {
          b`  Command: \`${item.fix.command}\``
        }
        for (const doc of item.fix.docs) {
          b`  Fix docs: [${doc.label}](${doc.url})`
        }
      }
      for (const hint of item.hints) {
        b`  Hint: ${hint}`
      }
      for (const doc of item.docs) {
        b`  Docs: [${doc.label}](${doc.url})`
      }
    }

    b``
    b`</details>`
  }

  if (summary.runbook) {
    b``
    b`#### ${summary.runbook.title}`
    b``

    for (const [index, command] of summary.runbook.commands.entries()) {
      b`${String(index + 1)}. \`${command}\``
    }

    if (summary.runbook.note) {
      b``
      b(summary.runbook.note)
    }
  }

  if (summary.deferredChecks.length > 0) {
    b``
    b`#### Could Still Go Wrong Locally`
    b``
    b`This comment cannot verify your local machine. Before applying the manual preview release, these checks still need to pass:`
    b``

    for (const item of summary.deferredChecks) {
      b`- \`${item.ruleId}\`: prevents ${item.preventsDescriptions.join('; ')}. Check with \`${item.checkCommand}\`.`
    }
  }

  return b.render()
}
