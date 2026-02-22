import { Str } from '@kitz/core'
import type { CommitDisplay, Forecast, ForecastCascade, ForecastRelease } from '../forecaster/models.js'
import { renderTree } from '../renderer/tree.js'
import type { PublishRecord, PublishState } from './metadata.js'
import { renderMetadataBlock } from './metadata.js'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RenderOptions {
  readonly publishState?: PublishState
  readonly publishHistory?: readonly PublishRecord[]
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Render the full PR comment markdown from a Forecast.
 *
 * Produces nested list format with checkboxes, commit SHA links,
 * official version projections, publish history, and embedded tree.
 */
export const render = (
  forecast: Forecast,
  options?: RenderOptions,
): string => {
  const state = options?.publishState ?? 'idle'
  const publishHistory = options?.publishHistory ?? []
  const output = Str.Builder()

  // Metadata block (invisible HTML comments)
  output(renderMetadataBlock({
    headSha: forecast.headSha,
    publishState: state,
    publishHistory,
  }))
  output``

  // Header
  output`## Release Plan Preview`
  output``

  // Summary line
  const totalPackages = forecast.releases.length + forecast.cascades.length
  const headLink = `[\`${
    forecast.headSha.slice(0, 7)
  }\`](https://github.com/${forecast.owner}/${forecast.repo}/commit/${forecast.headSha})`
  output`${String(totalPackages)} packages ${Str.Char.middleDot} ${
    String(forecast.releases.length)
  } primary ${Str.Char.middleDot} ${String(forecast.cascades.length)} cascades ${Str.Char.middleDot} head ${headLink}`
  output``

  // Status banner (if publishing/published/failed)
  if (state !== 'idle') {
    output(renderStatusBanner(state, forecast.owner, forecast.repo))
    output``
  }

  // Explainer toggle
  output(renderExplainer())
  output``

  output`---`
  output``

  // Primary releases
  if (forecast.releases.length > 0) {
    output`### Primary (${String(forecast.releases.length)})`
    output``

    const sorted = [...forecast.releases].sort((a, b) => b.commits.length - a.commits.length)
    for (const release of sorted) {
      output(renderReleaseItem(release, publishHistory))
      output``
    }
  }

  // Cascade releases
  if (forecast.cascades.length > 0) {
    output`### Cascades (${String(forecast.cascades.length)})`
    output``

    for (const cascade of forecast.cascades) {
      output(renderCascadeItem(cascade))
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

const renderReleaseItem = (
  release: ForecastRelease,
  publishHistory: readonly PublishRecord[],
): string => {
  const name = release.packageName
  const commitCount = release.commits.length
  const sourceLink = `[${Str.Char.blackSquare}](${release.sourceUrl})`

  const lines: string[] = []

  // Main line: checkbox + source link + package name + commit count
  lines.push(`- [ ] ${sourceLink} **${name}** — ${commitCount} commit${commitCount === 1 ? '' : 's'}`)

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

const renderCascadeItem = (
  cascade: ForecastCascade,
): string => {
  const name = cascade.packageName
  const sourceLink = `[${Str.Char.blackSquare}](${cascade.sourceUrl})`
  const viaStr = cascade.triggeredBy.length > 0 ? ` via \`${cascade.triggeredBy.join('`, `')}\`` : ''
  const versionStr = cascade.nextOfficialVersion.toString()

  const lines: string[] = []
  lines.push(`- [ ] ${sourceLink} **${name}**${viaStr}`)
  lines.push(`  \`${versionStr}\``)

  return lines.join(Str.Char.newline)
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const renderCommitShas = (commits: readonly CommitDisplay[], max: number): string => {
  const shown = commits.slice(0, max)
  const remaining = commits.length - shown.length

  const shas = shown.map((c) => `[\`${c.shortSha}\`](${c.commitUrl})`)
  if (remaining > 0) {
    shas.push(`+${remaining}`)
  }
  return shas.join(' ')
}

const renderVersionLine = (release: ForecastRelease): string => {
  const officialStr = release.nextOfficialVersion.toString()
  return `**\`${officialStr}\`** ${release.bump} (from ${release.currentVersionDisplay})`
}

const renderPublishedVersions = (versions: readonly PublishRecord[], packageName: string): string => {
  // Sort by iteration descending (latest first)
  const sorted = [...versions].sort((a, b) => b.iteration - a.iteration)

  return sorted.map((v, i) => {
    const npmUrl = `https://www.npmjs.com/package/${packageName}/v/${v.version}`
    const label = shortPrVersion(v.version)
    if (i === 0) {
      // Latest version: bold
      return `[**\`${label}\`**](${npmUrl})`
    }
    return `[\`${label}\`](${npmUrl})`
  }).join(` ${Str.Char.middleDot} `)
}

/**
 * Shorten a PR version string for display.
 * `0.0.0-pr.129.2.959738b` → `pr.129.2.959738b`
 */
const shortPrVersion = (version: string): string => {
  const match = version.match(/^0\.0\.0-(.+)$/)
  return match?.[1] ?? version
}

// ---------------------------------------------------------------------------
// Status banner
// ---------------------------------------------------------------------------

const renderStatusBanner = (state: PublishState, owner: string, repo: string): string => {
  switch (state) {
    case 'publishing':
      return '> **Publishing...** A publish workflow is currently running.'
    case 'published':
      return '> **Published.** All packages have been published to npm.'
    case 'failed':
      return `> **Publish failed.** Check the [workflow run](https://github.com/${owner}/${repo}/actions) for details. Re-check a checkbox to retry.`
    case 'idle':
      return ''
  }
}

// ---------------------------------------------------------------------------
// Explainer
// ---------------------------------------------------------------------------

const renderExplainer = (): string => {
  const lines = [
    '<details><summary>How release calculation works</summary>',
    '',
    '**Primary** — packages with commits directly touching their source in this PR.',
    '**Cascade** — packages that depend on a primary release; re-published for consistency.',
    '',
    '| Context | Version Format |',
    '| --- | --- |',
    '| Ephemeral (PR) | `0.0.0-pr.<N>.<iter>.<sha>` |',
    '| Candidate | `<base>-next.<N>` |',
    '| Official | Semver bump from conventional commits |',
    '',
    'Bump rules: `feat()` → minor · `fix()` → patch · `!` → major',
    'Cascades inherit patch bump.',
    '',
    '</details>',
  ]
  return lines.join(Str.Char.newline)
}
