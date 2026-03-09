/**
 * Target release backend and identity.
 */
export interface GitIdentity {
  readonly owner: string
  readonly repo: string
  readonly source: 'env:GITHUB_REPOSITORY' | 'git:origin'
}
