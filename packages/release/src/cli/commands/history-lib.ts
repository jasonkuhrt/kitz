import { Github } from '@kitz/github'
import { Effect } from 'effect'
import * as Api from '../../api/__.js'

export interface PreviewPublishSurface {
  readonly pullRequest: Pick<Github.PullRequest, 'number' | 'html_url'>
  readonly issueComment: Pick<Github.IssueComment, 'id' | 'html_url'>
  readonly metadata: Api.Commentator.Metadata
}

export interface PreviewPublishReport {
  readonly pullRequestNumber: number
  readonly pullRequestUrl: string
  readonly commentId: number
  readonly commentUrl: string
  readonly headSha: string
  readonly publishState: Api.Commentator.PublishState
  readonly totalPublishes: number
  readonly truncated: boolean
  readonly publishHistory: readonly Api.Commentator.PublishRecord[]
}

export const parsePositiveIntegerOption = (
  value: string | undefined,
  label: string,
): Effect.Effect<number | undefined, Api.Explorer.ExplorerError> =>
  Effect.gen(function* () {
    if (value === undefined) return undefined

    const normalized = value.trim()
    if (normalized.length === 0) {
      return yield* Effect.fail(
        new Api.Explorer.ExplorerError({
          context: {
            detail: `Expected --${label} to be a positive integer, but received an empty value.`,
          },
        }),
      )
    }

    const parsed = Number.parseInt(normalized, 10)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return yield* Effect.fail(
        new Api.Explorer.ExplorerError({
          context: {
            detail: `Expected --${label} to be a positive integer, but received "${value}".`,
          },
        }),
      )
    }

    return parsed
  })

export const resolvePreviewPublishSurface = (
  context: Api.Explorer.ResolvedGitHubContext,
  options: {
    readonly prNumber?: number
  } = {},
) =>
  Effect.gen(function* () {
    const github = yield* Github.Github
    const pullRequest = yield* Api.Explorer.resolvePullRequestFromContext({
      ...context,
      explicitPrNumber: options.prNumber ?? context.explicitPrNumber,
    })

    if (!pullRequest) {
      return yield* Effect.fail(
        new Api.Explorer.ExplorerError({
          context: {
            detail:
              'Could not resolve an open pull request for release history. Set `--pr <number>` or PR_NUMBER explicitly, or run from a branch with an open pull request.',
          },
        }),
      )
    }

    const issueComment = yield* github.findIssueCommentByMarker(
      pullRequest.number,
      Api.Commentator.PLAN_MARKER,
    )
    if (!issueComment?.body) {
      return yield* Effect.fail(
        new Api.Explorer.ExplorerError({
          context: {
            detail:
              `No release preview comment with publish metadata was found for PR #${String(pullRequest.number)}. ` +
              'Run `release pr preview` first to create or refresh the preview surface.',
          },
        }),
      )
    }

    const metadata = Api.Commentator.parseMetadata(issueComment.body)
    if (!metadata) {
      return yield* Effect.fail(
        new Api.Explorer.ExplorerError({
          context: {
            detail: `Release preview comment for PR #${String(pullRequest.number)} did not contain readable publish metadata.`,
          },
        }),
      )
    }

    return {
      pullRequest: {
        number: pullRequest.number,
        html_url: pullRequest.html_url,
      },
      issueComment: {
        id: issueComment.id,
        html_url: issueComment.html_url,
      },
      metadata,
    } satisfies PreviewPublishSurface
  })

export const toPreviewPublishReport = (
  surface: PreviewPublishSurface,
  options: {
    readonly limit?: number
  } = {},
): PreviewPublishReport => {
  const orderedHistory = Api.Commentator.orderPublishHistory(surface.metadata.publishHistory)
  const publishHistory =
    options.limit === undefined ? orderedHistory : orderedHistory.slice(0, options.limit)

  return {
    pullRequestNumber: surface.pullRequest.number,
    pullRequestUrl: surface.pullRequest.html_url,
    commentId: surface.issueComment.id,
    commentUrl: surface.issueComment.html_url,
    headSha: surface.metadata.headSha,
    publishState: surface.metadata.publishState,
    totalPublishes: orderedHistory.length,
    truncated: publishHistory.length < orderedHistory.length,
    publishHistory,
  }
}

export const renderPreviewPublishReport = (report: PreviewPublishReport): string => {
  const lines = [
    `Release preview publish status for PR #${String(report.pullRequestNumber)}`,
    `Pull request: ${report.pullRequestUrl}`,
    `Comment: ${report.commentUrl}`,
    `Head SHA: ${report.headSha || '(unknown)'}`,
    `Publish state: ${report.publishState}`,
  ]

  if (report.totalPublishes === 0) {
    lines.push('Publish history: (none)')
    return lines.join('\n')
  }

  lines.push(
    report.truncated
      ? `Publish history (showing ${String(report.publishHistory.length)} of ${String(report.totalPublishes)}):`
      : `Publish history (${String(report.totalPublishes)}):`,
  )

  for (const record of report.publishHistory) {
    lines.push(
      `- ${record.timestamp} ${record.package}@${record.version} (iteration ${String(record.iteration)}, run ${record.runId}, sha ${record.sha})`,
    )
  }

  return lines.join('\n')
}
