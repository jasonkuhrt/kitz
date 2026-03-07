import { Str } from '@kitz/core'
import { Option, Schema } from 'effect'
import { Failed, Finished, type Report, Skipped } from '../lint/models/report.js'
import type { Severity } from '../lint/models/severity.js'
import { Violation } from '../lint/models/violation.js'
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
  'plan.packages-not-private': 'Package visibility',
  'plan.packages-license-present': 'License metadata',
  'plan.packages-repository-present': 'Repository metadata',
  'plan.packages-repository-match-canonical': 'Repository provenance',
  'plan.versions-unpublished': 'Version availability',
  'plan.tags-unique': 'Tag uniqueness',
}

const escapeMarkdownCell = (value: string): string => value.replaceAll('|', '\\|')

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

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

const renderPassNote = (
  ruleId: (typeof doctorRuleOrder)[number],
  metadata: unknown,
  plannedPackages: number,
): string => {
  if (ruleId === 'env.publish-channel-ready') {
    return decodePublishChannelMetadata(metadata).pipe(
      Option.match({
        onNone: () => 'Publish channel is ready.',
        onSome: renderPublishChannelNote,
      }),
    )
  }

  if (ruleId === 'plan.packages-not-private') {
    const count = decodePackageCountMetadata(metadata).pipe(
      Option.match({
        onNone: () => plannedPackages,
        onSome: (value) => value.packageCount,
      }),
    )
    return `All ${String(count)} planned packages are publishable and not marked \`private: true\`.`
  }

  if (ruleId === 'plan.packages-license-present') {
    const count = decodePackageCountMetadata(metadata).pipe(
      Option.match({
        onNone: () => plannedPackages,
        onSome: (value) => value.packageCount,
      }),
    )
    return `All ${String(count)} planned packages declare a license.`
  }

  if (ruleId === 'plan.packages-repository-present') {
    const count = decodePackageCountMetadata(metadata).pipe(
      Option.match({
        onNone: () => plannedPackages,
        onSome: (value) => value.packageCount,
      }),
    )
    return `All ${String(count)} planned packages declare repository metadata.`
  }

  if (ruleId === 'plan.packages-repository-match-canonical') {
    return decodeRepositoryCanonicalMetadata(metadata).pipe(
      Option.match({
        onNone: () => 'All planned packages point at the canonical GitHub repository.',
        onSome: (value) =>
          `All ${String(value.packageCount)} planned packages point at \`${value.canonicalRepo}\`.`,
      }),
    )
  }

  if (ruleId === 'plan.tags-unique') {
    return decodeTagsUniqueMetadata(metadata).pipe(
      Option.match({
        onNone: () => 'Planned release tags are unique.',
        onSome: (value) =>
          value.conflictingTags.length === 0
            ? 'No planned release tags collide with existing git tags.'
            : 'Planned release tags are unique.',
      }),
    )
  }

  if (ruleId === 'plan.versions-unpublished') {
    const count = decodePackageCountMetadata(metadata).pipe(
      Option.match({
        onNone: () => plannedPackages,
        onSome: (value) => value.packageCount,
      }),
    )
    return `All ${String(count)} planned package versions are still unpublished on npm.`
  }

  if (ruleId === 'pr.projected-squash-commit-sync') {
    return decodeProjectedSquashCommitMetadata(metadata).pipe(
      Option.match({
        onNone: () => 'PR title header already matches the canonical release header.',
        onSome: (value) => `Canonical release header is \`${value.projectedHeader}\`.`,
      }),
    )
  }

  return 'Check passed.'
}

const toDoctorStatus = (severity: Severity): DoctorStatus =>
  severity._tag === 'SeverityError' ? 'error' : 'warn'

const toGuidance = (label: string, violation: Violation): DoctorGuidance => ({
  label,
  summary: violation.summary ?? 'Check failed.',
  ...(violation.detail ? { detail: violation.detail } : {}),
  hints: (violation.hints ?? []).map((hint) => hint.description),
  docs: (violation.docs ?? []).map((doc) => ({ label: doc.label, url: doc.url })),
})

export const createDoctorSummary = (
  report: Report,
  options: CreateDoctorSummaryOptions,
): DoctorSummary | undefined => {
  const byRule = new Map<string, (typeof report.results)[number]>(
    report.results.map((result) => [result.rule.id, result]),
  )
  const rows: DoctorRow[] = []
  const guidance: DoctorGuidance[] = []

  for (const ruleId of doctorRuleOrder) {
    const result = byRule.get(ruleId)
    if (!result || Skipped.is(result)) continue

    const label = doctorRuleLabels[ruleId]

    if (Failed.is(result)) {
      rows.push({
        label,
        status: 'error',
        notes: errorMessage(result.error),
      })
      continue
    }

    if (!Finished.is(result)) continue

    if (result.violation) {
      rows.push({
        label,
        status: toDoctorStatus(result.severity),
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
  const lines: string[] = []

  lines.push('### Doctor')
  lines.push('')
  lines.push('| Check | Status | Notes |')
  lines.push('| --- | --- | --- |')

  for (const row of summary.rows) {
    lines.push(
      `| ${escapeMarkdownCell(row.label)} | \`${row.status}\` | ${escapeMarkdownCell(row.notes)} |`,
    )
  }

  if (summary.guidance.length > 0) {
    lines.push('')
    lines.push(`<details><summary>Guidance (${String(summary.guidance.length)})</summary>`)
    lines.push('')

    for (const item of summary.guidance) {
      lines.push(`- **${item.label}**: ${item.summary}`)
      if (item.detail) lines.push(`  ${item.detail}`)
      for (const hint of item.hints) {
        lines.push(`  Hint: ${hint}`)
      }
      for (const doc of item.docs) {
        lines.push(`  Docs: [${doc.label}](${doc.url})`)
      }
    }

    lines.push('')
    lines.push('</details>')
  }

  if (summary.runbook) {
    lines.push('')
    lines.push(`#### ${summary.runbook.title}`)
    lines.push('')

    for (const [index, command] of summary.runbook.commands.entries()) {
      lines.push(`${String(index + 1)}. \`${command}\``)
    }

    if (summary.runbook.note) {
      lines.push('')
      lines.push(summary.runbook.note)
    }
  }

  if (summary.deferredChecks.length > 0) {
    lines.push('')
    lines.push('#### Could Still Go Wrong Locally')
    lines.push('')
    lines.push(
      'This comment cannot verify your local machine. Before applying the manual preview release, these checks still need to pass:',
    )
    lines.push('')

    for (const item of summary.deferredChecks) {
      lines.push(
        `- \`${item.ruleId}\`: prevents ${item.preventsDescriptions.join('; ')}. Check with \`${item.checkCommand}\`.`,
      )
    }
  }

  return Str.Text.unlines(lines)
}
