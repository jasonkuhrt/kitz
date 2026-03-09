/**
 * Credentials available for release operations.
 */
export interface GithubCredentials {
  readonly token: string
  readonly source: 'env:GITHUB_TOKEN'
}

/**
 * npm authentication status.
 */
export interface NpmCredentials {
  readonly authenticated: boolean
  readonly username: string | null
  readonly registry: string
}
