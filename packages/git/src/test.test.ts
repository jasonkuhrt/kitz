import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { Git } from './_.js'
import * as GitTest from './test.js'

const { GitError } = Git

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect as Effect.Effect<A>)
const runExit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromiseExit(effect)

describe('Git test service — happy-path defaults', () => {
  test('make() provides a driver with all methods scripted to succeed', async () => {
    const git = GitTest.make()

    const program = Effect.gen(function* () {
      const svc = yield* Git.Git
      const branch = yield* svc.getCurrentBranch()
      const clean = yield* svc.isClean()
      const root = yield* svc.getRoot()
      const remote = yield* svc.getRemoteUrl()
      const tags = yield* svc.getTags()
      return { branch, clean, root, remote, tags }
    })

    const result = await run(program.pipe(Effect.provide(git.$test.layer())))
    expect(result.branch).toBe('main')
    expect(result.clean).toBe(true)
    expect(result.root).toBe('/repo')
    expect(result.remote).toBe('git@github.com:example/repo.git')
    expect(result.tags).toEqual([])
  })

  test('config overrides the happy-path defaults', async () => {
    const git = GitTest.make({ branch: 'develop', tags: ['v1.0.0'], isClean: false })

    const program = Effect.gen(function* () {
      const svc = yield* Git.Git
      return {
        branch: yield* svc.getCurrentBranch(),
        tags: yield* svc.getTags(),
        clean: yield* svc.isClean(),
      }
    })

    const result = await run(program.pipe(Effect.provide(git.$test.layer())))
    expect(result.branch).toBe('develop')
    expect(result.tags).toEqual(['v1.0.0'])
    expect(result.clean).toBe(false)
  })

  test('void methods (createTag, pushTag) succeed by default', async () => {
    const git = GitTest.make()

    const program = Effect.gen(function* () {
      const svc = yield* Git.Git
      yield* svc.createTag('v2.0.0', 'release')
      yield* svc.pushTag('v2.0.0')
    })

    const exit = await runExit(program.pipe(Effect.provide(git.$test.layer())))
    expect(exit._tag).toBe('Success')
  })
})

describe('Git test service — failure injection without re-stubbing', () => {
  test('inject a createTag failure on the happy-path driver', async () => {
    const git = GitTest.make()
    git.createTag.everyFail(
      new GitError({
        context: { operation: 'createTag', detail: 'remote rejected' },
        cause: new Error('remote rejected'),
      }),
    )

    const program = Effect.gen(function* () {
      const svc = yield* Git.Git
      yield* svc.createTag('v3.0.0')
    })

    const exit = await runExit(program.pipe(Effect.provide(git.$test.layer())))
    expect(exit._tag).toBe('Failure')
  })

  test('other methods still succeed after one is set to fail', async () => {
    const git = GitTest.make()
    git.pushTagsAtomic.everyFail(
      new GitError({
        context: { operation: 'pushTagsAtomic' },
        cause: new Error('push failed'),
      }),
    )

    const program = Effect.gen(function* () {
      const svc = yield* Git.Git
      const branch = yield* svc.getCurrentBranch()
      return branch
    })

    const result = await run(program.pipe(Effect.provide(git.$test.layer())))
    expect(result).toBe('main')
  })
})

describe('Git test service — call inspection', () => {
  test('records calls to driven methods', async () => {
    const git = GitTest.make()

    const program = Effect.gen(function* () {
      const svc = yield* Git.Git
      yield* svc.createTag('v1.0.0', 'first')
      yield* svc.createTag('v2.0.0')
    })

    await run(program.pipe(Effect.provide(git.$test.layer())))

    // normalizeArgs: 2 args -> tuple; 1 arg (omitted optional) -> scalar.
    expect(git.createTag.calls).toEqual([[['v1.0.0', 'first']], ['v2.0.0']])
  })
})
