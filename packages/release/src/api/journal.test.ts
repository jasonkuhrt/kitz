import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import {
  appendHash,
  appendSideEffect,
  journalPathFor,
  readEntries,
  verifyChain,
} from './journal.js'
import { PlanDigest, SideEffectEntry } from './release-contract.js'

const planDigest = PlanDigest.make({ algorithm: 'sha256', value: 'a'.repeat(64) })

describe('journal hash chain', () => {
  test('detects edited entries', () => {
    const first = appendHash({
      entryId: '1',
      planDigest,
      kind: 'registry-publish',
      subject: '@kitz/core@1.0.0',
      idempotencyKey: 'publish-core',
      planned: { package: '@kitz/core' },
      attemptedAt: '2026-01-01T00:00:00Z',
      result: 'succeeded',
    })
    const second = appendHash(
      {
        entryId: '2',
        planDigest,
        kind: 'git-tag-create',
        subject: '@kitz/core@1.0.0',
        idempotencyKey: 'tag-core',
        planned: { tag: '@kitz/core@1.0.0' },
        attemptedAt: '2026-01-01T00:00:01Z',
        result: 'succeeded',
      },
      first,
    )

    expect(verifyChain([first, second])).toBe(true)
    const edited = SideEffectEntry.make({ ...second, subject: 'tampered' })
    expect(verifyChain([first, edited])).toBe(false)
  })

  test('appends plan-bound side effects to a durable hash chain', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* appendSideEffect({
          planDigest,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: { packageName: '@kitz/core' },
          result: 'attempting',
          attemptedAt: '2026-01-01T00:00:00Z',
        })
        yield* appendSideEffect({
          planDigest,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: { packageName: '@kitz/core' },
          result: 'succeeded',
          attemptedAt: '2026-01-01T00:00:01Z',
        })
        const path = journalPathFor(cwd, planDigest)
        const entries = yield* readEntries(path)
        const raw = yield* Fs.readString(path)
        return { entries, path, raw }
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(Fs.Path.toString(result.path)).toBe(`/repo/.release/journal/${planDigest.value}.jsonl`)
    expect(result.raw.trim().split('\n')).toHaveLength(2)
    expect(result.entries.map((entry) => entry.result)).toEqual(['attempting', 'succeeded'])
    expect(verifyChain(result.entries)).toBe(true)
  })
})
