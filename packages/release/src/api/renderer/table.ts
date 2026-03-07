import { Str } from '@kitz/core'
import { Option } from 'effect'
import type { Forecast, ForecastCascade, ForecastRelease } from '../forecaster/models.js'
import { renderTableText } from './table-core.js'

export interface RenderTableOptions {
  readonly maxItems?: number
}

/**
 * Render a tabular forecast view for scan-heavy CLI usage.
 *
 * Primary releases are sorted by commit count descending, then package name.
 * Cascades are sorted alphabetically by package name.
 */
export const renderTable = (forecast: Forecast, options?: RenderTableOptions): string => {
  const maxItems = options?.maxItems ?? 0
  const sortedPrimary = [...forecast.releases].sort(compareForecastReleaseRows)
  const primary = maxItems > 0 ? sortedPrimary.slice(0, maxItems) : sortedPrimary
  const remainingPrimary = sortedPrimary.length - primary.length
  const cascades = [...forecast.cascades].sort((a, b) => a.packageName.localeCompare(b.packageName))
  const totalPackages = forecast.releases.length + forecast.cascades.length

  const output = Str.Builder()
  output`release forecast ${Str.Char.middleDot} ${String(totalPackages)} packages`

  output``
  output`Primary (${String(forecast.releases.length)})`
  output``
  output`${renderTableText([
    ['Package', 'From', 'To', 'Bump', 'Commits'],
    ...primary.map(formatPrimaryRow),
  ])}`

  if (remainingPrimary > 0) {
    output``
    output`... ${String(remainingPrimary)} more primary release${remainingPrimary === 1 ? '' : 's'}`
  }

  if (cascades.length > 0) {
    output``
    output`Cascades (${String(cascades.length)})`
    output``
    output`${renderTableText([
      ['Package', 'From', 'To', 'Triggered By'],
      ...cascades.map(formatCascadeRow),
    ])}`
  }

  return output.render()
}

const compareForecastReleaseRows = (a: ForecastRelease, b: ForecastRelease): number => {
  const commitDelta = b.commits.length - a.commits.length
  if (commitDelta !== 0) return commitDelta

  return a.packageName.localeCompare(b.packageName)
}

const formatPrimaryRow = (release: ForecastRelease): string[] => {
  return [
    release.packageName,
    release.currentVersionDisplay,
    release.nextOfficialVersion.toString(),
    release.bump,
    String(release.commits.length),
  ]
}

const formatCascadeRow = (cascade: ForecastCascade): string[] => {
  return [
    cascade.packageName,
    Option.match(cascade.currentVersion, {
      onNone: () => 'new',
      onSome: (version) => version.toString(),
    }),
    cascade.nextOfficialVersion.toString(),
    cascade.triggeredBy.length > 0 ? cascade.triggeredBy.join(', ') : 'cascade',
  ]
}
