import { Str } from '@kitz/core'
import type { CommentData, EnrichedCascade, EnrichedRelease } from './comment-data.js'

/**
 * Render a text tree visualization of the release plan.
 *
 * Box-drawing characters with dot-leaders for column alignment.
 * Primary items sorted by commit count descending, top N shown.
 */
export const renderTree = (data: CommentData, options?: { maxItems?: number }): string => {
  const maxItems = options?.maxItems ?? 5
  const totalPackages = data.releases.length + data.cascades.length
  const output = Str.Builder()

  output`${data.planType} release plan · ${String(totalPackages)} packages`

  const hasCascades = data.cascades.length > 0
  const primaryPrefix = hasCascades ? '│  ' : '   '
  const primaryBranch = hasCascades ? '├─' : '└─'

  // Primary releases
  output`${primaryBranch} primary (${String(data.releases.length)})`

  const sorted = [...data.releases].sort((a, b) => b.commits.length - a.commits.length)
  const shown = sorted.slice(0, maxItems)
  const remaining = sorted.length - shown.length

  for (let i = 0; i < shown.length; i++) {
    const release = shown[i]!
    const isLast = i === shown.length - 1 && remaining === 0 && !hasCascades
    const branch = isLast ? '└─' : '├─'
    output`${primaryPrefix}${branch} ${formatPrimaryLine(release)}`
  }

  if (remaining > 0) {
    output`${primaryPrefix}   ... ${String(remaining)} more`
  }

  // Cascades
  if (hasCascades) {
    output`│`
    output`└─ cascades (${String(data.cascades.length)})`

    for (let i = 0; i < data.cascades.length; i++) {
      const cascade = data.cascades[i]!
      const isLast = i === data.cascades.length - 1
      const branch = isLast ? '└─' : '├─'
      output`   ${branch} ${formatCascadeLine(cascade)}`
    }
  }

  return output.render()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatPrimaryLine = (release: EnrichedRelease): string => {
  const name = release.item.package.name.moniker
  const commitCount = release.commits.length
  const latestCommit = release.commits[0]

  const countLabel = `${commitCount} commit${commitCount === 1 ? '' : 's'}`
  const commitSuffix = latestCommit
    ? `  ${latestCommit.shortSha} ${latestCommit.type}${latestCommit.breaking ? '!' : ''}: ${latestCommit.subject}`
    : ''

  return `${dotLeader(name, 24)} ${countLabel}${commitSuffix}`
}

const formatCascadeLine = (cascade: EnrichedCascade): string => {
  const name = cascade.item.package.name.moniker
  const viaLabel = cascade.via.length > 0
    ? `via ${cascade.via.join(', ')}`
    : 'cascade'
  return `${dotLeader(name, 24)} ${viaLabel}`
}

/**
 * Pad a string with dot-leaders to reach a target width.
 */
const dotLeader = (text: string, width: number): string => {
  const padding = Math.max(2, width - text.length)
  return `${text} ${Str.Char.middleDot.repeat(padding)}`
}
