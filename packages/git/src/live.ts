import { existsSync } from 'node:fs'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import { type SimpleGit, simpleGit } from 'simple-git'
import { Author } from './author.js'
import { Commit } from './commit.js'
import { Git, GitError, type GitOperation, GitParseError, type GitService } from './service.js'
import * as Sha from './sha.js'

// oxlint-disable-next-line kitz/domain/no-process-env
const env = process.env

const unsafeGitEnvKeys = new Set(['editor', 'pager', 'prefix', 'ssh_askpass', 'visual'])

const sanitizeGitEnv = (): NodeJS.ProcessEnv => {
  const nextEnv = { ...env }
  for (const key of Object.keys(nextEnv)) {
    const normalizedKey = key.toLowerCase()
    if (key.startsWith('GIT_') || unsafeGitEnvKeys.has(normalizedKey)) {
      delete nextEnv[key]
    }
  }
  return nextEnv
}

const gitDirPath = (dir: Fs.Path.AbsDir): Fs.Path.AbsFile =>
  Fs.Path.join(dir, Fs.Path.RelFile.fromString('./.git'))

const findWorkTreeRoot = (start: Fs.Path.AbsDir): Fs.Path.AbsDir | undefined => {
  if (existsSync(Fs.Path.toString(gitDirPath(start)))) return start

  const parent = Fs.Path.up(start)
  return Fs.Path.toString(parent) === Fs.Path.toString(start) ? undefined : findWorkTreeRoot(parent)
}

const createGit = (cwd?: string): SimpleGit => {
  const baseDir = cwd ?? process.cwd()
  const git = simpleGit(baseDir)
  const gitEnv = sanitizeGitEnv()
  const workTreeRoot = findWorkTreeRoot(Fs.Path.AbsDir.fromString(baseDir))

  if (workTreeRoot !== undefined) {
    gitEnv['GIT_DIR'] = Fs.Path.toString(gitDirPath(workTreeRoot))
    gitEnv['GIT_WORK_TREE'] = Fs.Path.toString(workTreeRoot)
  }

  return git.env(gitEnv)
}

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
        }),
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
          }),
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

  pushTags: (remote = 'origin') =>
    gitEffect('pushTags', () => git.pushTags(remote), `to ${remote}`),

  pushTagsAtomic: (tags, remote = 'origin', force = false) =>
    gitEffect(
      'pushTagsAtomic',
      () =>
        git.raw([
          'push',
          '--atomic',
          ...(force ? ['--force'] : []),
          remote,
          ...tags.map((tag) => `refs/tags/${tag}`),
        ]),
      `${tags.join(', ')} to ${remote}${force ? ' (force)' : ''}`,
    ),

  pushTagDryRun: (tag, remote = 'origin', force = false) =>
    gitEffect(
      'pushTagDryRun',
      () =>
        git
          .raw([
            'push',
            '--dry-run',
            ...(force ? ['--force'] : []),
            remote,
            `refs/tags/${tag}:refs/tags/${tag}`,
          ])
          .then((stdout) => ({ stdout })),
      `${tag} to ${remote}${force ? ' (force)' : ''}`,
    ),

  pushTagsAtomicDryRun: (tags, remote = 'origin', force = false) =>
    gitEffect(
      'pushTagsAtomicDryRun',
      () =>
        git
          .raw([
            'push',
            '--dry-run',
            '--atomic',
            ...(force ? ['--force'] : []),
            remote,
            ...tags.map((tag) => `refs/tags/${tag}:refs/tags/${tag}`),
          ])
          .then((stdout) => ({ stdout })),
      `${tags.join(', ')} to ${remote}${force ? ' (force)' : ''}`,
    ),

  getRoot: () => gitEffect('getRoot', async () => (await git.revparse(['--show-toplevel'])).trim()),

  getHooksDir: () =>
    gitEffect('getHooksDir', async () =>
      // `--path-format=absolute` yields a cwd-independent absolute path and
      // `--git-path hooks` honors `core.hooksPath` (falling back to
      // `<git-dir>/hooks`), so git itself owns the resolution rules.
      (await git.raw(['rev-parse', '--path-format=absolute', '--git-path', 'hooks'])).trim(),
    ),

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
      () =>
        git.raw(['merge-base', '--is-ancestor', sha1, sha2]).then(
          () => true, // Exit code 0 = is ancestor
          () => false, // Exit code 1 = not ancestor
        ),
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
      () =>
        git.raw(['cat-file', '-t', sha]).then(
          () => true,
          () => false,
        ),
      sha,
    ),

  pushTag: (tag, remote = 'origin', force = false) =>
    gitEffect(
      'pushTag',
      async () => {
        const args = force
          ? ['push', '--force', remote, `refs/tags/${tag}`]
          : ['push', remote, `refs/tags/${tag}`]
        await git.raw(args)
      },
      `${tag} to ${remote}${force ? ' (force)' : ''}`,
    ),

  deleteRemoteTag: (tag, remote = 'origin') =>
    gitEffect(
      'deleteRemoteTag',
      () => git.raw(['push', remote, `:refs/tags/${tag}`]),
      `${tag} from ${remote}`,
    ),

  getRemoteUrl: (remote = 'origin') =>
    gitEffect(
      'getRemoteUrl',
      async () => (await git.raw(['ls-remote', '--get-url', remote])).trim(),
      remote,
    ),
})

// ============================================================================
// Layer
// ============================================================================

/**
 * Live implementation of Git service using simple-git.
 */
export const GitLive = Layer.sync(Git, () => makeGitService(createGit()))

/**
 * Create a Git service for a specific directory.
 */
export const makeGitLive = (cwd: string) => Layer.sync(Git, () => makeGitService(createGit(cwd)))
