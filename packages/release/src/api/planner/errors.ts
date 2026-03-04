import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release'] as const

/**
 * #### `ReleaseError`
 * 
 * Raised when the Planner cannot construct a valid plan.
 * 
 * **When it occurs**: during `plan()` or `apply()` operations.
 * 
 * **Common causes**:
 * 
 * - **Ephemeral lifecycle without a PR number**: ephemeral versions require a PR number to construct the `0.0.0-pr.<N>` version. If no PR number can be detected from environment variables (`GITHUB_PR_NUMBER`, `PR_NUMBER`, `CI_PULL_REQUEST`) and none is passed explicitly, planning fails.
 * 
 * **What to do**: set `PR_NUMBER` or `GITHUB_PR_NUMBER` in your environment, or pass `prNumber` directly to the ephemeral planner options.
 *
 * {@include planner/errors/release-error}
 */
export const ReleaseError = Err.TaggedContextualError('ReleaseError', baseTags, {
  context: S.Struct({
    operation: S.Literal('plan', 'apply', 'tag'),
    detail: S.optional(S.String),
  }),
  message: (ctx) =>
    ctx.detail ? `Failed to ${ctx.operation} release: ${ctx.detail}` : `Failed to ${ctx.operation} release`,
})

export type ReleaseError = InstanceType<typeof ReleaseError>

/** Union of all planner errors. */
export type All = ReleaseError
