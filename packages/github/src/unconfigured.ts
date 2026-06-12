import { Effect, Layer } from 'effect'
import { Github, GithubError, type GithubOperation, type GithubService } from './service.js'

// ============================================================================
// Config
// ============================================================================

/**
 * Configuration for the unconfigured GitHub service.
 */
export interface GithubUnconfiguredConfig {
  /**
   * Extra guidance appended to every error, telling the operator how to
   * provide a configured GitHub service in their context.
   */
  readonly detail?: string
}

const DEFAULT_DETAIL =
  'GitHub service is not configured. Provide a configured Github layer (e.g. Github.LiveFetch) before performing GitHub operations.'

// ============================================================================
// Service Implementation
// ============================================================================

const failUnconfigured = (operation: GithubOperation, detail: string) =>
  Effect.fail(
    new GithubError({
      context: { operation, detail },
      cause: new Error('GitHub service is not configured'),
    }),
  )

/**
 * Create a GitHub service implementation where every operation fails with a
 * typed {@link GithubError} naming the attempted operation.
 */
const makeService = (config: GithubUnconfiguredConfig = {}): GithubService => {
  const detail = config.detail ?? DEFAULT_DETAIL

  return {
    releaseExists: () => failUnconfigured('releaseExists', detail),
    createRelease: () => failUnconfigured('createRelease', detail),
    updateRelease: () => failUnconfigured('updateRelease', detail),
    listOpenPullRequests: () => failUnconfigured('listOpenPullRequests', detail),
    updatePullRequest: () => failUnconfigured('updatePullRequest', detail),
    listIssueComments: () => failUnconfigured('listIssueComments', detail),
    findIssueCommentByMarker: () => failUnconfigured('findIssueCommentByMarker', detail),
    createIssueComment: () => failUnconfigured('createIssueComment', detail),
    updateIssueComment: () => failUnconfigured('updateIssueComment', detail),
    upsertIssueComment: () => failUnconfigured('upsertIssueComment', detail),
  }
}

// ============================================================================
// Layer
// ============================================================================

/**
 * Create a GitHub layer for contexts where GitHub is intentionally not
 * configured.
 *
 * Every operation fails with a typed {@link GithubError} whose context names
 * the operation that was attempted, so callers get a precise, actionable
 * error instead of a missing-service defect.
 *
 * @example
 * ```ts
 * const layer = github !== undefined
 *   ? Github.LiveFetch(github)
 *   : Github.Unconfigured.make({ detail: 'Pass github config to enable releases.' })
 * ```
 */
export const make = (config: GithubUnconfiguredConfig = {}): Layer.Layer<Github> =>
  Layer.succeed(Github, makeService(config))

/**
 * Unconfigured GitHub layer with the default guidance message.
 */
export const layer: Layer.Layer<Github> = make()
