import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release', 'explorer'] as const

/**
 * #### `ExplorerError`
 * 
 * Raised when environmental reconnaissance fails — the Explorer cannot determine a fact it needs.
 * 
 * **When it occurs**: during `explore()`, when resolving the GitHub repository identity or reading git state.
 * 
 * **Common causes**:
 * 
 * - `GITHUB_REPOSITORY` is set but malformed (not `"owner/repo"` format)
 * - No `origin` remote is configured, and `GITHUB_REPOSITORY` is not set
 * - The `origin` remote URL does not point to GitHub
 * 
 * **What to do**: set `GITHUB_REPOSITORY="owner/repo"` explicitly, or configure a GitHub-pointing `origin` remote. The error's `detail` field explains exactly which resolution path failed and why.
 *
 * {@include explorer/errors/explorer-error}
 */
export const ExplorerError = Err.TaggedContextualError(
  'ExplorerError',
  baseTags,
  {
    context: S.Struct({
      /** What specifically went wrong during exploration. */
      detail: S.String,
    }),
    message: (ctx) => `Failed to explore release environment: ${ctx.detail}`,
  },
)

export type ExplorerError = InstanceType<typeof ExplorerError>

/** Union of all errors from the explorer module. */
export type All = ExplorerError
