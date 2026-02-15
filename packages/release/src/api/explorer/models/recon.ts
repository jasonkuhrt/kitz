import type { CiContext } from './ci-context.js'
import type { GithubCredentials, NpmCredentials } from './credentials.js'
import type { GitIdentity } from './git-identity.js'

/**
 * Environmental reconnaissance — a snapshot of all facts gathered
 * about the release environment before analysis or execution begins.
 */
export interface Recon {
  readonly ci: CiContext
  readonly github: {
    readonly target: GitIdentity | null
    readonly credentials: GithubCredentials | null
  }
  readonly npm: NpmCredentials
  readonly git: {
    readonly clean: boolean
    readonly branch: string
    readonly remotes: Record<string, string>
  }
}
