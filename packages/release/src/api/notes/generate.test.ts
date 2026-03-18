import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import type { Package } from '../analyzer/workspace.js'
import { generate } from './generate.js'

const packages: Package[] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
  },
]

describe('Notes.generate', () => {
  test('respects the until boundary when building package notes', async () => {
    const olderHash = Git.Sha.make('1111111')
    const newerHash = Git.Sha.make('2222222')

    const result = await Effect.runPromise(
      generate({
        packages,
        tags: [],
        until: olderHash,
      }).pipe(
        Effect.provide(
          Git.Memory.make({
            commits: [
              Git.Memory.commit('feat(core): newer change should be excluded', { hash: newerHash }),
              Git.Memory.commit('fix(core): older change should remain', { hash: olderHash }),
            ],
          }),
        ),
      ),
    )

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]!.package.name.moniker).toBe('@kitz/core')
    expect(result.notes[0]!.bump).toBe('patch')
    expect(result.notes[0]!.commits).toHaveLength(1)
    expect(result.notes[0]!.commits[0]!.hash).toBe(olderHash)
    expect(result.notes[0]!.notes.markdown).toContain('older change should remain')
    expect(result.notes[0]!.notes.markdown).not.toContain('newer change should be excluded')
  })

  test('respects tag until boundaries when building package notes', async () => {
    const result = await Effect.runPromise(
      generate({
        packages,
        tags: ['@kitz/core@1.0.0', '@kitz/core@1.0.1'],
        since: '@kitz/core@1.0.0',
        until: '@kitz/core@1.0.1',
      }).pipe(
        Effect.provide(
          Git.Memory.make({
            tags: ['@kitz/core@1.0.0', '@kitz/core@1.0.1'],
            commits: [
              Git.Memory.commit('feat(core): newer change should be excluded'),
              Git.Memory.commit('fix(core): 1.0.1 release boundary'),
              Git.Memory.commit('fix(core): older change should remain'),
              Git.Memory.commit('feat(core): 1.0.0 release'),
            ],
          }),
        ),
      ),
    )

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]!.bump).toBe('patch')
    expect(result.notes[0]!.commits).toHaveLength(2)
    expect(result.notes[0]!.notes.markdown).toContain('1.0.1 release boundary')
    expect(result.notes[0]!.notes.markdown).toContain('older change should remain')
    expect(result.notes[0]!.notes.markdown).not.toContain('newer change should be excluded')
  })

  test('treats sha until boundaries before since as an empty notes range', async () => {
    const releaseHash = Git.Sha.make('1111111')
    const newerHash = Git.Sha.make('2222222')
    const newerCommit = Git.Memory.commit('feat(core): newer post-release change', {
      hash: newerHash,
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const baseGit = yield* Git.Git

        return yield* generate({
          packages,
          tags: ['@kitz/core@1.0.0'],
          since: '@kitz/core@1.0.0',
          until: releaseHash,
        }).pipe(
          Effect.provideService(Git.Git, {
            ...baseGit,
            getCommitsSince: (tag) =>
              tag === releaseHash ? Effect.succeed([newerCommit]) : baseGit.getCommitsSince(tag),
          }),
        )
      }).pipe(
        Effect.provide(
          Git.Memory.make({
            tags: ['@kitz/core@1.0.0'],
            commits: [
              newerCommit,
              Git.Memory.commit('feat(core): 1.0.0 release', { hash: releaseHash }),
            ],
          }),
        ),
      ),
    )

    expect(result.notes).toHaveLength(0)
    expect(result.unchanged).toHaveLength(1)
    expect(result.unchanged[0]!.name.moniker).toBe('@kitz/core')
  })

  test('resolves tag until boundaries even when the caller tag snapshot is stale', async () => {
    const newerCommit = Git.Memory.commit('feat(core): newer change should be excluded')

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const baseGit = yield* Git.Git

        return yield* generate({
          packages,
          tags: ['@kitz/core@1.0.0'],
          since: '@kitz/core@1.0.0',
          until: '@kitz/core@1.0.1',
        }).pipe(
          Effect.provideService(Git.Git, {
            ...baseGit,
            getCommitsSince: (tag) =>
              tag === '@kitz/core@1.0.1'
                ? Effect.succeed([newerCommit])
                : baseGit.getCommitsSince(tag),
          }),
        )
      }).pipe(
        Effect.provide(
          Git.Memory.make({
            tags: ['@kitz/core@1.0.0'],
            commits: [
              newerCommit,
              Git.Memory.commit('fix(core): 1.0.1 release boundary'),
              Git.Memory.commit('feat(core): 1.0.0 release'),
            ],
          }),
        ),
      ),
    )

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]!.bump).toBe('patch')
    expect(result.notes[0]!.notes.markdown).toContain('1.0.1 release boundary')
    expect(result.notes[0]!.notes.markdown).not.toContain('newer change should be excluded')
  })

  test('fails when a resolvable stale until tag cannot be loaded from git', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const baseGit = yield* Git.Git

        return yield* generate({
          packages,
          tags: ['@kitz/core@1.0.0'],
          since: '@kitz/core@1.0.0',
          until: '@kitz/core@1.0.1',
        }).pipe(
          Effect.provideService(Git.Git, {
            ...baseGit,
            getCommitsSince: (tag) =>
              tag === '@kitz/core@1.0.1'
                ? Effect.fail(
                    new Git.GitError({
                      context: {
                        operation: 'getCommitsSince',
                        detail: `forced until lookup failure for ${tag}`,
                      },
                      cause: new Error(`forced until lookup failure for ${tag}`),
                    }),
                  )
                : baseGit.getCommitsSince(tag),
            getTagSha: (tag) =>
              tag === '@kitz/core@1.0.1'
                ? Effect.succeed(Git.Sha.make('3333333'))
                : baseGit.getTagSha(tag),
          }),
        )
      }).pipe(
        Effect.provide(
          Git.Memory.make({
            tags: ['@kitz/core@1.0.0'],
            commits: [
              Git.Memory.commit('feat(core): newer change should be excluded'),
              Git.Memory.commit('fix(core): 1.0.1 release boundary'),
              Git.Memory.commit('feat(core): 1.0.0 release'),
            ],
          }),
        ),
        Effect.result,
      ),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('GitError')
      if (result.failure._tag === 'GitError') {
        expect(result.failure.context.operation).toBe('getCommitsSince')
        expect(result.failure.context.detail).toContain('forced until lookup failure')
      }
    }
  })
})
