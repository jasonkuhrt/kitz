import { Err } from '@kitz/core'
import { Effect, Layer } from 'effect'
import { type SimpleGit, simpleGit } from 'simple-git'
import { Author } from './author.js'
import { Commit } from './commit.js'
import { Git, GitError, type GitOperation, GitParseError, type GitService } from './service.js'
import * as Sha from './sha.js'

// ============================================================================
// Helper
// ============================================================================

/**
 * Options for gitEffect helper with map transform.
 */
interface GitEffectOptionsWithMap<$raw, $value> {
  readonly detail?: string | undefined
  readonly map: (raw: $raw) => $value
}

/**
 * Options for gitEffect helper without map transform.
 */
interface GitEffectOptionsWithoutMap {
  readonly detail?: string
}

/**
 * Helper to wrap simple-git calls in Effect with standardized error handling.
 */
function gitEffect<$value>(
  operation: GitOperation,
  fn: () => Promise<$value>,
  options?: string | GitEffectOptionsWithoutMap,
): Effect.Effect<$value, GitError>

function gitEffect<$raw, $value>(
  operation: GitOperation,
  fn: () => Promise<$raw>,
  options: GitEffectOptionsWithMap<$raw, $value>,
): Effect.Effect<$value, GitError | GitParseError>

function gitEffect<$raw, $value = $raw>(
  operation: GitOperation,
  fn: () => Promise<$raw>,
  options?: string | GitEffectOptionsWithoutMap | GitEffectOptionsWithMap<$raw, $value>,
): Effect.Effect<$value, GitError | GitParseError> {
  const opts = typeof options === 'string' ? { detail: options } : options
  const detail = opts?.detail

  const base = Effect.tryPromise({
    try: fn,
    catch: (error) =>
      new GitError({
        context: { operation, ...(detail ? { detail } : {}) },
        cause: Err.ensure(error),
      }),
  })

  if (opts && 'map' in opts && typeof opts.map === 'function') {
    const mapFn = opts.map as (raw: $raw) => $value
    return base.pipe(
      Effect.flatMap((raw) =>
        Effect.try({
          try: () => mapFn(raw),
          catch: (error) =>
            new GitParseError({
              context: { operation, ...(detail ? { detail } : {}) },
              cause: Err.ensure(error),
            }),
        })
      ),
    )
  }

  return base as any
}

// ============================================================================
// Implementation
// ============================================================================

const makeGitService = (git: SimpleGit): GitService => ({
  getTags: () => gitEffect('getTags', async () => (await git.tags()).all),

  getCurrentBranch: () => gitEffect('getCurrentBranch', async () => (await git.branch()).current),

  getCommitsSince: (tag) =>
    gitEffect('getCommitsSince', () => git.log(tag ? { from: tag, to: 'HEAD' } : undefined), {
      detail: tag ? `since ${tag}` : undefined,
      map: (log) =>
        log.all.map((entry) =>
          Commit.make({
            hash: Sha.make(entry.hash),
            // Combine subject + body into single message
            message: entry.body ? `${entry.message}\n\n${entry.body}` : entry.message,
            author: Author.make({
              name: entry.author_name,
              email: entry.author_email,
            }),
            date: new Date(entry.date),
          })
        ),
    }),

  isClean: () => gitEffect('isClean', async () => (await git.status()).isClean()),

  createTag: (tag, message) =>
    gitEffect(
      'createTag',
      async () => {
        if (message) {
          await git.tag(['-a', tag, '-m', message])
        } else {
          await git.tag([tag])
        }
      },
      tag,
    ),

  pushTags: (remote = 'origin') => gitEffect('pushTags', () => git.pushTags(remote), `to ${remote}`),

  getRoot: () => gitEffect('getRoot', async () => (await git.revparse(['--show-toplevel'])).trim()),

  getHeadSha: () =>
    gitEffect('getHeadSha', () => git.revparse(['--short', 'HEAD']), {
      map: (sha) => Sha.make(sha.trim()),
    }),

  getTagSha: (tag) =>
    gitEffect('getTagSha', () => git.raw(['rev-list', '-1', tag]), {
      detail: tag,
      map: (sha: string) => Sha.make(sha.trim()),
    }),

  isAncestor: (sha1, sha2) =>
    gitEffect(
      'isAncestor',
      async () => {
        try {
          await git.raw(['merge-base', '--is-ancestor', sha1, sha2])
          return true // Exit code 0 = is ancestor
        } catch {
          return false // Exit code 1 = not ancestor
        }
      },
      `${sha1} -> ${sha2}`,
    ),

  createTagAt: (tag, sha, message) =>
    gitEffect(
      'createTagAt',
      async () => {
        if (message) {
          await git.tag(['-a', tag, sha, '-m', message])
        } else {
          await git.tag([tag, sha])
        }
      },
      `${tag} at ${sha}`,
    ),

  deleteTag: (tag) => gitEffect('deleteTag', () => git.tag(['-d', tag]), tag),

  commitExists: (sha) =>
    gitEffect(
      'commitExists',
      async () => {
        try {
          await git.raw(['cat-file', '-t', sha])
          return true
        } catch {
          return false
        }
      },
      sha,
    ),

  pushTag: (tag, remote = 'origin', force = false) =>
    gitEffect(
      'pushTag',
      async () => {
        const args = force ? ['push', '--force', remote, `refs/tags/${tag}`] : ['push', remote, `refs/tags/${tag}`]
        await git.raw(args)
      },
      `${tag} to ${remote}${force ? ' (force)' : ''}`,
    ),

  deleteRemoteTag: (tag, remote = 'origin') =>
    gitEffect('deleteRemoteTag', () => git.raw(['push', remote, `:refs/tags/${tag}`]), `${tag} from ${remote}`),

  getRemoteUrl: (remote = 'origin') =>
    gitEffect('getRemoteUrl', async () => (await git.raw(['ls-remote', '--get-url', remote])).trim(), remote),
})

// ============================================================================
// Layer
// ============================================================================

/**
 * Live implementation of Git service using simple-git.
 */
export const GitLive = Layer.sync(Git, () => makeGitService(simpleGit()))

/**
 * Create a Git service for a specific directory.
 */
export const makeGitLive = (cwd: string) => Layer.sync(Git, () => makeGitService(simpleGit(cwd)))
