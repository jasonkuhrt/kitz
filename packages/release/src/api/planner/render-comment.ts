import { Str } from '@kitz/core'
import { Option } from 'effect'
import type { CommentData, CommitDisplay, EnrichedCascade, EnrichedRelease, PublishRecord } from './comment-data.js'
import type { PublishState } from './comment-metadata.js'
import { renderMetadataBlock } from './comment-metadata.js'
import { renderTree } from './render-tree.js'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CommentRenderOptions {
  readonly publishState?: PublishState
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Render the full PR comment markdown from enriched plan data.
 *
 * Produces nested list format with checkboxes, commit SHA links,
 * stable version projections, publish history, and embedded tree.
 */
export const renderComment = (
  data: CommentData,
  options?: CommentRenderOptions,
): string => {
  const { github } = data
  const state = options?.publishState ?? 'idle'
  const output = Str.Builder()

  // Metadata block (invisible HTML comments)
  output(renderMetadataBlock({
    headSha: github.headSha,
    publishState: state,
    publishHistory: data.releases.flatMap((r) => [...r.publishedVersions]),
  }))
  output``

  // Header
  output`## Release Plan Preview`
  output``

  // Summary line
  const totalPackages = data.releases.length + data.cascades.length
  const headLink = `[\`${
    github.headSha.slice(0, 7)
  }\`](https://github.com/${github.owner}/${github.repo}/commit/${github.headSha})`
  output`${String(totalPackages)} packages ${Str.Char.middleDot} ${
    String(data.releases.length)
  } primary ${Str.Char.middleDot} ${String(data.cascades.length)} cascades ${Str.Char.middleDot} head ${headLink}`
  output``

  // Status banner (if publishing/published/failed)
  if (state !== 'idle') {
    output(renderStatusBanner(state, github.owner, github.repo))
    output``
  }

  // Explainer toggle
  output(renderExplainer(data))
  output``

  output`---`
  output``

  // Primary releases
  if (data.releases.length > 0) {
    output`### Primary (${String(data.releases.length)})`
    output``

    const sorted = [...data.releases].sort((a, b) => b.commits.length - a.commits.length)
    for (const release of sorted) {
      output(renderReleaseItem(release))
      output``
    }
  }

  // Cascade releases
  if (data.cascades.length > 0) {
    output`### Cascades (${String(data.cascades.length)})`
    output``

    for (const cascade of data.cascades) {
      output(renderCascadeItem(cascade))
      output``
    }
  }

  // Tree visualization toggle
  output`<details><summary>Tree</summary>`
  output``
  output`\`\`\`text`
  output(renderTree(data))
  output`\`\`\``
  output``
  output`</details>`

  return output.render()
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

const renderReleaseItem = (
  release: EnrichedRelease,
): string => {
  const name = release.item.package.name.moniker
  const commitCount = release.commits.length
  const sourceLink = `[${Str.Char.blackSquare}](${release.sourceUrl})`
  const versionStr = release.item.nextVersion.toString()

  const lines: string[] = []

  // Main line: checkbox + source link + package name + commit count
  lines.push(`- [ ] ${sourceLink} **${name}** — ${commitCount} commit${commitCount === 1 ? '' : 's'}`)

  // Commit SHAs (indented)
  if (release.commits.length > 0) {
    lines.push(`  ${renderCommitShas(release.commits, 5)}`)
  }

  // Version line: PR version → stable projection
  const versionLine = renderVersionLine(versionStr, release)
  lines.push(`  ${versionLine}`)

  // Published versions (if any)
  if (release.publishedVersions.length > 0) {
    lines.push(`  published: ${renderPublishedVersions(release.publishedVersions, name)}`)
  }

  return lines.join(Str.Char.newline)
}

const renderCascadeItem = (
  cascade: EnrichedCascade,
): string => {
  const name = cascade.item.package.name.moniker
  const sourceLink = `[${Str.Char.blackSquare}](${cascade.sourceUrl})`
  const viaStr = cascade.via.length > 0 ? ` via \`${cascade.via.join('`, `')}\`` : ''
  const versionStr = cascade.item.nextVersion.toString()

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

const renderVersionLine = (prVersion: string, release: EnrichedRelease): string => {
  const projection = release.stableProjection
  if (!projection) {
    return `\`${prVersion}\``
  }

  const stableStr = projection.version.toString()
  const currentStr = Option.match(projection.current, {
    onNone: () => 'new',
    onSome: (v) => v.toString(),
  })
  return `\`${prVersion}\` ${Str.Char.rightwardsArrow} merged: **\`${stableStr}\`** ${projection.bump} (from ${currentStr})`
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

const renderExplainer = (data: CommentData): string => {
  const prNumber = data.github.prNumber
  const lines = [
    '<details><summary>How release calculation works</summary>',
    '',
    '**Primary** — packages with commits directly touching their source in this PR.',
    '**Cascade** — packages that depend on a primary release; re-published for consistency.',
    '',
    '| Context | Version Format | Example |',
    '| --- | --- | --- |',
    `| PR | \`0.0.0-pr.<pr>.<iter>.<sha>\` | \`0.0.0-pr.${prNumber}.1.${data.github.headSha.slice(0, 7)}\` |`,
    '| Stable | Semver bump from conventional commits | `0.2.0` |',
    '',
    'Bump rules: `feat()` → minor · `fix()` → patch · `!` → major',
    'Cascades inherit patch bump.',
    '',
    '</details>',
  ]
  return lines.join(Str.Char.newline)
}
