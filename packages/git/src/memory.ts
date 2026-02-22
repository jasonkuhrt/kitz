import { Effect, Layer, Ref } from 'effect'
import { Author } from './author.js'
import { Commit } from './commit.js'
import { Git, GitError, type GitService } from './service.js'
import * as Sha from './sha.js'

/**
 * Configuration for the in-memory Git service.
 */
export interface GitMemoryConfig {
  /** Initial tags in the repository */
  readonly tags?: string[]
  /** Initial commits (newest first) */
  readonly commits?: Commit[]
  /** Current branch name */
  readonly branch?: string
  /** Whether working tree is clean */
  readonly isClean?: boolean
  /** Repository root path */
  readonly root?: string
  /** HEAD commit SHA (short form) */
  readonly headSha?: Sha.Sha
  /** Remote URL */
  readonly remoteUrl?: string
}

/**
 * Mutable state for the in-memory Git service.
 *
 * Useful for:
 * - Verifying what operations were performed
 * - Dynamically updating state during execution
 * - Inspecting final state after operations
 */
export interface GitMemoryState {
  /** All tags (including created ones) */
  readonly tags: Ref.Ref<string[]>
  /** All commits */
  readonly commits: Ref.Ref<Commit[]>
  /** Current branch */
  readonly branch: Ref.Ref<string>
  /** Clean status */
  readonly isClean: Ref.Ref<boolean>
  /** Repository root */
  readonly root: Ref.Ref<string>
  /** HEAD commit SHA */
  readonly headSha: Ref.Ref<Sha.Sha>
  /** Tags created (for verification) */
  readonly createdTags: Ref.Ref<Array<{ tag: string; message: string | undefined }>>
  /** Tag push operations (for verification) */
  readonly pushedTags: Ref.Ref<Array<{ remote: string }>>
  /** Map of tag -> SHA */
  readonly tagShas: Ref.Ref<Record<string, Sha.Sha>>
  /** Map of sha -> parent SHAs for ancestry */
  readonly commitParents: Ref.Ref<Record<string, string[]>>
  /** Tags deleted locally */
  readonly deletedTags: Ref.Ref<string[]>
  /** Tags deleted from remote */
  readonly deletedRemoteTags: Ref.Ref<Array<{ tag: string; remote: string }>>
  /** Remote URL */
  readonly remoteUrl: Ref.Ref<string>
}

/**
 * Create the initial state from config.
 */
export const makeState = (
  config: GitMemoryConfig = {},
): Effect.Effect<GitMemoryState> =>
  Effect.all({
    tags: Ref.make(config.tags ?? []),
    commits: Ref.make(config.commits ?? []),
    branch: Ref.make(config.branch ?? 'main'),
    isClean: Ref.make(config.isClean ?? true),
    root: Ref.make(config.root ?? '/repo'),
    headSha: Ref.make(config.headSha ?? Sha.make('abc1234')),
    createdTags: Ref.make<Array<{ tag: string; message: string | undefined }>>([]),
    pushedTags: Ref.make<Array<{ remote: string }>>([]),
    tagShas: Ref.make<Record<string, Sha.Sha>>({}),
    commitParents: Ref.make<Record<string, string[]>>({}),
    deletedTags: Ref.make<string[]>([]),
    deletedRemoteTags: Ref.make<Array<{ tag: string; remote: string }>>([]),
    remoteUrl: Ref.make(config.remoteUrl ?? 'git@github.com:example/repo.git'),
  })

/**
 * Create a Git service implementation backed by in-memory state.
 */
const makeService = (state: GitMemoryState): GitService => ({
  getTags: () => Ref.get(state.tags),

  getCurrentBranch: () => Ref.get(state.branch),

  getCommitsSince: (tag) =>
    Effect.gen(function*() {
      const commits = yield* Ref.get(state.commits)
      const tags = yield* Ref.get(state.tags)

      if (tag === undefined) {
        return commits
      }

      // Find the index where the tag points to
      const tagIndex = tags.indexOf(tag)
      if (tagIndex === -1) {
        const detail = `tag not found: ${tag}`
        return yield* Effect.fail(
          new GitError({
            context: { operation: 'getCommitsSince', detail },
            cause: new Error(detail),
          }),
        )
      }

      // Parse tag to find package@version pattern
      const atIndex = tag.lastIndexOf('@')
      if (atIndex <= 0) {
        // Not a package tag, return all commits
        return commits
      }

      // For simplicity, assume commits are ordered newest-first
      // and the tag represents a point in history
      const packageName = tag.slice(0, atIndex)
      const versionInTag = tag.slice(atIndex + 1)

      // Find commit index by matching version in message
      const tagCommitIndex = commits.findIndex((c) =>
        c.message.includes(`(${packageName.split('/').pop()})`)
        && c.message.includes(versionInTag)
      )

      if (tagCommitIndex === -1) {
        // Tag exists but no matching commit found - return all
        return commits
      }

      // Return commits before the tagged commit
      return commits.slice(0, tagCommitIndex)
    }),

  isClean: () => Ref.get(state.isClean),

  createTag: (tag, message) =>
    Effect.gen(function*() {
      yield* Ref.update(state.tags, (tags) => [...tags, tag])
      yield* Ref.update(state.createdTags, (created) => [...created, { tag, message }])
    }),

  pushTags: (remote = 'origin') => Ref.update(state.pushedTags, (pushed) => [...pushed, { remote }]),

  getRoot: () => Ref.get(state.root),

  getHeadSha: () => Ref.get(state.headSha),

  getTagSha: (tag) =>
    Effect.gen(function*() {
      const tagShas = yield* Ref.get(state.tagShas)
      const sha = tagShas[tag]
      if (!sha) {
        const detail = `tag not found: ${tag}`
        return yield* Effect.fail(
          new GitError({
            context: { operation: 'getTagSha', detail },
            cause: new Error(detail),
          }),
        )
      }
      return sha
    }),

  isAncestor: (sha1, sha2) =>
    Effect.gen(function*() {
      const parents = yield* Ref.get(state.commitParents)

      // BFS to find if sha1 is reachable from sha2
      const visited = new Set<string>()
      const queue = [sha2]
      while (queue.length > 0) {
        const current = queue.shift()!
        if (current === sha1) return true
        if (visited.has(current)) continue
        visited.add(current)
        const currentParents = parents[current] ?? []
        queue.push(...currentParents)
      }
      return false
    }),

  createTagAt: (tag, sha, message) =>
    Effect.gen(function*() {
      yield* Ref.update(state.tags, (tags) => [...tags, tag])
      yield* Ref.update(state.tagShas, (shas) => ({ ...shas, [tag]: Sha.make(sha) }))
      yield* Ref.update(state.createdTags, (created) => [...created, { tag, message }])
    }),

  deleteTag: (tag) =>
    Effect.gen(function*() {
      yield* Ref.update(state.tags, (tags) => tags.filter((t) => t !== tag))
      yield* Ref.update(state.tagShas, (shas) => {
        const { [tag]: _, ...rest } = shas
        return rest
      })
      yield* Ref.update(state.deletedTags, (deleted) => [...deleted, tag])
    }),

  commitExists: (sha) =>
    Effect.gen(function*() {
      const commits = yield* Ref.get(state.commits)
      const parents = yield* Ref.get(state.commitParents)
      return commits.some((c) => c.hash === sha || c.hash.startsWith(sha)) || sha in parents
    }),

  pushTag: (tag, remote = 'origin', _force = false) =>
    Ref.update(state.pushedTags, (pushed) => [...pushed, { remote }]),

  deleteRemoteTag: (tag, remote = 'origin') =>
    Ref.update(state.deletedRemoteTags, (deleted) => [...deleted, { tag, remote }]),

  getRemoteUrl: (_remote = 'origin') => Ref.get(state.remoteUrl),
})

/**
 * Create an in-memory Git layer with the given configuration.
 *
 * @example
 * ```ts
 * const memoryGit = Memory.make({
 *   tags: ['@kitz/core@1.0.0'],
 *   commits: [...]
 * })
 *
 * const result = await Effect.runPromise(
 *   Effect.provide(myEffect, memoryGit)
 * )
 * ```
 */
export const make = (config: GitMemoryConfig = {}): Layer.Layer<Git> =>
  Layer.effect(
    Git,
    Effect.gen(function*() {
      const state = yield* makeState(config)
      return makeService(state)
    }),
  )

/**
 * Create an in-memory Git layer with access to mutable state.
 *
 * Useful for verifying operations, dynamically updating state,
 * or inspecting final state after execution.
 *
 * @example
 * ```ts
 * const { layer, state } = await Effect.runPromise(Memory.makeWithState({
 *   commits: [...]
 * }))
 *
 * await Effect.runPromise(Effect.provide(myEffect, layer))
 *
 * const createdTags = await Effect.runPromise(Ref.get(state.createdTags))
 * ```
 */
export const makeWithState = (
  config: GitMemoryConfig = {},
): Effect.Effect<{ layer: Layer.Layer<Git>; state: GitMemoryState }> =>
  Effect.gen(function*() {
    const state = yield* makeState(config)
    const layer = Layer.succeed(Git, makeService(state))
    return { layer, state }
  })

/**
 * Generate a random valid hex SHA.
 */
const randomSha = (): string => {
  const hex = '0123456789abcdef'
  let result = ''
  for (let i = 0; i < 7; i++) {
    result += hex[Math.floor(Math.random() * 16)]
  }
  return result
}

/**
 * Helper to create a commit.
 */
export const commit = (
  message: string,
  overrides: Partial<Commit> = {},
): Commit =>
  Commit.make({
    hash: overrides.hash ?? Sha.make(randomSha()),
    message,
    author: overrides.author ?? Author.make({ name: 'Test Author', email: 'test@example.com' }),
    date: overrides.date ?? new Date(),
  })
