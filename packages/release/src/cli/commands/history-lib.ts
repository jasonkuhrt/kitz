import { Str } from '@kitz/core'
import { Github } from '@kitz/github'
import { Effect } from 'effect'
import * as Commentator from '../../api/commentator/__.js'
import * as Explorer from '../../api/explorer/__.js'

export interface PreviewPublishSurface {
  readonly pullRequest: Pick<Github.PullRequest, 'number' | 'html_url'>
  readonly issueComment: Pick<Github.IssueComment, 'id' | 'html_url'>
  readonly metadata: Commentator.Metadata
}

export interface PreviewPublishReport {
  readonly pullRequestNumber: number
  readonly pullRequestUrl: string
  readonly commentId: number
  readonly commentUrl: string
  readonly headSha: string
  readonly publishState: Commentator.PublishState
  readonly totalPublishes: number
  readonly truncated: boolean
  readonly publishHistory: readonly Commentator.PublishRecord[]
}

export const resolvePreviewPublishSurface = (
  context: Explorer.ResolvedGitHubContext,
  options: {
    readonly prNumber?: number
  } = {},
) =>
  Effect.gen(function* () {
    const github = yield* Github.Github
    const pullRequest = yield* Explorer.resolvePullRequestFromContext({
      ...context,
      explicitPrNumber: options.prNumber ?? context.explicitPrNumber,
    })

    if (!pullRequest) {
      return yield* Effect.fail(
        new Explorer.ExplorerError({
          context: {
            detail:
              'Could not resolve an open pull request for release history. Set `--pr <number>` or PR_NUMBER explicitly, or run from a branch with an open pull request.',
          },
        }),
      )
    }

    const issueComment = yield* github.findIssueCommentByMarker(
      pullRequest.number,
      Commentator.PLAN_MARKER,
    )
    if (!issueComment?.body) {
      return yield* Effect.fail(
        new Explorer.ExplorerError({
          context: {
            detail:
              `No release preview comment with publish metadata was found for PR #${String(pullRequest.number)}. ` +
              'Run `release pr preview` first to create or refresh the preview surface.',
          },
        }),
      )
    }

    const metadata = Commentator.parseMetadata(issueComment.body)
    if (!metadata) {
      return yield* Effect.fail(
        new Explorer.ExplorerError({
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
  const orderedHistory = Commentator.orderPublishHistory(surface.metadata.publishHistory)
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
  const b = Str.Builder()
  b`Release preview publish status for PR #${String(report.pullRequestNumber)}`
  b`Pull request: ${report.pullRequestUrl}`
  b`Comment: ${report.commentUrl}`
  b`Head SHA: ${report.headSha || '(unknown)'}`
  b`Publish state: ${report.publishState}`

  if (report.totalPublishes === 0) {
    b`Publish history: (none)`
    return b.render()
  }

  b(
    report.truncated
      ? `Publish history (showing ${String(report.publishHistory.length)} of ${String(report.totalPublishes)}):`
      : `Publish history (${String(report.totalPublishes)}):`,
  )

  for (const record of report.publishHistory) {
    b`- ${record.timestamp} ${record.package}@${record.version} (iteration ${String(record.iteration)}, run ${record.runId}, sha ${record.sha})`
  }

  return b.render()
}
