import { Effect, Ref } from 'effect'
import { describe, expect, test } from 'vitest'
import { Github } from './_.js'

// ============================================================================
// Memory Layer Tests
// ============================================================================

describe('Github', () => {
  test('releaseExists returns false for missing release', async () => {
    const layer = Github.Memory.make({})

    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const gh = yield* Github.Github
        return yield* gh.releaseExists('v1.0.0')
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toBe(false)
  })

  test('releaseExists returns true for existing release', async () => {
    const mockRelease = {
      id: 1,
      tag_name: 'v1.0.0',
    } as Github.Release

    const layer = Github.Memory.make({
      releases: { 'v1.0.0': mockRelease },
    })

    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const gh = yield* Github.Github
        return yield* gh.releaseExists('v1.0.0')
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toBe(true)
  })

  test('createRelease creates and records release', async () => {
    const { layer, state } = await Effect.runPromise(
      Github.Memory.makeWithState({}),
    )

    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const gh = yield* Github.Github
        return yield* gh.createRelease({
          tag: 'v1.0.0',
          title: 'Release v1.0.0',
          body: '## Changelog\n\n- Initial release',
        })
      }).pipe(Effect.provide(layer)),
    )

    expect(result.tag_name).toBe('v1.0.0')
    expect(result.name).toBe('Release v1.0.0')
    expect(result.body).toBe('## Changelog\n\n- Initial release')

    const releases = await Effect.runPromise(Ref.get(state.releases))
    const created = await Effect.runPromise(Ref.get(state.createdReleases))

    expect(releases['v1.0.0']).toBeDefined()
    expect(created).toHaveLength(1)
    expect(created[0]).toEqual({
      tag: 'v1.0.0',
      title: 'Release v1.0.0',
      body: '## Changelog\n\n- Initial release',
    })
  })

  test('createRelease with prerelease flag', async () => {
    const layer = Github.Memory.make({})

    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const gh = yield* Github.Github
        return yield* gh.createRelease({
          tag: 'v1.0.0-beta.1',
          title: 'Beta Release',
          body: 'Beta notes',
          prerelease: true,
        })
      }).pipe(Effect.provide(layer)),
    )

    expect(result.prerelease).toBe(true)
  })

  test('updateRelease updates and records changes', async () => {
    const mockRelease = {
      id: 123,
      tag_name: 'v1.0.0',
      name: 'Original Title',
      body: 'Original body',
    } as Github.Release

    const { layer, state } = await Effect.runPromise(
      Github.Memory.makeWithState({
        releases: { 'v1.0.0': mockRelease },
      }),
    )

    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const gh = yield* Github.Github
        return yield* gh.updateRelease('v1.0.0', {
          body: 'Updated changelog',
        })
      }).pipe(Effect.provide(layer)),
    )

    expect(result.body).toBe('Updated changelog')

    const releases = await Effect.runPromise(Ref.get(state.releases))
    const updated = await Effect.runPromise(Ref.get(state.updatedReleases))

    expect(releases['v1.0.0']!.body).toBe('Updated changelog')
    expect(updated).toHaveLength(1)
    expect(updated[0]).toEqual({
      tag: 'v1.0.0',
      params: { body: 'Updated changelog' },
    })
  })

  test('releaseExists reflects created releases', async () => {
    const layer = Github.Memory.make({})

    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const gh = yield* Github.Github
        const before = yield* gh.releaseExists('v1.0.0')
        yield* gh.createRelease({
          tag: 'v1.0.0',
          title: 'Test',
          body: 'Test body',
        })
        const after = yield* gh.releaseExists('v1.0.0')
        return { before, after }
      }).pipe(Effect.provide(layer)),
    )

    expect(result.before).toBe(false)
    expect(result.after).toBe(true)
  })
})

// ============================================================================
// Memory State Tests
// ============================================================================

describe('Memory state', () => {
  test('makeWithState provides mutable state access', async () => {
    const mockRelease = { id: 1, tag_name: 'v1.0.0' } as Github.Release

    const { layer, state } = await Effect.runPromise(
      Github.Memory.makeWithState({
        releases: { 'v1.0.0': mockRelease },
      }),
    )

    // Add a release to state directly
    await Effect.runPromise(
      Ref.update(state.releases, (releases) => ({
        ...releases,
        'v2.0.0': { ...mockRelease, id: 2, tag_name: 'v2.0.0' } as Github.Release,
      })),
    )

    // Verify service sees updated state
    const exists = await Effect.runPromise(
      Effect.gen(function*() {
        const gh = yield* Github.Github
        return yield* gh.releaseExists('v2.0.0')
      }).pipe(Effect.provide(layer)),
    )

    expect(exists).toBe(true)
  })
})

// ============================================================================
// Error Types
// ============================================================================

describe('Error types', () => {
  test('GithubError has correct tag', () => {
    const error = new Github.GithubError({
      context: { operation: 'createRelease', status: 500, detail: 'Server error' },
      cause: new Error('Underlying API error'),
    })

    expect(error._tag).toBe('GithubError')
    expect(error.message).toContain('createRelease')
    expect(error.message).toContain('500')
  })

  test('GithubNotFoundError has correct tag', () => {
    const error = new Github.GithubNotFoundError({
      context: { operation: 'getRelease', resource: '/repos/owner/repo/releases/tags/v1.0.0' },
    })

    expect(error._tag).toBe('GithubNotFoundError')
    expect(error.message).toContain('not found')
  })

  test('GithubAuthError has correct tag', () => {
    const error = new Github.GithubAuthError({
      context: { operation: 'createRelease' },
    })

    expect(error._tag).toBe('GithubAuthError')
    expect(error.message).toContain('authentication failed')
  })

  test('GithubRateLimitError has correct tag', () => {
    const resetAt = new Date('2024-01-15T12:00:00Z')
    const error = new Github.GithubRateLimitError({
      context: { operation: 'getRelease', resetAt },
    })

    expect(error._tag).toBe('GithubRateLimitError')
    expect(error.message).toContain('rate limit')
    expect(error.message).toContain('2024-01-15')
  })

  test('GithubConfigError has correct tag', () => {
    const error = new Github.GithubConfigError({
      context: { detail: 'Missing token' },
    })

    expect(error._tag).toBe('GithubConfigError')
    expect(error.message).toContain('configuration error')
    expect(error.message).toContain('Missing token')
  })
})
