import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Test } from '@kitz/test'
import { Effect, Ref, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { Git } from './_.js'

const gitEnv: NodeJS.ProcessEnv = {}
for (const key of ['HOME', 'PATH', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL']) {
  const value = process.env[key]
  if (value !== undefined) {
    gitEnv[key] = value
  }
}

const runGit = (cwd: string, args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv }).trim()

const makeTempGitRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'kitz-git-live-'))
  const remote = mkdtempSync(join(tmpdir(), 'kitz-git-remote-'))

  runGit(root, ['init', '-b', 'main'])
  runGit(root, ['config', 'user.name', 'Kitz Test'])
  runGit(root, ['config', 'user.email', 'kitz@example.com'])

  writeFileSync(join(root, 'README.md'), '# temp repo\n')
  runGit(root, ['add', 'README.md'])
  runGit(root, ['commit', '-m', 'chore(core): release 1.0.0'])
  const releaseSha = runGit(root, ['rev-parse', '--short', 'HEAD'])
  runGit(root, ['tag', '@kitz/core@1.0.0'])

  writeFileSync(join(root, 'feature.txt'), 'feature\n')
  runGit(root, ['add', 'feature.txt'])
  runGit(root, ['commit', '-m', 'feat(core): add feature'])

  runGit(remote, ['init', '--bare'])
  runGit(root, ['remote', 'add', 'origin', remote])
  runGit(root, ['push', '-u', 'origin', 'main'])

  return {
    root,
    remote,
    releaseSha: Git.Sha.make(releaseSha),
    cleanup: () => {
      rmSync(root, { recursive: true, force: true })
      rmSync(remote, { recursive: true, force: true })
    },
  }
}

// ============================================================================
// Sha
// ============================================================================

describe('Sha', () => {
  Test.describe('Sha.make > valid')
    .inputType<string>()
    .outputType<Git.Sha.Sha>()
    .cases(
      { input: 'abc1234', output: Git.Sha.make('abc1234'), comment: 'short form (7 chars)' },
      {
        input: 'abcdef1234',
        output: Git.Sha.make('abcdef1234'),
        comment: 'medium form (10 chars)',
      },
      {
        input: 'abc1234567890abcdef1234567890abcdef12345',
        output: Git.Sha.make('abc1234567890abcdef1234567890abcdef12345'),
        comment: 'full form (40 chars)',
      },
      { input: 'ABCDEF1', output: Git.Sha.make('ABCDEF1'), comment: 'uppercase hex' },
    )
    .test(({ input, output }) => {
      expect(Git.Sha.make(input)).toBe(output)
    })

  Test.describe('Sha.make > invalid')
    .inputType<string>()
    .outputType<string>()
    .cases(
      { input: 'abc123', output: 'too short', comment: '6 chars' },
      {
        input: 'abc12345678901234567890123456789012345678901',
        output: 'too long',
        comment: '41 chars',
      },
      { input: 'abc123g', output: 'invalid hex', comment: 'non-hex character' },
      { input: '', output: 'empty', comment: 'empty string' },
    )
    .test(({ input }) => {
      expect(() => Git.Sha.make(input)).toThrow()
    })

  Test.describe('Sha.is')
    .inputType<unknown>()
    .outputType<boolean>()
    .cases(
      { input: Git.Sha.make('abc1234'), output: true, comment: 'branded SHA' },
      { input: 'abc1234', output: true, comment: 'valid pattern string' },
      { input: 'abc123g', output: false, comment: 'invalid hex char' },
      { input: 123, output: false, comment: 'number' },
    )
    .test(({ input, output }) => {
      expect(Git.Sha.is(input)).toBe(output)
    })
})

// ============================================================================
// Git Service (using Memory driver)
// ============================================================================

describe('Git', () => {
  test('getTags returns configured tags', async () => {
    const tags = ['@kitz/core@1.0.0', '@kitz/cli@1.0.0']
    const layer = Git.Memory.make({ tags })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getTags()
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toEqual(tags)
  })

  test('getCurrentBranch returns configured branch', async () => {
    const layer = Git.Memory.make({ branch: 'feat/test' })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getCurrentBranch()
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toBe('feat/test')
  })

  test('isClean returns configured status', async () => {
    const layer = Git.Memory.make({ isClean: false })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.isClean()
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toBe(false)
  })

  test('getRoot returns configured path', async () => {
    const layer = Git.Memory.make({ root: '/my/project' })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getRoot()
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toBe('/my/project')
  })

  test('getHeadSha returns configured SHA', async () => {
    const sha = Git.Sha.make('def4567')
    const layer = Git.Memory.make({ headSha: sha })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getHeadSha()
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toBe(sha)
  })

  test('getCommitsSince returns all commits when no tag', async () => {
    const commits = [
      Git.Memory.commit('feat(core): feature 1'),
      Git.Memory.commit('fix(core): bug fix'),
    ]
    const layer = Git.Memory.make({ commits })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getCommitsSince(undefined)
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toHaveLength(2)
    expect(result[0]!.message).toBe('feat(core): feature 1')
  })

  test('getCommitsSince fails when tag is missing', async () => {
    const layer = Git.Memory.make({ tags: [] })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getCommitsSince('@kitz/core@1.0.0')
      }).pipe(Effect.provide(layer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('GitError')
      expect(result.failure.context.operation).toBe('getCommitsSince')
    }
  })

  test('getTagSha fails when tag is missing', async () => {
    const layer = Git.Memory.make({ tags: [] })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getTagSha('@kitz/core@1.0.0')
      }).pipe(Effect.provide(layer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('GitError')
      expect(result.failure.context.operation).toBe('getTagSha')
    }
  })

  test('createTag adds tag and records it', async () => {
    const { layer, state } = await Effect.runPromise(Git.Memory.makeWithState({}))

    await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        yield* git.createTag('@kitz/core@1.0.0', 'Release v1.0.0')
      }).pipe(Effect.provide(layer)),
    )

    const tags = await Effect.runPromise(Ref.get(state.tags))
    const created = await Effect.runPromise(Ref.get(state.createdTags))

    expect(tags).toContain('@kitz/core@1.0.0')
    expect(created).toContainEqual({ tag: '@kitz/core@1.0.0', message: 'Release v1.0.0' })
  })

  test('pushTags records remote', async () => {
    const { layer, state } = await Effect.runPromise(Git.Memory.makeWithState({}))

    await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        yield* git.pushTags('upstream')
      }).pipe(Effect.provide(layer)),
    )

    const pushed = await Effect.runPromise(Ref.get(state.pushedTags))
    expect(pushed).toContainEqual({ remote: 'upstream' })
  })

  test('pushTag records tag, remote, and force flag', async () => {
    const { layer, state } = await Effect.runPromise(Git.Memory.makeWithState({}))

    await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        yield* git.pushTag('@kitz/core@1.0.0-next.1', 'origin', true)
      }).pipe(Effect.provide(layer)),
    )

    const pushed = await Effect.runPromise(Ref.get(state.pushedTags))
    expect(pushed).toContainEqual({
      tag: '@kitz/core@1.0.0-next.1',
      remote: 'origin',
      force: true,
    })
  })

  test('deleteTag removes tag and records deletion', async () => {
    const { layer, state } = await Effect.runPromise(
      Git.Memory.makeWithState({ tags: ['@kitz/core@1.0.0'] }),
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        yield* git.deleteTag('@kitz/core@1.0.0')
      }).pipe(Effect.provide(layer)),
    )

    const tags = await Effect.runPromise(Ref.get(state.tags))
    const deleted = await Effect.runPromise(Ref.get(state.deletedTags))

    expect(tags).not.toContain('@kitz/core@1.0.0')
    expect(deleted).toContain('@kitz/core@1.0.0')
  })

  test('getCommitsSince returns all commits for non-package and unmatched tags', async () => {
    const commits = [
      Git.Memory.commit('feat(core): add feature'),
      Git.Memory.commit('fix(core): patch'),
    ]
    const layer = Git.Memory.make({
      tags: ['v1.0.0', '@kitz/core@1.0.0'],
      commits,
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        const nonPackageTag = yield* git.getCommitsSince('v1.0.0')
        const unmatchedTag = yield* git.getCommitsSince('@kitz/core@1.0.0')
        return { nonPackageTag, unmatchedTag }
      }).pipe(Effect.provide(layer)),
    )

    expect(result.nonPackageTag).toEqual(commits)
    expect(result.unmatchedTag).toEqual(commits)
  })

  test('getTagSha, isAncestor, and commitExists use in-memory state', async () => {
    const releaseSha = Git.Sha.make('abc1234')
    const headSha = Git.Sha.make('def5678')
    const layer = Git.Memory.make({
      commits: [Git.Memory.commit('feat(core): add feature', { hash: headSha })],
      headSha,
    })
    const { layer: statefulLayer, state } = await Effect.runPromise(Git.Memory.makeWithState({}))

    await Effect.runPromise(Ref.set(state.tagShas, { '@kitz/core@1.0.0': releaseSha }))
    await Effect.runPromise(
      Ref.set(state.commitParents, { [headSha]: [releaseSha], [releaseSha]: [] }),
    )
    await Effect.runPromise(
      Ref.set(state.commits, [Git.Memory.commit('feat(core): add feature', { hash: headSha })]),
    )

    const memoryResult = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return {
          tagSha: yield* git.getTagSha('@kitz/core@1.0.0'),
          isAncestor: yield* git.isAncestor(releaseSha, headSha),
          isNotAncestor: yield* git.isAncestor(headSha, releaseSha),
          commitExists: yield* git.commitExists(headSha),
          parentExists: yield* git.commitExists(releaseSha),
          missingCommit: yield* git.commitExists(Git.Sha.make('feed123')),
        }
      }).pipe(Effect.provide(statefulLayer)),
    )

    const configuredHead = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getHeadSha()
      }).pipe(Effect.provide(layer)),
    )

    expect(memoryResult.tagSha).toBe(releaseSha)
    expect(memoryResult.isAncestor).toBe(true)
    expect(memoryResult.isNotAncestor).toBe(false)
    expect(memoryResult.commitExists).toBe(true)
    expect(memoryResult.parentExists).toBe(true)
    expect(memoryResult.missingCommit).toBe(false)
    expect(configuredHead).toBe(headSha)
  })

  test('createTagAt, deleteRemoteTag, and getRemoteUrl update mutable state', async () => {
    const { layer, state } = await Effect.runPromise(
      Git.Memory.makeWithState({ remoteUrl: 'git@github.com:kitz/test.git' }),
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        yield* git.createTagAt('@kitz/core@1.0.1', 'abc1234', 'release')
        yield* git.deleteRemoteTag('@kitz/core@1.0.1', 'upstream')
        return yield* git.getRemoteUrl('upstream')
      }).pipe(Effect.provide(layer)),
    )

    const tags = await Effect.runPromise(Ref.get(state.tags))
    const tagShas = await Effect.runPromise(Ref.get(state.tagShas))
    const createdTags = await Effect.runPromise(Ref.get(state.createdTags))
    const deletedRemoteTags = await Effect.runPromise(Ref.get(state.deletedRemoteTags))
    const remoteUrl = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getRemoteUrl()
      }).pipe(Effect.provide(layer)),
    )

    expect(tags).toContain('@kitz/core@1.0.1')
    expect(tagShas['@kitz/core@1.0.1']).toBe('abc1234')
    expect(createdTags).toContainEqual({ tag: '@kitz/core@1.0.1', message: 'release' })
    expect(deletedRemoteTags).toContainEqual({ tag: '@kitz/core@1.0.1', remote: 'upstream' })
    expect(remoteUrl).toBe('git@github.com:kitz/test.git')
  })
})

// ============================================================================
// Commit Schema
// ============================================================================

describe('Commit', () => {
  test('creates valid commit with all fields', () => {
    const commit = Git.Commit.make({
      hash: Git.Sha.make('abc1234'),
      message: 'feat(core): add feature\n\nDetailed description',
      author: Git.Author.make({ name: 'Jane Doe', email: 'jane@example.com' }),
      date: new Date('2024-01-15'),
    })

    expect(commit.hash).toBe('abc1234')
    expect(commit.message).toBe('feat(core): add feature\n\nDetailed description')
    expect(commit.author.name).toBe('Jane Doe')
    expect(commit.author.email).toBe('jane@example.com')
  })

  test('ParsedCommit replaces the message field with a parsed schema', () => {
    class ReleaseCommit extends Git.ParsedCommit<ReleaseCommit>()(
      'ReleaseCommit',
      Schema.Struct({
        type: Schema.String,
      }),
    ) {
      static make = this.makeUnsafe
    }

    const commit = ReleaseCommit.make({
      hash: Git.Sha.make('abc1234'),
      message: {
        type: 'feat',
      },
      author: Git.Author.make({ name: 'Jane Doe', email: 'jane@example.com' }),
      date: new Date('2024-01-15'),
    })

    expect(commit.message).toEqual({
      type: 'feat',
    })
  })

  test('round-trips commit dates through JSON encoding', () => {
    const commit = Git.Commit.make({
      hash: Git.Sha.make('abc1234'),
      message: 'feat(core): add feature\n\nDetailed description',
      author: Git.Author.make({ name: 'Jane Doe', email: 'jane@example.com' }),
      date: new Date('2024-01-15T00:00:00.000Z'),
    })

    const encoded = Schema.encodeSync(Git.Commit)(commit)
    const decoded = Schema.decodeSync(Git.Commit)(encoded)

    expect(encoded.date).toBe('2024-01-15T00:00:00.000Z')
    expect(decoded.date).toBeInstanceOf(Date)
    expect(decoded.date.toISOString()).toBe('2024-01-15T00:00:00.000Z')
  })

  test('rejects non-canonical commit date strings during JSON decode', () => {
    expect(() =>
      Schema.decodeSync(Git.Commit)({
        _tag: 'Commit',
        hash: Git.Sha.make('abc1234'),
        message: 'feat(core): add feature',
        author: {
          _tag: 'Author',
          name: 'Jane Doe',
          email: 'jane@example.com',
        },
        date: '01/15/2024',
      }),
    ).toThrow('Invalid commit date format')
  })
})

describe('Git service errors', () => {
  test('formats GitError and GitParseError messages with optional detail', () => {
    const error = new Git.GitError({
      context: { operation: 'getTags', detail: 'origin' },
      cause: new Error('failed'),
    })
    const parseError = new Git.GitParseError({
      context: { operation: 'getHeadSha' },
      cause: new Error('invalid sha'),
    })

    expect(error.message).toBe('Git getTags failed: origin')
    expect(parseError.message).toBe('Git getHeadSha parse failed')
  })
})

// ============================================================================
// Memory Utilities
// ============================================================================

describe('Memory utilities', () => {
  test('commit helper creates valid commit', () => {
    const commit = Git.Memory.commit('fix(cli): resolve issue')

    expect(commit.message).toBe('fix(cli): resolve issue')
    expect(Git.Sha.is(commit.hash)).toBe(true)
    expect(commit.author.name).toBe('Test Author')
  })

  test('commit helper accepts overrides', () => {
    const sha = Git.Sha.make('abcd1234')
    const commit = Git.Memory.commit('feat: new\n\nCustom body', { hash: sha })

    expect(commit.hash).toBe(sha)
    expect(commit.message).toBe('feat: new\n\nCustom body')
  })

  test('makeWithState provides mutable state access', async () => {
    const { layer, state } = await Effect.runPromise(Git.Memory.makeWithState({ branch: 'main' }))

    // Modify state
    await Effect.runPromise(Ref.set(state.branch, 'develop'))

    // Verify service sees updated state
    const branch = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getCurrentBranch()
      }).pipe(Effect.provide(layer)),
    )

    expect(branch).toBe('develop')
  })
})

// ============================================================================
// Live Layer (integration tests against real git)
// ============================================================================

describe.sequential('GitLive', () => {
  test('GitLive uses the current working directory when it is a repo', async () => {
    const repo = makeTempGitRepo()
    const originalCwd = process.cwd()

    try {
      process.chdir(repo.root)

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getCurrentBranch()
        }).pipe(Effect.provide(Git.GitLive)),
      )

      expect(result).toBe('main')
    } finally {
      process.chdir(originalCwd)
      repo.cleanup()
    }
  })

  test('getTags returns repo tags', async () => {
    const repo = makeTempGitRepo()

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getTags()
        }).pipe(Effect.provide(Git.makeGitLive(repo.root))),
      )

      expect(result).toContain('@kitz/core@1.0.0')
    } finally {
      repo.cleanup()
    }
  })

  test('getCurrentBranch returns the repo branch', async () => {
    const repo = makeTempGitRepo()

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getCurrentBranch()
        }).pipe(Effect.provide(Git.makeGitLive(repo.root))),
      )

      expect(result).toBe('main')
    } finally {
      repo.cleanup()
    }
  })

  test('isClean returns the repo status', async () => {
    const repo = makeTempGitRepo()

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.isClean()
        }).pipe(Effect.provide(Git.makeGitLive(repo.root))),
      )

      expect(result).toBe(true)
    } finally {
      repo.cleanup()
    }
  })

  test('getHeadSha returns a valid SHA for the repo head', async () => {
    const repo = makeTempGitRepo()

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getHeadSha()
        }).pipe(Effect.provide(Git.makeGitLive(repo.root))),
      )

      expect(Git.Sha.is(result)).toBe(true)
    } finally {
      repo.cleanup()
    }
  })

  test('getCommitsSince returns the repo commit history', async () => {
    const repo = makeTempGitRepo()

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getCommitsSince(undefined)
        }).pipe(Effect.provide(Git.makeGitLive(repo.root))),
      )

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0]).toHaveProperty('hash')
      expect(result[0]).toHaveProperty('message')
      expect(result[0]).toHaveProperty('author')
      expect(result[0]).toHaveProperty('date')
    } finally {
      repo.cleanup()
    }
  })

  test('covers tag, ancestry, remote, and deletion operations against a real repo', async () => {
    const repo = makeTempGitRepo()

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          const root = yield* git.getRoot()
          const tagSha = yield* git.getTagSha('@kitz/core@1.0.0')
          const headSha = yield* git.getHeadSha()
          const ancestor = yield* git.isAncestor(tagSha, headSha)
          const reverseAncestor = yield* git.isAncestor(Git.Sha.make('deadbee'), headSha)
          const existingCommit = yield* git.commitExists(headSha)
          const missingCommit = yield* git.commitExists(Git.Sha.make('deadbee'))
          const remoteUrl = yield* git.getRemoteUrl('origin')

          yield* git.createTag('v1.0.1', 'annotated release')
          yield* git.createTag('scratch')
          yield* git.createTagAt('v1.0.0-hotfix', repo.releaseSha, 'hotfix release')
          yield* git.createTagAt('v1.0.0-lightweight', repo.releaseSha)
          yield* git.pushTags('origin')
          yield* git.pushTag('v1.0.0-lightweight', 'origin', true)
          yield* git.deleteRemoteTag('v1.0.0-lightweight', 'origin')
          yield* git.deleteTag('v1.0.1')

          return {
            root,
            tagSha,
            headSha,
            ancestor,
            reverseAncestor,
            existingCommit,
            missingCommit,
            remoteUrl,
          }
        }).pipe(Effect.provide(Git.makeGitLive(repo.root))),
      )

      expect(realpathSync(result.root)).toBe(realpathSync(repo.root))
      expect(result.tagSha.startsWith(repo.releaseSha)).toBe(true)
      expect(Git.Sha.is(result.headSha)).toBe(true)
      expect(result.ancestor).toBe(true)
      expect(result.reverseAncestor).toBe(false)
      expect(result.existingCommit).toBe(true)
      expect(result.missingCommit).toBe(false)
      expect(realpathSync(result.remoteUrl)).toBe(realpathSync(repo.remote))
      expect(runGit(repo.root, ['tag'])).not.toContain('v1.0.1')
      expect(runGit(repo.root, ['ls-remote', '--tags', 'origin'])).not.toContain(
        'v1.0.0-lightweight',
      )
    } finally {
      repo.cleanup()
    }
  })

  test('wraps live git failures in GitError', async () => {
    const root = mkdtempSync(join(tmpdir(), 'kitz-git-invalid-'))

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getRoot()
        }).pipe(Effect.provide(Git.makeGitLive(root)), Effect.result),
      )

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.failure._tag).toBe('GitError')
        expect(result.failure.context.operation).toBe('getRoot')
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

// ============================================================================
// Gitignore
// ============================================================================

describe('Gitignore', () => {
  const { Gitignore } = Git

  // ─── Round-trip (fromString → toString) ────────────────────────────────────

  Test.describe('round-trip')
    .on((content: string) => Gitignore.toString(Gitignore.fromString(content)))
    .casesInput(
      'node_modules/\n*.log\n',
      '# Dependencies\nnode_modules/\n\n# Build\ndist/\n',
      '*.log\n!important.log\n',
      '',
    )
    .test()

  // ─── patterns ──────────────────────────────────────────────────────────────

  Test.describe('patterns')
    .on((content: string) => Gitignore.fromString(content).patterns)
    .cases(
      [['node_modules/\n*.log\n'], ['node_modules/', '*.log']],
      [['*.log\n!important.log\n'], ['*.log', '!important.log']],
    )
    .test()

  // ─── hasPattern ────────────────────────────────────────────────────────────

  const gi = Gitignore.fromString('node_modules/\n!keep/\n')

  // oxfmt-ignore
  Test.describe('hasPattern')
    .on((pattern: string) => gi.hasPattern(pattern))
    .cases(
      [['node_modules/'],      true],
      [['dist/'],              false],
      [['./node_modules/'],    true],   // normalization
      [['  node_modules/  '],  true],   // trimming
      [['keep/'],              false],  // negated ignored by default
    )
    .test()

  Test.describe('hasPattern > matchNegated')
    .on((pattern: string) => Gitignore.hasPattern(gi, pattern, { matchNegated: true }))
    .cases([['keep/'], true])
    .test()

  // ─── addPattern ────────────────────────────────────────────────────────────

  // oxfmt-ignore
  Test.describe('addPattern')
    .on((pattern: string) => Gitignore.addPattern(Gitignore.empty, pattern).patterns)
    .cases(
      [['node_modules/'],    ['node_modules/']],
      [['./node_modules/'],  ['node_modules/']],  // normalization
      [['  foo  '],          ['foo']],            // trimming
    )
    .test()

  Test.describe('addPattern > to existing')
    .on((pattern: string) => Gitignore.fromString('foo/\n').addPattern(pattern).patterns)
    .cases([['bar/'], ['foo/', 'bar/']])
    .test()

  test('addPattern > no duplicate', () => {
    const g = Gitignore.fromString('foo/\n')
    expect(Gitignore.addPattern(g, 'foo/')).toBe(g)
  })

  Test.describe('addPattern > section')
    .on(() =>
      Gitignore.toString(
        Gitignore.addPattern(Gitignore.fromString('# Dependencies\nnode_modules/\n'), 'vendor/', {
          section: 'Dependencies',
        }),
      ),
    )
    .cases({ input: [] })
    .test()

  Test.describe('addPattern > new section')
    .on(() =>
      Gitignore.toString(
        Gitignore.addPattern(Gitignore.fromString('foo/\n'), 'bar/', { section: 'New Section' }),
      ),
    )
    .cases({ input: [] })
    .test()

  Test.describe('addPattern > negated')
    .on(() => Gitignore.toString(Gitignore.addPattern(Gitignore.empty, 'keep/', { negated: true })))
    .cases([[], '!keep/\n'])
    .test()

  // ─── removePattern ─────────────────────────────────────────────────────────

  // oxfmt-ignore
  Test.describe('removePattern')
    .on((pattern: string) => Gitignore.fromString('foo/\nbar/\n').removePattern(pattern).patterns)
    .cases(
      [['foo/'],    ['bar/']],
      [['./foo/'],  ['bar/']],       // normalization
      [['baz/'],    ['foo/', 'bar/']], // not found
    )
    .test()

  // ─── empty ─────────────────────────────────────────────────────────────────

  Test.describe('empty')
    .on(() => ({
      patterns: Gitignore.empty.patterns,
      encoded: Gitignore.toString(Gitignore.empty),
    }))
    .cases([[], { patterns: [], encoded: '' }])
    .test()
})
