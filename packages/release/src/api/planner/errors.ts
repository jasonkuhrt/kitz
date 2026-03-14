import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release'] as const
const ReleaseErrorContext = S.Struct({
  operation: S.Literals(['plan', 'apply', 'tag']),
  detail: S.optional(S.String),
})

/**
 * #### `ReleaseError`
 *
 * Raised when the Planner cannot construct a valid plan.
 *
 * **When it occurs**: during `plan()` or `apply()` operations.
 *
 * **Common causes**:
 *
 * - **Ephemeral lifecycle without a PR number**: ephemeral versions require a PR number to construct the `0.0.0-pr.<N>` version. If no PR number can be detected from environment variables or from an open pull request connected to the current branch, and none is passed explicitly, planning fails.
 *
 * **What to do**: set `PR_NUMBER` or `GITHUB_PR_NUMBER` in your environment, or pass `prNumber` directly to the ephemeral planner options. If the branch maps to more than one open pull request, close the extras or set the PR number explicitly.
 *
 * {@include planner/errors/release-error}
 */
export const ReleaseError: Err.TaggedContextualErrorClass<
  'ReleaseError',
  typeof baseTags,
  typeof ReleaseErrorContext,
  undefined
> = Err.TaggedContextualError('ReleaseError', baseTags, {
  context: ReleaseErrorContext,
  message: (ctx) =>
    ctx.detail
      ? `Failed to ${ctx.operation} release: ${ctx.detail}`
      : `Failed to ${ctx.operation} release`,
})

export type ReleaseError = InstanceType<typeof ReleaseError>

/** Union of all planner errors. */
export type All = ReleaseError
