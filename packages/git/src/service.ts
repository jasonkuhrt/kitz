import { Err } from '@kitz/core'
import { Context, Effect, Schema as S } from 'effect'
import { Commit } from './commit.js'
import * as Sha from './sha.js'

export { Author } from './author.js'
export { Commit } from './commit.js'

// ============================================================================
// Errors
// ============================================================================

/**
 * Git operation names for structured error context.
 */
export type GitOperation =
  | 'getTags'
  | 'getCurrentBranch'
  | 'getCommitsSince'
  | 'isClean'
  | 'createTag'
  | 'pushTags'
  | 'getRoot'
  | 'getHeadSha'
  | 'getTagSha'
  | 'isAncestor'
  | 'createTagAt'
  | 'deleteTag'
  | 'commitExists'
  | 'pushTag'
  | 'deleteRemoteTag'
  | 'getRemoteUrl'

const GitOperationSchema = S.Literal(
  'getTags',
  'getCurrentBranch',
  'getCommitsSince',
  'isClean',
  'createTag',
  'pushTags',
  'getRoot',
  'getHeadSha',
  'getTagSha',
  'isAncestor',
  'createTagAt',
  'deleteTag',
  'commitExists',
  'pushTag',
  'deleteRemoteTag',
  'getRemoteUrl',
)

const baseTags = ['kit', 'git'] as const

/**
 * Git operation error.
 */
export const GitError = Err.TaggedContextualError('GitError', baseTags, {
  context: S.Struct({
    operation: GitOperationSchema,
    detail: S.optional(S.String),
  }),
  message: (ctx) => `Git ${ctx.operation} failed${ctx.detail ? `: ${ctx.detail}` : ''}`,
  cause: S.instanceOf(Error),
})

export type GitError = InstanceType<typeof GitError>

/**
 * Error parsing/transforming git output.
 */
export const GitParseError = Err.TaggedContextualError('GitParseError', baseTags, {
  context: S.Struct({
    operation: GitOperationSchema,
    detail: S.optional(S.String),
  }),
  message: (ctx) => `Git ${ctx.operation} parse failed${ctx.detail ? `: ${ctx.detail}` : ''}`,
  cause: S.instanceOf(Error),
})

export type GitParseError = InstanceType<typeof GitParseError>

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Git service interface.
 */
export interface GitService {
  /** Get all tags in the repository */
  readonly getTags: () => Effect.Effect<string[], GitError>

  /** Get the current branch name */
  readonly getCurrentBranch: () => Effect.Effect<string, GitError>

  /** Get commits since a tag (or all commits if tag is undefined) */
  readonly getCommitsSince: (tag: string | undefined) => Effect.Effect<Commit[], GitError | GitParseError>

  /** Check if the working tree is clean */
  readonly isClean: () => Effect.Effect<boolean, GitError>

  /** Create a new tag */
  readonly createTag: (tag: string, message?: string) => Effect.Effect<void, GitError>

  /** Push tags to remote */
  readonly pushTags: (remote?: string) => Effect.Effect<void, GitError>

  /** Get the repository root path */
  readonly getRoot: () => Effect.Effect<string, GitError>

  /** Get the short SHA of HEAD commit */
  readonly getHeadSha: () => Effect.Effect<Sha.Sha, GitError | GitParseError>

  /** Get the commit SHA that a tag points to */
  readonly getTagSha: (tag: string) => Effect.Effect<Sha.Sha, GitError | GitParseError>

  /** Check if sha1 is an ancestor of sha2 */
  readonly isAncestor: (sha1: string, sha2: string) => Effect.Effect<boolean, GitError>

  /** Create a tag at a specific commit SHA */
  readonly createTagAt: (tag: string, sha: string, message?: string) => Effect.Effect<void, GitError>

  /** Delete a tag locally */
  readonly deleteTag: (tag: string) => Effect.Effect<void, GitError>

  /** Check if a commit SHA exists in the repository */
  readonly commitExists: (sha: string) => Effect.Effect<boolean, GitError>

  /** Push a specific tag to remote */
  readonly pushTag: (tag: string, remote?: string, force?: boolean) => Effect.Effect<void, GitError>

  /** Delete a tag from remote */
  readonly deleteRemoteTag: (tag: string, remote?: string) => Effect.Effect<void, GitError>

  /** Get the URL of a remote */
  readonly getRemoteUrl: (remote?: string) => Effect.Effect<string, GitError>
}

// ============================================================================
// Service Tag
// ============================================================================

/**
 * Git service tag.
 */
export class Git extends Context.Tag('Git')<Git, GitService>() {}
