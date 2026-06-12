import { Schema } from 'effect'

/**
 * Runtime applicability check for a lint rule. Not user-configurable.
 *
 * - `'hasOpenPR'`: current branch has an open pull request
 * - `'hasDiff'`: PR has file changes (not an empty PR or missing diff context)
 * - `'isMonorepo'`: project declares monorepo workspaces in the root package.json
 * - `'hasGitHubAccess'`: GitHub API token available with repo read access
 * - `'hasReleasePlan'`: a release plan is available (computed versions and packages to publish)
 */
export const Precondition = Schema.Literals([
  'hasOpenPR',
  'hasDiff',
  'isMonorepo',
  'hasGitHubAccess',
  'hasReleasePlan',
])
export type Precondition = typeof Precondition.Type
