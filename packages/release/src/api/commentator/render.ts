import { Str } from '@kitz/core'
import type {
  CommitDisplay,
  Forecast,
  ForecastCascade,
  ForecastRelease,
} from '../forecaster/models.js'
import type { Preview as ProjectedSquashCommitPreview } from '../projected-squash-commit.js'
import { renderTree } from '../renderer/tree.js'
import type { DoctorSummary } from './doctor.js'
import { renderDoctorSummary } from './doctor.js'
import type { PublishRecord, PublishState } from './metadata.js'
import { renderMetadataBlock } from './metadata.js'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RenderOptions {
  readonly publishState?: PublishState
  readonly publishHistory?: readonly PublishRecord[]
  readonly doctor?: DoctorSummary
  readonly projectedSquashCommit?: ProjectedSquashCommitPreview
  readonly interactiveChecklist?: boolean
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Render the full PR comment markdown from a Forecast.
 *
 * Produces nested list format with optional checklists, commit SHA links,
 * official version projections, publish history, and embedded tree.
 */
export const render = (forecast: Forecast, options?: RenderOptions): string => {
  const state = options?.publishState ?? 'idle'
  const publishHistory = options?.publishHistory ?? []
  const doctor = options?.doctor
  const projectedSquashCommit = options?.projectedSquashCommit
  const interactiveChecklist = options?.interactiveChecklist ?? false
  const output = Str.Builder()

  // Metadata block (invisible HTML comments)
  output(
    renderMetadataBlock({
      headSha: forecast.headSha,
      publishState: state,
      publishHistory,
    }),
  )
  output``

  // Header
  output`## Release Forecast`
  output``

  // Summary line
  const totalPackages = forecast.releases.length + forecast.cascades.length
  const headLink = `[\`${forecast.headSha.slice(
    0,
    7,
  )}\`](https://github.com/${forecast.owner}/${forecast.repo}/commit/${forecast.headSha})`
  output`${String(totalPackages)} packages ${Str.Char.middleDot} ${String(
    forecast.releases.length,
  )} primary ${Str.Char.middleDot} ${String(forecast.cascades.length)} cascades ${Str.Char.middleDot} head ${headLink}`
  output``

  // Status banner (if publishing/published/failed)
  if (state !== 'idle') {
    output(renderStatusBanner(state, forecast.owner, forecast.repo, interactiveChecklist))
    output``
  }

  // Help toggle
  output(renderHelp())
  output``

  if (projectedSquashCommit) {
    output(renderProjectedSquashCommit(projectedSquashCommit))
    output``
  }

  if (doctor) {
    output(renderDoctorSummary(doctor))
    output``
  }

  output`---`
  output``

  // Primary releases
  if (forecast.releases.length > 0) {
    output`### Primary (${String(forecast.releases.length)})`
    output``

    const sorted = [...forecast.releases].sort((a, b) => b.commits.length - a.commits.length)
    for (const release of sorted) {
      output(renderReleaseItem(release, publishHistory, interactiveChecklist))
      output``
    }
  }

  // Cascade releases
  if (forecast.cascades.length > 0) {
    output`### Cascades (${String(forecast.cascades.length)})`
    output``

    for (const cascade of forecast.cascades) {
      output(renderCascadeItem(cascade, interactiveChecklist))
      output``
    }
  }

  // Tree visualization toggle
  output`<details><summary>Tree</summary>`
  output``
  output`\`\`\`text`
  output(renderTree(forecast, { maxItems: 5 }))
  output`\`\`\``
  output``
  output`</details>`

  return output.render()
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

/** Render a single primary release as a list item with commits and version info. */
const renderReleaseItem = (
  release: ForecastRelease,
  publishHistory: readonly PublishRecord[],
  interactiveChecklist: boolean,
): string => {
  const name = release.packageName
  const commitCount = release.commits.length
  const sourceLink = `[${Str.Char.blackSquare}](${release.sourceUrl})`
  const prefix = interactiveChecklist ? '- [ ]' : '-'

  const lines: string[] = []

  // Main line: source link + package name + commit count
  lines.push(
    `${prefix} ${sourceLink} **${name}** — ${commitCount} commit${commitCount === 1 ? '' : 's'}`,
  )

  // Commit SHAs (indented)
  if (release.commits.length > 0) {
    lines.push(`  ${renderCommitShas(release.commits, 5)}`)
  }

  // Version line: official version projection
  const versionLine = renderVersionLine(release)
  lines.push(`  ${versionLine}`)

  // Published versions (if any)
  const published = publishHistory.filter((p) => p.package === name)
  if (published.length > 0) {
    lines.push(`  published: ${renderPublishedVersions(published, name)}`)
  }

  return lines.join(Str.Char.newline)
}

/** Render a single cascade release as a list item with trigger info. */
const renderCascadeItem = (cascade: ForecastCascade, interactiveChecklist: boolean): string => {
  const name = cascade.packageName
  const sourceLink = `[${Str.Char.blackSquare}](${cascade.sourceUrl})`
  const viaStr =
    cascade.triggeredBy.length > 0 ? ` via \`${cascade.triggeredBy.join('`, `')}\`` : ''
  const versionStr = cascade.nextOfficialVersion.toString()
  const prefix = interactiveChecklist ? '- [ ]' : '-'

  const lines: string[] = []
  lines.push(`${prefix} ${sourceLink} **${name}**${viaStr}`)
  lines.push(`  \`${versionStr}\``)

  return lines.join(Str.Char.newline)
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Render commit SHA links, truncating to `max` with a "+N" suffix. */
const renderCommitShas = (commits: readonly CommitDisplay[], max: number): string => {
  const shown = commits.slice(0, max)
  const remaining = commits.length - shown.length

  const shas = shown.map((c) => `[\`${c.shortSha}\`](${c.commitUrl})`)
  if (remaining > 0) {
    shas.push(`+${remaining}`)
  }
  return shas.join(' ')
}

/** Render the projected official version with bump type and current version. */
const renderVersionLine = (release: ForecastRelease): string => {
  const officialStr = release.nextOfficialVersion.toString()
  return `**\`${officialStr}\`** ${release.bump} (from ${release.currentVersionDisplay})`
}

const renderProjectedSquashCommit = (preview: ProjectedSquashCommitPreview): string => {
  const lines = ['### Projected Release Header', '']

  if (preview.projectedHeader) {
    lines.push(`\`${preview.projectedHeader}\``)

    if (preview.actualTitleError) {
      lines.push('')
      lines.push(
        `Current PR title is not a valid conventional commit title: ${preview.actualTitleError}`,
      )
      lines.push(`Current PR title: \`${preview.actualTitle}\``)
      return lines.join(Str.Char.newline)
    }

    if (!preview.inSync) {
      lines.push('')
      if (preview.actualHeader) {
        lines.push(`Current PR header: \`${preview.actualHeader}\``)
      }
      lines.push(`Current PR title: \`${preview.actualTitle}\``)
    }
    return lines.join(Str.Char.newline)
  }

  lines.push(`Unavailable: ${preview.reason ?? 'Could not project a release header.'}`)
  lines.push('')
  lines.push(`Current PR title: \`${preview.actualTitle}\``)
  return lines.join(Str.Char.newline)
}

/** Render previously published versions as npm links, latest first and bold. */
const renderPublishedVersions = (
  versions: readonly PublishRecord[],
  packageName: string,
): string => {
  // Sort by iteration descending (latest first)
  const sorted = [...versions].sort((a, b) => b.iteration - a.iteration)

  return sorted
    .map((v, i) => {
      const npmUrl = `https://www.npmjs.com/package/${packageName}/v/${v.version}`
      const label = shortPrVersion(v.version)
      if (i === 0) {
        // Latest version: bold
        return `[**\`${label}\`**](${npmUrl})`
      }
      return `[\`${label}\`](${npmUrl})`
    })
    .join(` ${Str.Char.middleDot} `)
}

/**
 * Shorten a PR version string for display.
 * `0.0.0-pr.129.2.g959738b` → `pr.129.2.g959738b`
 */
const shortPrVersion = (version: string): string => {
  const match = version.match(/^0\.0\.0-(.+)$/)
  return match?.[1] ?? version
}

// ---------------------------------------------------------------------------
// Status banner
// ---------------------------------------------------------------------------

/** Render the publish status banner (publishing, published, failed, or empty for idle). */
const renderStatusBanner = (
  state: PublishState,
  owner: string,
  repo: string,
  interactiveChecklist: boolean,
): string => {
  switch (state) {
    case 'publishing':
      return '> **Publishing...** A publish workflow is currently running.'
    case 'published':
      return '> **Published.** All packages have been published to npm.'
    case 'failed':
      return interactiveChecklist
        ? `> **Publish failed.** Check the [workflow run](https://github.com/${owner}/${repo}/actions) for details. Re-check a checkbox to retry.`
        : `> **Publish failed.** Check the [workflow run](https://github.com/${owner}/${repo}/actions) for details.`
    case 'idle':
      return ''
  }
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

/** Render the collapsible help block for release forecast terminology. */
const renderHelp = (): string => {
  const lines = [
    '<details><summary>Help</summary>',
    '',
    '| Term | Where | Meaning |',
    '| --- | --- | --- |',
    '| Packages | Summary line | Total packages in this forecast (`primary + cascades`). |',
    '| Primary | Summary line, section heading | Packages with direct source changes in this PR. |',
    '| Cascades | Summary line, section heading | Packages re-published because they depend on a primary release. |',
    '| Head | Summary line | The exact commit SHA this forecast was computed from. |',
    '| Ephemeral | Version and publish history | PR preview version format: `0.0.0-pr.<N>.<iter>.<sha>`. |',
    '| Candidate | Version and publish history | Pre-release version format: `<base>-next.<N>`. |',
    '| Official | Version lines | Final semver release version computed from commit semantics. |',
    '',
    'Bump rules: `feat()` → minor · `fix()` → patch · `!` → major',
    'Cascades use patch because they are being re-published due to dependency movement, not direct source edits.',
    '',
    '</details>',
  ]
  return lines.join(Str.Char.newline)
}
