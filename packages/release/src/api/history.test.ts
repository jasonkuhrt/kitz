import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Ref } from 'effect'
import { describe, expect, test } from 'vitest'
import * as History from './analyzer/history.js'

const packageName = '@kitz/core'
const version = Semver.fromString('1.0.0')
const makeTag = (name: string, versionString: string) =>
  Pkg.Pin.toString(
    Pkg.Pin.Exact.make({
      name: Pkg.Moniker.parse(name),
      version: Semver.fromString(versionString),
    }),
  )

const tag = makeTag(packageName, '1.0.0')

const setupGitHistory = async (params: {
  readonly tags: string[]
  readonly commits: readonly ReturnType<typeof Git.Memory.commit>[]
  readonly tagShas: Record<string, Git.Sha.Sha>
  readonly commitParents?: Record<string, string[]>
}) => {
  const { layer, state } = await Effect.runPromise(
    Git.Memory.makeWithState({
      tags: params.tags,
      commits: [...params.commits],
    }),
  )

  await Effect.runPromise(Ref.set(state.tagShas, params.tagShas))
  if (params.commitParents) {
    await Effect.runPromise(Ref.set(state.commitParents, params.commitParents))
  }

  return { layer, state }
}

const coreTag = (versionString: string) => makeTag('@kitz/core', versionString)
const cliTag = (versionString: string) => makeTag('@kitz/cli', versionString)

const coreRelease = (versionString: string, hash: Git.Sha.Sha) =>
  Git.Memory.commit(`feat(core): release ${versionString}`, { hash })

const cliRelease = (versionString: string, hash: Git.Sha.Sha) =>
  Git.Memory.commit(`feat(cli): release ${versionString}`, { hash })

const auditResult = (
  packageName: string,
  valid: boolean,
): {
  packageName: string
  valid: boolean
  releases: Array<{ tag: string; version: Semver.Semver; sha: Git.Sha.Sha }>
  violations: Array<{
    earlier: { tag: string; version: Semver.Semver; sha: Git.Sha.Sha }
    later: { tag: string; version: Semver.Semver; sha: Git.Sha.Sha }
    message: string
  }>
} => ({
  packageName,
  valid,
  releases: [],
  violations: valid
    ? []
    : [
        {
          earlier: {
            tag,
            version,
            sha: Git.Sha.make('abc1234'),
          },
          later: {
            tag: coreTag('2.0.0'),
            version: Semver.fromString('2.0.0'),
            sha: Git.Sha.make('def5678'),
          },
          message: 'version order is invalid',
        },
      ],
})

describe('History.set', () => {
  test('creates and pushes a new tag when the version ordering is valid', async () => {
    const oldSha = Git.Sha.make('abc1234')
    const newSha = Git.Sha.make('def5678')
    const newTag = coreTag('1.1.0')
    const { layer, state } = await setupGitHistory({
      tags: [tag],
      commits: [coreRelease('1.1.0', newSha), coreRelease('1.0.0', oldSha)],
      tagShas: { [tag]: oldSha },
      commitParents: { [newSha]: [oldSha] },
    })

    const result = await Effect.runPromise(
      History.set({
        sha: newSha,
        pkg: packageName,
        ver: Semver.fromString('1.1.0'),
        push: true,
        remote: 'upstream',
      }).pipe(Effect.provide(layer)),
    )

    expect(result.action).toBe('created')
    expect(result.pushed).toBe(true)
    expect(History.formatSetResult(result)).toContain('Created tag')

    const tagShas = await Effect.runPromise(Ref.get(state.tagShas))
    const pushedTags = await Effect.runPromise(Ref.get(state.pushedTags))
    expect(tagShas[newTag]).toBe(newSha)
    expect(pushedTags).toContainEqual({ tag: newTag, remote: 'upstream', force: false })
  })

  test('moves existing tag and revalidates against refreshed tag list', async () => {
    const oldSha = Git.Sha.make('abc1234')
    const newSha = Git.Sha.make('def5678')

    const { layer, state } = await setupGitHistory({
      tags: [tag],
      commits: [Git.Memory.commit('feat(core): release move', { hash: newSha })],
      tagShas: { [tag]: oldSha },
    })

    const result = await Effect.runPromise(
      History.set({
        sha: newSha,
        pkg: packageName,
        ver: version,
        move: true,
        push: false,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.action).toBe('moved')
    expect(result.tag).toBe(tag)
    expect(result.sha).toBe(newSha)

    const tagShas = await Effect.runPromise(Ref.get(state.tagShas))
    const deletedRemoteTags = await Effect.runPromise(Ref.get(state.deletedRemoteTags))
    expect(tagShas[tag]).toBe(newSha)
    expect(deletedRemoteTags).toEqual([])
  })

  test('returns unchanged without pushing when the tag already points at the requested SHA', async () => {
    const sha = Git.Sha.make('abc1234')
    const { layer, state } = await setupGitHistory({
      tags: [tag],
      commits: [coreRelease('1.0.0', sha)],
      tagShas: { [tag]: sha },
    })

    const result = await Effect.runPromise(
      History.set({
        sha,
        pkg: packageName,
        ver: version,
        push: false,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.action).toBe('unchanged')
    expect(result.pushed).toBe(false)
    expect(History.formatSetResult(result)).toContain('already exists')

    const pushedTags = await Effect.runPromise(Ref.get(state.pushedTags))
    expect(pushedTags).toEqual([])
  })

  test('re-pushes an unchanged tag when push is enabled', async () => {
    const sha = Git.Sha.make('abc1234')
    const { layer, state } = await setupGitHistory({
      tags: [tag],
      commits: [coreRelease('1.0.0', sha)],
      tagShas: { [tag]: sha },
    })

    const result = await Effect.runPromise(
      History.set({
        sha,
        pkg: packageName,
        ver: version,
        push: true,
        remote: 'upstream',
      }).pipe(Effect.provide(layer)),
    )

    expect(result.action).toBe('unchanged')
    expect(result.pushed).toBe(true)

    const pushedTags = await Effect.runPromise(Ref.get(state.pushedTags))
    expect(pushedTags).toContainEqual({ tag, remote: 'upstream', force: false })
  })

  test('fails when the requested tag exists at a different SHA without move', async () => {
    const existingSha = Git.Sha.make('abc1234')
    const requestedSha = Git.Sha.make('def5678')
    const { layer } = await setupGitHistory({
      tags: [tag],
      commits: [coreRelease('1.0.0', requestedSha)],
      tagShas: { [tag]: existingSha },
    })

    const result = await Effect.runPromise(
      History.set({
        sha: requestedSha,
        pkg: packageName,
        ver: version,
        push: false,
      }).pipe(Effect.provide(layer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('TagExistsError')
      if (result.failure._tag !== 'TagExistsError') {
        throw new Error('expected tag-exists failure')
      }
      expect(History.formatTagExistsError(result.failure)).toContain('Use --move')
    }
  })

  test('fails when the requested commit does not exist', async () => {
    const result = await Effect.runPromise(
      History.set({
        sha: Git.Sha.make('abc1234'),
        pkg: packageName,
        ver: version,
        push: false,
      }).pipe(Effect.provide(Git.Memory.make({ tags: [], commits: [] })), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('HistoryError')
      expect(result.failure.message).toContain('does not exist in repository')
    }
  })

  test('fails when the requested version would violate monotonic ordering', async () => {
    const previousSha = Git.Sha.make('abc1234')
    const requestedSha = Git.Sha.make('def5678')
    const higherTag = coreTag('2.0.0')
    const { layer } = await setupGitHistory({
      tags: [higherTag],
      commits: [coreRelease('1.0.0', requestedSha), coreRelease('2.0.0', previousSha)],
      tagShas: { [higherTag]: previousSha },
      commitParents: { [requestedSha]: [previousSha] },
    })

    const result = await Effect.runPromise(
      History.set({
        sha: requestedSha,
        pkg: packageName,
        ver: version,
        push: false,
      }).pipe(Effect.provide(layer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('MonotonicViolationError')
      if (result.failure._tag !== 'MonotonicViolationError') {
        throw new Error('expected monotonic violation failure')
      }
      expect(History.formatMonotonicViolationError(result.failure)).toContain(
        'Versions must increase with commit order',
      )
    }
  })

  test('does not delete the original tag before a move passes monotonic validation', async () => {
    const oldSha = Git.Sha.make('abc1234')
    const previousSha = Git.Sha.make('fedcba9')
    const requestedSha = Git.Sha.make('def5678')
    const higherTag = coreTag('2.0.0')
    const { layer, state } = await setupGitHistory({
      tags: [tag, higherTag],
      commits: [
        coreRelease('1.0.0', requestedSha),
        coreRelease('2.0.0', previousSha),
        coreRelease('1.0.0', oldSha),
      ],
      tagShas: {
        [tag]: oldSha,
        [higherTag]: previousSha,
      },
      commitParents: { [requestedSha]: [previousSha] },
    })

    const result = await Effect.runPromise(
      History.set({
        sha: requestedSha,
        pkg: packageName,
        ver: version,
        move: true,
        push: true,
      }).pipe(Effect.provide(layer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('MonotonicViolationError')
    }

    const tagShas = await Effect.runPromise(Ref.get(state.tagShas))
    const deletedTags = await Effect.runPromise(Ref.get(state.deletedTags))
    const deletedRemoteTags = await Effect.runPromise(Ref.get(state.deletedRemoteTags))

    expect(tagShas[tag]).toBe(oldSha)
    expect(deletedTags).toEqual([])
    expect(deletedRemoteTags).toEqual([])
  })
})

describe('History.audit', () => {
  test('audits all tagged packages and formats mixed results', async () => {
    const coreOne = Git.Sha.make('abc1234')
    const coreTwo = Git.Sha.make('def5678')
    const cliTwo = Git.Sha.make('fedcba9')
    const cliOne = Git.Sha.make('cba9876')
    const { layer } = await setupGitHistory({
      tags: [coreTag('1.0.0'), coreTag('2.0.0'), cliTag('2.0.0'), cliTag('1.0.0')],
      commits: [
        coreRelease('2.0.0', coreTwo),
        coreRelease('1.0.0', coreOne),
        cliRelease('1.0.0', cliOne),
        cliRelease('2.0.0', cliTwo),
      ],
      tagShas: {
        [coreTag('1.0.0')]: coreOne,
        [coreTag('2.0.0')]: coreTwo,
        [cliTag('2.0.0')]: cliTwo,
        [cliTag('1.0.0')]: cliOne,
      },
      commitParents: {
        [coreTwo]: [coreOne],
        [cliOne]: [cliTwo],
      },
    })

    const results = await Effect.runPromise(History.audit().pipe(Effect.provide(layer)))
    const formatted = History.formatAuditResults(results)

    expect(results).toHaveLength(2)
    expect(results.find((result) => result.packageName === '@kitz/core')?.valid).toBe(true)
    expect(results.find((result) => result.packageName === '@kitz/cli')?.valid).toBe(false)
    expect(formatted).toContain('Auditing release history...')
    expect(formatted).toContain('1 package(s) with violations')
  })

  test('audits a single package when requested', async () => {
    const oldSha = Git.Sha.make('abc1234')
    const newSha = Git.Sha.make('def5678')
    const { layer } = await setupGitHistory({
      tags: [coreTag('1.0.0'), coreTag('2.0.0'), cliTag('1.0.0')],
      commits: [
        coreRelease('2.0.0', newSha),
        coreRelease('1.0.0', oldSha),
        cliRelease('1.0.0', Git.Sha.make('fedcba9')),
      ],
      tagShas: {
        [coreTag('1.0.0')]: oldSha,
        [coreTag('2.0.0')]: newSha,
        [cliTag('1.0.0')]: Git.Sha.make('fedcba9'),
      },
      commitParents: {
        [newSha]: [oldSha],
      },
    })

    const results = await Effect.runPromise(
      History.audit({ pkg: '@kitz/core' }).pipe(Effect.provide(layer)),
    )

    expect(results).toHaveLength(1)
    expect(results[0]!.packageName).toBe('@kitz/core')
    expect(History.formatAuditResult(results[0]!)).toContain('All 2 releases in valid order')
  })

  test('formats audit helpers for empty and invalid aggregates', () => {
    const validResult = auditResult('@kitz/core', true)
    const invalidResult = auditResult('@kitz/cli', false)

    expect(History.formatAuditResult(validResult)).toContain('@kitz/core:')
    expect(History.formatAuditResult(invalidResult)).toContain('version order is invalid')
    expect(History.formatAuditResults([validResult])).toContain(
      'All packages have valid release history',
    )
  })
})
