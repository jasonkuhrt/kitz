import { Effect, Layer, Ref } from 'effect'
import {
  type CreateReleaseParams,
  Github,
  type GithubService,
  type Release,
  type UpdateReleaseParams,
} from './service.js'

// ============================================================================
// Config
// ============================================================================

/**
 * Configuration for the in-memory GitHub service.
 */
export interface GithubMemoryConfig {
  /** Initial releases in the repository (keyed by tag) */
  readonly releases?: Record<string, Release>
}

// ============================================================================
// State
// ============================================================================

/**
 * Mutable state for the in-memory GitHub service.
 *
 * Useful for:
 * - Verifying what operations were performed
 * - Dynamically updating state during execution
 * - Inspecting final state after operations
 */
export interface GithubMemoryState {
  /** All releases (keyed by tag) */
  readonly releases: Ref.Ref<Record<string, Release>>
  /** Releases created (for verification) */
  readonly createdReleases: Ref.Ref<CreateReleaseParams[]>
  /** Releases updated (for verification) */
  readonly updatedReleases: Ref.Ref<Array<{ tag: string; params: UpdateReleaseParams }>>
}

/**
 * Create the initial state from config.
 */
export const makeState = (
  config: GithubMemoryConfig = {},
): Effect.Effect<GithubMemoryState> =>
  Effect.all({
    releases: Ref.make(config.releases ?? {}),
    createdReleases: Ref.make<CreateReleaseParams[]>([]),
    updatedReleases: Ref.make<Array<{ tag: string; params: UpdateReleaseParams }>>([]),
  })

// ============================================================================
// Helpers
// ============================================================================

let releaseIdCounter = 1

/**
 * Create a mock Release object from params.
 */
const createMockRelease = (params: CreateReleaseParams): Release => ({
  id: releaseIdCounter++,
  node_id: `MDc6UmVsZWFzZQ==`,
  tag_name: params.tag,
  target_commitish: 'main',
  name: params.title,
  body: params.body,
  draft: false,
  prerelease: params.prerelease ?? false,
  created_at: new Date().toISOString(),
  published_at: new Date().toISOString(),
  url: `https://api.github.com/repos/owner/repo/releases/${releaseIdCounter}`,
  html_url: `https://github.com/owner/repo/releases/tag/${params.tag}`,
  assets_url: `https://api.github.com/repos/owner/repo/releases/${releaseIdCounter}/assets`,
  upload_url: `https://uploads.github.com/repos/owner/repo/releases/${releaseIdCounter}/assets{?name,label}`,
  tarball_url: `https://github.com/owner/repo/archive/refs/tags/${params.tag}.tar.gz`,
  zipball_url: `https://github.com/owner/repo/archive/refs/tags/${params.tag}.zip`,
  author: {
    login: 'testuser',
    id: 1,
    node_id: 'MDQ6VXNlcjE=',
    avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    gravatar_id: '',
    url: 'https://api.github.com/users/testuser',
    html_url: 'https://github.com/testuser',
    followers_url: 'https://api.github.com/users/testuser/followers',
    following_url: 'https://api.github.com/users/testuser/following{/other_user}',
    gists_url: 'https://api.github.com/users/testuser/gists{/gist_id}',
    starred_url: 'https://api.github.com/users/testuser/starred{/owner}{/repo}',
    subscriptions_url: 'https://api.github.com/users/testuser/subscriptions',
    organizations_url: 'https://api.github.com/users/testuser/orgs',
    repos_url: 'https://api.github.com/users/testuser/repos',
    events_url: 'https://api.github.com/users/testuser/events{/privacy}',
    received_events_url: 'https://api.github.com/users/testuser/received_events',
    type: 'User',
    site_admin: false,
  },
  assets: [],
})

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Create a GitHub service implementation backed by in-memory state.
 */
const makeService = (state: GithubMemoryState): GithubService => ({
  releaseExists: (tag) =>
    Effect.gen(function*() {
      const releases = yield* Ref.get(state.releases)
      return tag in releases
    }),

  createRelease: (params) =>
    Effect.gen(function*() {
      const release = createMockRelease(params)
      yield* Ref.update(state.releases, (releases) => ({
        ...releases,
        [params.tag]: release,
      }))
      yield* Ref.update(state.createdReleases, (created) => [...created, params])
      return release
    }),

  updateRelease: (tag, params) =>
    Effect.gen(function*() {
      const releases = yield* Ref.get(state.releases)
      const existing = releases[tag]
      if (!existing) {
        // This path shouldn't be reached in normal usage since the interface
        // declares GithubNotFoundError, but we need to satisfy the type
        throw new Error(`Release not found: ${tag}`)
      }
      const updated: Release = {
        ...existing,
        body: params.body,
      }
      yield* Ref.update(state.releases, (releases) => ({
        ...releases,
        [tag]: updated,
      }))
      yield* Ref.update(state.updatedReleases, (updates) => [...updates, { tag, params }])
      return updated
    }),
})

// ============================================================================
// Layer
// ============================================================================

/**
 * Create an in-memory GitHub layer with the given configuration.
 *
 * @example
 * ```ts
 * const memoryGithub = Memory.make({
 *   releases: {
 *     'v1.0.0': mockRelease
 *   }
 * })
 *
 * const result = await Effect.runPromise(
 *   Effect.provide(myEffect, memoryGithub)
 * )
 * ```
 */
export const make = (config: GithubMemoryConfig = {}): Layer.Layer<Github> =>
  Layer.effect(
    Github,
    Effect.gen(function*() {
      const state = yield* makeState(config)
      return makeService(state)
    }),
  )

/**
 * Create an in-memory GitHub layer with access to mutable state.
 *
 * Useful for verifying operations, dynamically updating state,
 * or inspecting final state after execution.
 *
 * @example
 * ```ts
 * const { layer, state } = await Effect.runPromise(Memory.makeWithState({
 *   releases: {}
 * }))
 *
 * await Effect.runPromise(Effect.provide(myEffect, layer))
 *
 * const createdReleases = await Effect.runPromise(Ref.get(state.createdReleases))
 * ```
 */
export const makeWithState = (
  config: GithubMemoryConfig = {},
): Effect.Effect<{ layer: Layer.Layer<Github>; state: GithubMemoryState }> =>
  Effect.gen(function*() {
    const state = yield* makeState(config)
    const layer = Layer.succeed(Github, makeService(state))
    return { layer, state }
  })
