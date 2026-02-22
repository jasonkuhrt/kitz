import { Err } from '@kitz/core'
import type { Endpoints } from '@octokit/types'
import { Context, Effect, Schema as S } from 'effect'

// ============================================================================
// Types from @octokit/types
// ============================================================================

/** GitHub release from API response */
export type Release = Endpoints['GET /repos/{owner}/{repo}/releases/tags/{tag}']['response']['data']

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

// ============================================================================
// Operations
// ============================================================================

/**
 * GitHub operation names for structured error context.
 */
export type GithubOperation = 'releaseExists' | 'createRelease' | 'updateRelease' | 'getRelease'

const GithubOperationSchema = S.Literal('releaseExists', 'createRelease', 'updateRelease', 'getRelease')

// ============================================================================
// Errors
// ============================================================================

const baseTags = ['kit', 'github'] as const

/**
 * Generic GitHub API error.
 */
export const GithubError = Err.TaggedContextualError('GithubError', baseTags, {
  context: S.Struct({
    operation: GithubOperationSchema,
    status: S.optional(S.Number),
    detail: S.optional(S.String),
  }),
  message: (ctx) =>
    `GitHub ${ctx.operation} failed${ctx.status ? ` (${ctx.status})` : ''}${ctx.detail ? `: ${ctx.detail}` : ''}`,
  cause: S.instanceOf(Error),
})

export type GithubError = InstanceType<typeof GithubError>

/**
 * GitHub resource not found (404).
 */
export const GithubNotFoundError = Err.TaggedContextualError('GithubNotFoundError', baseTags, {
  context: S.Struct({
    operation: GithubOperationSchema,
    resource: S.String,
  }),
  message: (ctx) => `GitHub ${ctx.operation}: ${ctx.resource} not found`,
})

export type GithubNotFoundError = InstanceType<typeof GithubNotFoundError>

/**
 * GitHub rate limit exceeded (403 with rate limit headers).
 */
export const GithubRateLimitError = Err.TaggedContextualError('GithubRateLimitError', baseTags, {
  context: S.Struct({
    operation: GithubOperationSchema,
    resetAt: S.Date,
  }),
  message: (ctx) => `GitHub ${ctx.operation}: rate limit exceeded, resets at ${ctx.resetAt.toISOString()}`,
})

export type GithubRateLimitError = InstanceType<typeof GithubRateLimitError>

/**
 * GitHub authentication error (401).
 */
export const GithubAuthError = Err.TaggedContextualError('GithubAuthError', baseTags, {
  context: S.Struct({
    operation: GithubOperationSchema,
  }),
  message: (ctx) => `GitHub ${ctx.operation}: authentication failed, check GITHUB_TOKEN`,
})

export type GithubAuthError = InstanceType<typeof GithubAuthError>

/**
 * Configuration error (missing token, invalid config).
 */
export const GithubConfigError = Err.TaggedContextualError('GithubConfigError', baseTags, {
  context: S.Struct({
    detail: S.String,
  }),
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
  ) => Effect.Effect<Release, GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError>
}

// ============================================================================
// Service Tag
// ============================================================================

/**
 * GitHub service tag.
 */
export class Github extends Context.Tag('Github')<Github, GithubService>() {}
