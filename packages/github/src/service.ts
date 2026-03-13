import { Err } from '@kitz/core'
import type { Endpoints } from '@octokit/types'
import { Effect, Schema as S, ServiceMap } from 'effect'

// ============================================================================
// Types from @octokit/types
// ============================================================================

/** GitHub release from API response */
export type Release = Endpoints['GET /repos/{owner}/{repo}/releases/tags/{tag}']['response']['data']

/** Minimal pull request shape needed by release tooling. */
export interface PullRequest {
  readonly number: number
  readonly html_url: string
  readonly title: string
  readonly body: string | null
  readonly base: {
    readonly ref: string
  }
  readonly head: {
    readonly ref: string
  }
}

/** Minimal GitHub issue comment shape needed by release tooling. */
export interface IssueComment {
  readonly id: number
  readonly body: string | null
  readonly html_url: string
  readonly user?: {
    readonly type?: string
  } | null
}

/** Parameters for creating a release */
export interface CreateReleaseParams {
  readonly tag: string
  readonly title: string
  readonly body: string
  readonly prerelease?: boolean
}

/** Parameters for updating a release */
export interface UpdateReleaseParams {
  readonly body: string
}

/** Parameters for updating a pull request */
export interface UpdatePullRequestParams {
  readonly title?: string
  readonly body?: string | null
}

/** Parameters for creating a pull-request issue comment. */
export interface CreateIssueCommentParams {
  readonly issueNumber: number
  readonly body: string
}

/** Parameters for updating an issue comment. */
export interface UpdateIssueCommentParams {
  readonly body: string
}

/** Parameters for upserting a pull-request issue comment by marker. */
export interface UpsertIssueCommentParams {
  readonly issueNumber: number
  readonly body: string
  readonly marker: string
  /** Optional known marker comment to update without re-scanning comments. */
  readonly existingComment?: IssueComment | null
}

// ============================================================================
// Operations
// ============================================================================

/**
 * GitHub operation names for structured error context.
 */
export type GithubOperation =
  | 'releaseExists'
  | 'createRelease'
  | 'updateRelease'
  | 'getRelease'
  | 'listOpenPullRequests'
  | 'updatePullRequest'
  | 'listIssueComments'
  | 'createIssueComment'
  | 'updateIssueComment'

const GithubOperationSchema = S.Literals([
  'releaseExists',
  'createRelease',
  'updateRelease',
  'getRelease',
  'listOpenPullRequests',
  'updatePullRequest',
  'listIssueComments',
  'createIssueComment',
  'updateIssueComment',
])
const ErrorCause = S.instanceOf(Error)

// ============================================================================
// Errors
// ============================================================================

const baseTags = ['kit', 'github'] as const
const GithubErrorContext = S.Struct({
  operation: GithubOperationSchema,
  status: S.optional(S.Number),
  detail: S.optional(S.String),
})
const GithubNotFoundErrorContext = S.Struct({
  operation: GithubOperationSchema,
  resource: S.String,
})
const GithubRateLimitErrorContext = S.Struct({
  operation: GithubOperationSchema,
  resetAt: S.Date,
})
const GithubAuthErrorContext = S.Struct({
  operation: GithubOperationSchema,
})
const GithubConfigErrorContext = S.Struct({
  detail: S.String,
})

/**
 * Generic GitHub API error.
 */
export const GithubError: Err.TaggedContextualErrorClass<
  'GithubError',
  typeof baseTags,
  typeof GithubErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('GithubError', baseTags, {
  context: GithubErrorContext,
  message: (ctx) =>
    `GitHub ${ctx.operation} failed${ctx.status ? ` (${ctx.status})` : ''}${ctx.detail ? `: ${ctx.detail}` : ''}`,
  cause: ErrorCause,
})

export type GithubError = InstanceType<typeof GithubError>

/**
 * GitHub resource not found (404).
 */
export const GithubNotFoundError: Err.TaggedContextualErrorClass<
  'GithubNotFoundError',
  typeof baseTags,
  typeof GithubNotFoundErrorContext,
  undefined
> = Err.TaggedContextualError('GithubNotFoundError', baseTags, {
  context: GithubNotFoundErrorContext,
  message: (ctx) => `GitHub ${ctx.operation}: ${ctx.resource} not found`,
})

export type GithubNotFoundError = InstanceType<typeof GithubNotFoundError>

/**
 * GitHub rate limit exceeded (403 with rate limit headers).
 */
export const GithubRateLimitError: Err.TaggedContextualErrorClass<
  'GithubRateLimitError',
  typeof baseTags,
  typeof GithubRateLimitErrorContext,
  undefined
> = Err.TaggedContextualError('GithubRateLimitError', baseTags, {
  context: GithubRateLimitErrorContext,
  message: (ctx) =>
    `GitHub ${ctx.operation}: rate limit exceeded, resets at ${ctx.resetAt.toISOString()}`,
})

export type GithubRateLimitError = InstanceType<typeof GithubRateLimitError>

/**
 * GitHub authentication error (401).
 */
export const GithubAuthError: Err.TaggedContextualErrorClass<
  'GithubAuthError',
  typeof baseTags,
  typeof GithubAuthErrorContext,
  undefined
> = Err.TaggedContextualError('GithubAuthError', baseTags, {
  context: GithubAuthErrorContext,
  message: (ctx) => `GitHub ${ctx.operation}: authentication failed, check GITHUB_TOKEN`,
})

export type GithubAuthError = InstanceType<typeof GithubAuthError>

/**
 * Configuration error (missing token, invalid config).
 */
export const GithubConfigError: Err.TaggedContextualErrorClass<
  'GithubConfigError',
  typeof baseTags,
  typeof GithubConfigErrorContext,
  undefined
> = Err.TaggedContextualError('GithubConfigError', baseTags, {
  context: GithubConfigErrorContext,
  message: (ctx) => `GitHub configuration error: ${ctx.detail}`,
})

export type GithubConfigError = InstanceType<typeof GithubConfigError>

// ============================================================================
// Service Interface
// ============================================================================

/**
 * GitHub service interface.
 */
export interface GithubService {
  /**
   * Check if a release exists for the given tag.
   */
  readonly releaseExists: (
    tag: string,
  ) => Effect.Effect<boolean, GithubError | GithubAuthError | GithubRateLimitError>

  /**
   * Create a new GitHub release.
   */
  readonly createRelease: (
    params: CreateReleaseParams,
  ) => Effect.Effect<Release, GithubError | GithubAuthError | GithubRateLimitError>

  /**
   * Update an existing GitHub release.
   */
  readonly updateRelease: (
    tag: string,
    params: UpdateReleaseParams,
  ) => Effect.Effect<
    Release,
    GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError
  >

  /**
   * List open pull requests for the configured repository.
   */
  readonly listOpenPullRequests: () => Effect.Effect<
    readonly PullRequest[],
    GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError
  >

  /**
   * Update an open pull request.
   */
  readonly updatePullRequest: (
    number: number,
    params: UpdatePullRequestParams,
  ) => Effect.Effect<
    PullRequest,
    GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError
  >

  /**
   * List comments for a pull request issue.
   */
  readonly listIssueComments: (
    issueNumber: number,
  ) => Effect.Effect<
    readonly IssueComment[],
    GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError
  >

  /**
   * Find the first bot-owned marker comment on a pull request issue.
   */
  readonly findIssueCommentByMarker: (
    issueNumber: number,
    marker: string,
  ) => Effect.Effect<
    IssueComment | null,
    GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError
  >

  /**
   * Create a comment on a pull request issue.
   */
  readonly createIssueComment: (
    params: CreateIssueCommentParams,
  ) => Effect.Effect<IssueComment, GithubError | GithubAuthError | GithubRateLimitError>

  /**
   * Update an existing issue comment.
   */
  readonly updateIssueComment: (
    commentId: number,
    params: UpdateIssueCommentParams,
  ) => Effect.Effect<
    IssueComment,
    GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError
  >

  /**
   * Update the existing marker comment or create a new one.
   */
  readonly upsertIssueComment: (
    params: UpsertIssueCommentParams,
  ) => Effect.Effect<
    IssueComment,
    GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError
  >
}

// ============================================================================
// Service Tag
// ============================================================================

/**
 * GitHub service tag.
 */
export class Github extends ServiceMap.Service<Github, GithubService>()('Github') {}
