import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release', 'executor'] as const
const ExecutorPublishErrorContext = S.Struct({
  /** Package that failed to publish */
  packageName: S.String,
  /** Details about the failure */
  detail: S.String,
})
const ExecutorTagErrorContext = S.Struct({
  /** Git tag that failed */
  tag: S.String,
  /** Details about the failure */
  detail: S.String,
})
const ExecutorPreflightErrorContext = S.Struct({
  /** Preflight check that failed */
  check: S.String,
  /** Details about the failure */
  detail: S.String,
})
const ExecutorGHReleaseErrorContext = S.Struct({
  /** Git tag for the release */
  tag: S.String,
  /** Details about the failure */
  detail: S.String,
})

/**
 * #### `ExecutorPublishError`
 *
 * Raised when artifact preparation or tarball publish fails for a specific package.
 *
 * **When it occurs**: during the Prepare or Publish activity for a single package. Other packages may prepare or publish successfully even if one fails.
 *
 * **Common causes**: `npm pack` failed, a pack hook mutated local files unexpectedly, the package version already exists on the registry, the npm token lacks publish permissions for this scope, or a network error interrupted tarball publish.
 *
 * **What to do**: check the error's `packageName` and `detail` fields. If the detail mentions manifest cleanup or pack hooks, inspect the package.json before retrying and run `release doctor --onlyRule plan.packages-runtime-targets-source-oriented`. If the version already exists, verify that the planned version does not collide with an existing published version. Fix the cause, then rerun release with the same plan so the durable workflow can resume from the failed activity.
 *
 * {@include executor/errors/publish-error}
 */
export const ExecutorPublishError: Err.TaggedContextualErrorClass<
  'ExecutorPublishError',
  typeof baseTags,
  typeof ExecutorPublishErrorContext,
  undefined
> = Err.TaggedContextualError('ExecutorPublishError', baseTags, {
  context: ExecutorPublishErrorContext,
  message: (ctx) => `Failed to publish ${ctx.packageName}: ${ctx.detail}`,
})

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
 * **What to do**: check the error's `tag` field to identify which tag failed. If the tag exists, delete it locally (`git tag -d <tag>`) and remotely (`git push origin :refs/tags/<tag>`) before retrying. Fix the cause, then rerun release with the same plan so the durable workflow can resume from the failed tag step.
 *
 * {@include executor/errors/tag-error}
 */
export const ExecutorTagError: Err.TaggedContextualErrorClass<
  'ExecutorTagError',
  typeof baseTags,
  typeof ExecutorTagErrorContext,
  undefined
> = Err.TaggedContextualError('ExecutorTagError', baseTags, {
  context: ExecutorTagErrorContext,
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
 * **Common causes**: the declared publish channel does not match the runtime, npm authentication is not configured, the git working directory has uncommitted changes, the git remote is unreachable, a planned tag already exists, or a planned package is still marked private.
 *
 * **What to do**: the error's `check` field names the specific preflight rule that failed (e.g., `env.npm-authenticated`). Run `release doctor --onlyRule "<check>"` to investigate in isolation.
 *
 * {@include executor/errors/preflight-error}
 */
export const ExecutorPreflightError: Err.TaggedContextualErrorClass<
  'ExecutorPreflightError',
  typeof baseTags,
  typeof ExecutorPreflightErrorContext,
  undefined
> = Err.TaggedContextualError('ExecutorPreflightError', baseTags, {
  context: ExecutorPreflightErrorContext,
  message: (ctx) => `Preflight check '${ctx.check}' failed: ${ctx.detail}`,
})

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
 * **What to do**: verify that `GITHUB_TOKEN` has `contents: write` permission. Fix the cause, then rerun release with the same plan so the durable workflow can resume from the failed GitHub release step. If needed, you can also create the release manually from the tag because the package is already published.
 *
 * {@include executor/errors/gh-release-error}
 */
export const ExecutorGHReleaseError: Err.TaggedContextualErrorClass<
  'ExecutorGHReleaseError',
  typeof baseTags,
  typeof ExecutorGHReleaseErrorContext,
  undefined
> = Err.TaggedContextualError('ExecutorGHReleaseError', baseTags, {
  context: ExecutorGHReleaseErrorContext,
  message: (ctx) => `Failed to create GitHub release for ${ctx.tag}: ${ctx.detail}`,
})

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
