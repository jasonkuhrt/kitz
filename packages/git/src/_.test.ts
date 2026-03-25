import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Test } from '@kitz/test'
import { Effect, Ref, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { Git } from './_.js'

const runGit = (cwd: string, args: readonly string[]): string => {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  })

  if ((result.status ?? 1) !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim())
  }

  return result.stdout.trim()
}

const createTempGitRepo = () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'kitz-git-'))
  const repoDir = join(rootDir, 'repo')
  const remoteDir = join(rootDir, 'remote.git')

  mkdirSync(repoDir)
  runGit(rootDir, ['init', '--bare', remoteDir])
  runGit(repoDir, ['init', '-b', 'main'])
  runGit(repoDir, ['config', 'user.name', 'Kitz Test'])
  runGit(repoDir, ['config', 'user.email', 'kitz@example.com'])
  runGit(repoDir, ['remote', 'add', 'origin', remoteDir])

  writeFileSync(join(repoDir, 'package.txt'), 'v1\n')
  runGit(repoDir, ['add', 'package.txt'])
  runGit(repoDir, ['commit', '-m', 'feat(core): release 1.0.0'])
  runGit(repoDir, ['tag', '-a', '@kitz/core@1.0.0', '-m', 'Release 1.0.0'])

  writeFileSync(join(repoDir, 'package.txt'), 'v2\n')
  runGit(repoDir, ['add', 'package.txt'])
  runGit(repoDir, ['commit', '-m', 'feat(core): release 1.1.0'])

  return {
    repoDir,
    remoteDir,
    cleanup: () => rmSync(rootDir, { recursive: true, force: true }),
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

  test('memory git covers ancestry, tag SHAs, and remote bookkeeping', async () => {
    const first = Git.Memory.commit('feat(core): release 1.0.0', { hash: Git.Sha.make('abc1234') })
    const second = Git.Memory.commit('feat(core): release 1.1.0', { hash: Git.Sha.make('def5678') })

    const { layer, state } = await Effect.runPromise(
      Git.Memory.makeWithState({
        tags: ['v1.0.0', '@kitz/core@1.0.0'],
        commits: [second, first],
        remoteUrl: 'git@github.com:kitz/repo.git',
      }),
    )

    await Effect.runPromise(
      Ref.set(state.tagShas, {
        '@kitz/core@1.0.0': first.hash,
      }),
    )
    await Effect.runPromise(
      Ref.set(state.commitParents, {
        [second.hash]: [first.hash],
      }),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git

        const plainTagCommits = yield* git.getCommitsSince('v1.0.0')
        const versionTagCommits = yield* git.getCommitsSince('@kitz/core@1.0.0')
        const tagSha = yield* git.getTagSha('@kitz/core@1.0.0')
        const isAncestor = yield* git.isAncestor(first.hash, second.hash)
        const isNotAncestor = yield* git.isAncestor(second.hash, first.hash)
        yield* git.createTagAt('v1.1.0', second.hash, 'Release 1.1.0')
        const headCommitExists = yield* git.commitExists(second.hash)
        const parentCommitExists = yield* git.commitExists(first.hash)
        const missingCommitExists = yield* git.commitExists('deadbee')
        yield* git.pushTag('v1.1.0', 'upstream', true)
        yield* git.deleteRemoteTag('v1.1.0', 'upstream')
        const remoteUrl = yield* git.getRemoteUrl('upstream')

        return {
          plainTagCommits,
          versionTagCommits,
          tagSha,
          isAncestor,
          isNotAncestor,
          headCommitExists,
          parentCommitExists,
          missingCommitExists,
          remoteUrl,
        }
      }).pipe(Effect.provide(layer)),
    )

    expect(result.plainTagCommits).toHaveLength(2)
    expect(result.versionTagCommits).toHaveLength(1)
    expect(result.versionTagCommits[0]?.hash).toBe(second.hash)
    expect(result.tagSha).toBe(first.hash)
    expect(result.isAncestor).toBe(true)
    expect(result.isNotAncestor).toBe(false)
    expect(result.headCommitExists).toBe(true)
    expect(result.parentCommitExists).toBe(true)
    expect(result.missingCommitExists).toBe(false)
    expect(result.remoteUrl).toBe('git@github.com:kitz/repo.git')

    const createdTags = await Effect.runPromise(Ref.get(state.createdTags))
    const pushedTags = await Effect.runPromise(Ref.get(state.pushedTags))
    const deletedRemoteTags = await Effect.runPromise(Ref.get(state.deletedRemoteTags))
    const tagShas = await Effect.runPromise(Ref.get(state.tagShas))

    expect(createdTags).toContainEqual({ tag: 'v1.1.0', message: 'Release 1.1.0' })
    expect(pushedTags).toContainEqual({ remote: 'upstream' })
    expect(deletedRemoteTags).toContainEqual({ tag: 'v1.1.0', remote: 'upstream' })
    expect(tagShas['v1.1.0']).toBe(second.hash)
  })
})

// ============================================================================
// Live Layer (integration tests against real git)
// ============================================================================

describe('GitLive', () => {
  test('getTags returns array', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getTags()
      }).pipe(Effect.provide(Git.GitLive)),
    )

    expect(Array.isArray(result)).toBe(true)
  })

  test('getCurrentBranch returns string', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getCurrentBranch()
      }).pipe(Effect.provide(Git.GitLive)),
    )

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('isClean returns boolean', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.isClean()
      }).pipe(Effect.provide(Git.GitLive)),
    )

    expect(typeof result).toBe('boolean')
  })

  test('getHeadSha returns valid SHA', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getHeadSha()
      }).pipe(Effect.provide(Git.GitLive)),
    )

    expect(Git.Sha.is(result)).toBe(true)
  })

  test('getCommitsSince returns commits with expected shape', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getCommitsSince(undefined)
      }).pipe(Effect.provide(Git.GitLive)),
    )

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('hash')
    expect(result[0]).toHaveProperty('message')
    expect(result[0]).toHaveProperty('author')
    expect(result[0]).toHaveProperty('date')
  })

  test('makeGitLive operates against a temp repository end to end', async () => {
    const tempRepo = createTempGitRepo()

    try {
      const layer = Git.makeGitLive(tempRepo.repoDir)

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git

          const root = yield* git.getRoot()
          const branch = yield* git.getCurrentBranch()
          const isClean = yield* git.isClean()
          const headSha = yield* git.getHeadSha()
          const tags = yield* git.getTags()
          const tagSha = yield* git.getTagSha('@kitz/core@1.0.0')
          const commitsSince = yield* git.getCommitsSince('@kitz/core@1.0.0')
          const isAncestor = yield* git.isAncestor(tagSha, headSha)
          const commitExists = yield* git.commitExists(headSha)
          yield* git.createTag('v1.1.1', 'Release 1.1.1')
          yield* git.createTagAt('v1.1.2', headSha, 'Release 1.1.2')
          yield* git.pushTags('origin')
          yield* git.pushTag('v1.1.2', 'origin', true)
          yield* git.deleteRemoteTag('v1.1.2', 'origin')
          const remoteUrl = yield* git.getRemoteUrl('origin')
          yield* git.deleteTag('v1.1.1')
          const tagsAfterDelete = yield* git.getTags()

          return {
            root,
            branch,
            isClean,
            headSha,
            tags,
            tagSha,
            commitsSince,
            isAncestor,
            commitExists,
            remoteUrl,
            tagsAfterDelete,
          }
        }).pipe(Effect.provide(layer)),
      )

      const remoteTags = runGit(tempRepo.remoteDir, ['tag', '--list']).split('\n').filter(Boolean)

      expect(result.root.replace(/^\/private/, '')).toBe(tempRepo.repoDir)
      expect(result.branch).toBe('main')
      expect(result.isClean).toBe(true)
      expect(Git.Sha.is(result.headSha)).toBe(true)
      expect(result.tags).toContain('@kitz/core@1.0.0')
      expect(Git.Sha.is(result.tagSha)).toBe(true)
      expect(result.commitsSince).toHaveLength(1)
      expect(result.isAncestor).toBe(true)
      expect(result.commitExists).toBe(true)
      expect(result.remoteUrl).toBe(tempRepo.remoteDir)
      expect(result.tagsAfterDelete).not.toContain('v1.1.1')
      expect(remoteTags).toContain('@kitz/core@1.0.0')
      expect(remoteTags).toContain('v1.1.1')
      expect(remoteTags).not.toContain('v1.1.2')
    } finally {
      tempRepo.cleanup()
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
