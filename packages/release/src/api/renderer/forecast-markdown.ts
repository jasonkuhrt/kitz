import { Str } from '@kitz/core'
import { Option } from 'effect'
import type { PublishRecord, PublishState } from '../commentator/metadata.js'
import type { Forecast, ForecastCascade, ForecastRelease } from '../forecaster/models.js'

export interface RenderForecastMarkdownOptions {
  readonly publishState?: PublishState
  readonly publishHistory?: readonly PublishRecord[]
}

export const renderForecastMarkdown = (
  forecast: Forecast,
  options?: RenderForecastMarkdownOptions,
): string => {
  const publishState = options?.publishState ?? 'idle'
  const publishHistory = options?.publishHistory ?? []
  const totalPackages = forecast.releases.length + forecast.cascades.length
  const output = Str.Builder()

  output`## Release Forecast`
  output``
  output`${String(totalPackages)} packages ${Str.Char.middleDot} ${String(
    forecast.releases.length,
  )} primary ${Str.Char.middleDot} ${String(forecast.cascades.length)} cascades ${Str.Char.middleDot} head ${renderHeadLink(
    forecast,
  )}`

  if (publishState !== 'idle' || publishHistory.length > 0) {
    output``
    output`- Publish state: \`${publishState}\``
    if (publishHistory.length > 0) {
      output`- Publish history:`
      for (const record of publishHistory) {
        output`  - \`${record.package}@${record.version}\` ${renderPublishRecord(record)}`
      }
    }
  }

  if (forecast.releases.length > 0) {
    output``
    output`### Primary (${String(forecast.releases.length)})`
    output``

    const sortedReleases = [...forecast.releases].sort((a, b) => {
      const commitDelta = b.commits.length - a.commits.length
      if (commitDelta !== 0) return commitDelta
      return a.packageName.localeCompare(b.packageName)
    })

    for (const release of sortedReleases) {
      output(renderPrimaryRelease(release))
    }
  }

  if (forecast.cascades.length > 0) {
    output``
    output`### Cascades (${String(forecast.cascades.length)})`
    output``

    const sortedCascades = [...forecast.cascades].sort((a, b) =>
      a.packageName.localeCompare(b.packageName),
    )

    for (const cascade of sortedCascades) {
      output(renderCascadeRelease(cascade))
    }
  }

  return output.render()
}

const renderHeadLink = (forecast: Forecast): string =>
  `[\`${forecast.headSha.slice(0, 7)}\`](https://github.com/${forecast.owner}/${forecast.repo}/commit/${forecast.headSha})`

const renderPrimaryRelease = (release: ForecastRelease): string => {
  const lines = [
    `- [${release.packageName}](${release.sourceUrl}) \`${release.currentVersionDisplay}\` -> \`${release.nextOfficialVersion.toString()}\` (\`${release.bump}\`, ${String(
      release.commits.length,
    )} commit${release.commits.length === 1 ? '' : 's'})`,
    ...release.commits.map(
      (commit) =>
        `  - [\`${commit.shortSha}\`](${commit.commitUrl}) ${commit.type}${commit.breaking ? '!' : ''}: ${commit.subject}`,
    ),
  ]

  return lines.join('\n')
}

const renderCascadeRelease = (cascade: ForecastCascade): string => {
  const via = cascade.triggeredBy.length > 0 ? ` via \`${cascade.triggeredBy.join('`, `')}\`` : ''
  const currentVersion = Option.match(cascade.currentVersion, {
    onNone: () => 'new',
    onSome: (version) => version.toString(),
  })
  return `- [${cascade.packageName}](${cascade.sourceUrl}) \`${currentVersion}\` -> \`${cascade.nextOfficialVersion.toString()}\`${via}`
}

const renderPublishRecord = (record: PublishRecord): string =>
  `iteration ${String(record.iteration)} ${Str.Char.middleDot} sha \`${record.sha.slice(
    0,
    7,
  )}\` ${Str.Char.middleDot} run \`${record.runId}\``
