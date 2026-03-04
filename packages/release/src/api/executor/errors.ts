import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release', 'executor'] as const

/**
 * #### `ExecutorPublishError`
 *
 * Raised when `npm publish` fails for a specific package.
 *
 * **When it occurs**: during the Publish activity for a single package. Other packages may publish successfully even if one fails.
 *
 * **Common causes**: the package version already exists on the registry, the npm token lacks publish permissions for this scope, or a network error interrupted the publish.
 *
 * **What to do**: check the error's `packageName` and `detail` fields. If the version already exists, this may indicate a duplicate release attempt — verify that the planned version does not collide with an existing published version. The Executor retries publish failures twice before surfacing the error.
 *
 * {@include executor/errors/publish-error}
 */
export const ExecutorPublishError = Err.TaggedContextualError(
  'ExecutorPublishError',
  baseTags,
  {
    context: S.Struct({
      /** Package that failed to publish */
      packageName: S.String,
      /** Details about the failure */
      detail: S.String,
    }),
    message: (ctx) => `Failed to publish ${ctx.packageName}: ${ctx.detail}`,
  },
)

export type ExecutorPublishError = InstanceType<typeof ExecutorPublishError>

/**
 * #### `ExecutorTagError`
 *
 * Raised when git tag creation or tag pushing fails.
 *
 * **When it occurs**: after a package has been successfully published, during the CreateTag or PushTag activity.
 *
 * **Common causes**: the tag already exists locally or on the remote, or the git push is rejected (e.g., branch protection rules, insufficient permissions).
 *
 * **What to do**: check the error's `tag` field to identify which tag failed. If the tag exists, delete it locally (`git tag -d <tag>`) and remotely (`git push origin :refs/tags/<tag>`) before retrying. Tag push failures are retried twice.
 *
 * {@include executor/errors/tag-error}
 */
export const ExecutorTagError = Err.TaggedContextualError('ExecutorTagError', baseTags, {
  context: S.Struct({
    /** Git tag that failed */
    tag: S.String,
    /** Details about the failure */
    detail: S.String,
  }),
  message: (ctx) => `Failed to create/push tag ${ctx.tag}: ${ctx.detail}`,
})

export type ExecutorTagError = InstanceType<typeof ExecutorTagError>

/**
 * #### `ExecutorPreflightError`
 *
 * Raised when a preflight check fails before any publishing begins.
 *
 * **When it occurs**: at the start of execution, before any packages are published.
 *
 * **Common causes**: npm authentication is not configured, the git working directory has uncommitted changes, the git remote is unreachable, or a planned tag already exists.
 *
 * **What to do**: the error's `check` field names the specific preflight rule that failed (e.g., `env.npm-authenticated`). Run `release lint --only-rule "<check>"` to investigate in isolation.
 *
 * {@include executor/errors/preflight-error}
 */
export const ExecutorPreflightError = Err.TaggedContextualError(
  'ExecutorPreflightError',
  baseTags,
  {
    context: S.Struct({
      /** Preflight check that failed */
      check: S.String,
      /** Details about the failure */
      detail: S.String,
    }),
    message: (ctx) => `Preflight check '${ctx.check}' failed: ${ctx.detail}`,
  },
)

export type ExecutorPreflightError = InstanceType<typeof ExecutorPreflightError>

/**
 * #### `ExecutorGHReleaseError`
 *
 * Raised when creating a GitHub release fails.
 *
 * **When it occurs**: after a tag has been successfully pushed, during the CreateGHRelease activity. The package is already published and tagged at this point.
 *
 * **Common causes**: the GitHub token lacks permission to create releases, or the GitHub API is unavailable.
 *
 * **What to do**: verify that `GITHUB_TOKEN` has `contents: write` permission. GitHub release creation is retried twice. If the release still fails, you can create it manually from the tag — the package is already published.
 *
 * {@include executor/errors/gh-release-error}
 */
export const ExecutorGHReleaseError = Err.TaggedContextualError(
  'ExecutorGHReleaseError',
  baseTags,
  {
    context: S.Struct({
      /** Git tag for the release */
      tag: S.String,
      /** Details about the failure */
      detail: S.String,
    }),
    message: (ctx) => `Failed to create GitHub release for ${ctx.tag}: ${ctx.detail}`,
  },
)

export type ExecutorGHReleaseError = InstanceType<typeof ExecutorGHReleaseError>

/**
 * Schema union of all executor errors.
 *
 * Used by the workflow module to define the error channel of the release workflow.
 */
export const ExecutorError = S.Union(
  ExecutorPublishError,
  ExecutorTagError,
  ExecutorPreflightError,
  ExecutorGHReleaseError,
)

export type ExecutorError =
  | ExecutorPublishError
  | ExecutorTagError
  | ExecutorPreflightError
  | ExecutorGHReleaseError

/** Union of all executor errors */
export type All = ExecutorError
