import { ConventionalCommits } from '@kitz/conventional-commits'
import { Git } from '@kitz/git'
import { Option } from 'effect'

/**
 * Scope-specific commit info for changelog/serialization.
 */
export interface ScopedCommitInfo {
  readonly hash: Git.Sha.Sha
  readonly type: string
  readonly description: string
  readonly breaking: boolean
}

/**
 * A git commit with a parsed conventional commit message.
 *
 * This stores the full rich data - hash, author, date, and the complete
 * parsed CC structure. Use {@link forScope} to extract scope-specific info
 * for changelog generation.
 */
export class ReleaseCommit extends Git.ParsedCommit<ReleaseCommit>()(
  'ReleaseCommit',
  ConventionalCommits.Commit.Commit,
) {
  /**
   * Instance sugar for {@link ReleaseCommit.forScope}.
   */
  forScope(scope: string): ScopedCommitInfo {
    return ReleaseCommit.forScope(this, scope)
  }

  /**
   * Extract scope-specific commit info for changelog/serialization.
   *
   * For Single commits: returns the commit's type/description/breaking directly.
   * For Multi commits: finds the target for the given scope.
   */
  static forScope(commit: ReleaseCommit, scope: string): ScopedCommitInfo {
    const parsed = commit.message

    if (ConventionalCommits.Commit.Single.is(parsed)) {
      return {
        hash: commit.hash,
        type: parsed.type.value,
        description: parsed.message,
        breaking: parsed.breaking,
      }
    }

    // Multi commit - find the target for this scope
    const target = parsed.targets.find((t) => t.scope === scope)

    return {
      hash: commit.hash,
      type: target?.type.value ?? 'chore',
      description: parsed.message,
      breaking: target?.breaking ?? false,
    }
  }
}

/**
 * Placeholder SHA for synthetic commits (cascade releases, etc.).
 */
const SYNTHETIC_SHA = Git.Sha.make('0000000')

/**
 * Synthetic author for synthetic commits.
 */
const SYNTHETIC_AUTHOR = Git.Author.make({ name: 'Release', email: 'release@local' })

/**
 * Create a synthetic ReleaseCommit for cascade releases.
 *
 * Used when a package needs a release due to dependency updates,
 * not direct commit changes.
 */
export const makeCascadeCommit = (
  scope: string,
  description: string,
): ReleaseCommit =>
  ReleaseCommit.make({
    hash: SYNTHETIC_SHA,
    author: SYNTHETIC_AUTHOR,
    date: new Date(),
    message: ConventionalCommits.Commit.Single.make({
      type: ConventionalCommits.Type.parse('chore'),
      scopes: [scope],
      breaking: false,
      message: description,
      body: Option.none(),
      footers: [],
    }),
  })
