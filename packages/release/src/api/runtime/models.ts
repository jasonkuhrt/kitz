/**
 * Where this release execution is running.
 */
export interface ExecutionContext {
  readonly kind: 'local' | 'ci'
  readonly ciProvider?: 'github-actions' | 'generic'
}

/**
 * Target release backend and identity.
 */
export interface ReleaseTarget {
  readonly provider: 'github'
  readonly owner: string
  readonly repo: string
  readonly source: 'env:GITHUB_REPOSITORY' | 'git:origin'
}

/**
 * Credentials needed for release operations.
 */
export interface ReleaseCredentials {
  readonly githubToken: string
  readonly source: 'env:GITHUB_TOKEN'
}

/**
 * Runtime capabilities derived after resolution.
 */
export interface ReleaseCapabilities {
  readonly canCreateRemoteRelease: true
}

/**
 * Semantic runtime for release execution.
 */
export interface ReleaseRuntime {
  readonly executionContext: ExecutionContext
  readonly target: ReleaseTarget
  readonly credentials: ReleaseCredentials
  readonly capabilities: ReleaseCapabilities
}
