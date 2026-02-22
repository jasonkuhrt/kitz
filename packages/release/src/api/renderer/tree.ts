import { Str } from '@kitz/core'
import type { Forecast, ForecastCascade, ForecastRelease } from '../forecaster/models.js'

/**
 * Render a text tree visualization of a forecast.
 *
 * Box-drawing characters with dot-leaders for column alignment.
 * Primary items sorted by commit count descending, top N shown.
 */
export const renderTree = (forecast: Forecast, options?: { maxItems?: number }): string => {
  const maxItems = options?.maxItems ?? 0
  const totalPackages = forecast.releases.length + forecast.cascades.length
  const output = Str.Builder()

  output`release forecast ${Str.Char.middleDot} ${String(totalPackages)} packages`

  const hasCascades = forecast.cascades.length > 0
  const primaryPrefix = hasCascades ? '│  ' : '   '
  const primaryBranch = hasCascades ? '├─' : '└─'

  // Primary releases
  output`${primaryBranch} primary (${String(forecast.releases.length)})`

  const sorted = [...forecast.releases].sort((a, b) => b.commits.length - a.commits.length)
  const shown = maxItems > 0 ? sorted.slice(0, maxItems) : sorted
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
    output`└─ cascades (${String(forecast.cascades.length)})`

    for (let i = 0; i < forecast.cascades.length; i++) {
      const cascade = forecast.cascades[i]!
      const isLast = i === forecast.cascades.length - 1
      const branch = isLast ? '└─' : '├─'
      output`   ${branch} ${formatCascadeLine(cascade)}`
    }
  }

  return output.render()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatPrimaryLine = (release: ForecastRelease): string => {
  const name = release.packageName
  const commitCount = release.commits.length
  const latestCommit = release.commits[0]

  const countLabel = `${commitCount} commit${commitCount === 1 ? '' : 's'}`
  const commitSuffix = latestCommit
    ? `  ${latestCommit.shortSha} ${latestCommit.type}${latestCommit.breaking ? '!' : ''}: ${latestCommit.subject}`
    : ''

  return `${dotLeader(name, 24)} ${countLabel}${commitSuffix}`
}

const formatCascadeLine = (cascade: ForecastCascade): string => {
  const name = cascade.packageName
  const viaLabel = cascade.triggeredBy.length > 0
    ? `via ${cascade.triggeredBy.join(', ')}`
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
