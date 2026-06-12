import { Git } from '@kitz/git'
import { Effect, Ref } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Violation } from '../models/violation.js'
import { rule } from './git-history-monotonic.js'

const runWithHistory = (params: {
  readonly tags: string[]
  readonly tagShas: Record<string, string>
  readonly commitParents: Record<string, string[]>
}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { layer, state } = yield* Git.Memory.makeWithState({ tags: params.tags })
      yield* Ref.set(
        state.tagShas,
        Object.fromEntries(
          Object.entries(params.tagShas).map(([tag, sha]) => [tag, Git.Sha.make(sha)]),
        ),
      )
      yield* Ref.set(state.commitParents, params.commitParents)
      return yield* rule.check().pipe(Effect.provide(layer))
    }),
  )

describe('git.history.monotonic', () => {
  test('passes when versions increase with commit order', async () => {
    const result = await runWithHistory({
      tags: ['@kitz/core@1.0.0', '@kitz/core@1.1.0'],
      tagShas: {
        '@kitz/core@1.0.0': 'aaa1234',
        '@kitz/core@1.1.0': 'bbb1234',
      },
      commitParents: { bbb1234: ['aaa1234'] },
    })

    expect(result).toBeUndefined()
  })

  test('violation carries the audit detail instead of a bare location', async () => {
    const result = await runWithHistory({
      tags: ['@kitz/core@1.0.0', '@kitz/core@1.1.0'],
      tagShas: {
        '@kitz/core@1.0.0': 'aaa1234',
        '@kitz/core@1.1.0': 'bbb1234',
      },
      // 1.1.0 (bbb1234) is the ancestor of 1.0.0 (aaa1234) — out of order.
      commitParents: { aaa1234: ['bbb1234'] },
    })

    expect(Violation.is(result)).toBe(true)
    if (!Violation.is(result)) throw new Error('expected a violation')

    expect(result.location._tag).toBe('ViolationLocationGitHistory')
    expect(result.summary).toBe('Version history for @kitz/core is not monotonic (1 violation).')
    expect(result.detail).toContain('1.1.0 at bbb1234 comes BEFORE 1.0.0 at aaa1234')
  })
})
