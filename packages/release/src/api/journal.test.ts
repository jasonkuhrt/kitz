import { describe, expect, test } from 'bun:test'
import { appendHash, verifyChain } from './journal.js'
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
})
