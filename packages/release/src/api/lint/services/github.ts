import { Context } from 'effect'

/** GitHub repository merge settings. */
export interface GitHubMergeSettings {
  /** Whether squash merge is allowed. */
  readonly allowSquashMerge: boolean
  /** Whether merge commits are allowed. */
  readonly allowMergeCommit: boolean
  /** Whether rebase merge is allowed. */
  readonly allowRebaseMerge: boolean
}

/** GitHub data available to lint rules. */
export interface GitHub {
  /** Repository merge settings. */
  readonly settings: GitHubMergeSettings
}

/** Service providing GitHub API context. */
export class GitHubService extends Context.Tag('GitHubService')<GitHubService, GitHub>() {}
