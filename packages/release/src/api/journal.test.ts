import { describe, expect, test } from 'bun:test'
import { DateTime, Effect, Layer } from 'effect'
import * as fc from 'fast-check'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Test } from '@kitz/test'
import { arbIso, arbJsonRecord, roundtrips } from '../test-support.js'
import { SideEffectEntry, SideEffectKind } from './contract/journal.js'
import { Digest, sha256Json } from './digest.js'
import {
  appendHash,
  appendSideEffect,
  findPublishEntries,
  journalPathFor,
  readEntries,
  verifyChain,
} from './journal.js'

const planDigest = Digest.make({ algorithm: 'sha256', value: 'a'.repeat(64) })
const utc = (iso: string): DateTime.Utc => DateTime.makeUnsafe(iso)
const updateSideEffectEntry = (
  entry: SideEffectEntry,
  overrides: Partial<SideEffectEntry>,
): SideEffectEntry => SideEffectEntry.make(Object.assign({}, entry, overrides))

describe('journal hash chain', () => {
  test('detects edited entries', () => {
    const first = appendHash({
      entryId: '1',
      planDigest,
      kind: 'registry-publish',
      subject: '@kitz/core@1.0.0',
      idempotencyKey: 'publish-core',
      planned: { package: '@kitz/core' },
      attemptedAt: utc('2026-01-01T00:00:00Z'),
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
        attemptedAt: utc('2026-01-01T00:00:01Z'),
        result: 'succeeded',
      },
      first,
    )

    expect(verifyChain([first, second])).toBe(true)
    const edited = updateSideEffectEntry(second, { subject: 'tampered' })
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
          attemptedAt: utc('2026-01-01T00:00:00Z'),
        })
        yield* appendSideEffect({
          planDigest,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: { packageName: '@kitz/core' },
          result: 'succeeded',
          attemptedAt: utc('2026-01-01T00:00:01Z'),
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

  test('append never rewrites prior journal bytes (crash-safe audit evidence)', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const path = journalPathFor(cwd, planDigest)
        yield* appendSideEffect({
          planDigest,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: { packageName: '@kitz/core' },
          result: 'attempting',
          attemptedAt: utc('2026-01-01T00:00:00Z'),
        })
        const afterFirst = yield* Fs.readString(path)
        yield* appendSideEffect({
          planDigest,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: { packageName: '@kitz/core' },
          result: 'succeeded',
          attemptedAt: utc('2026-01-01T00:00:01Z'),
        })
        const afterSecond = yield* Fs.readString(path)
        const entries = yield* readEntries(path)
        return { afterFirst, afterSecond, entries }
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    // Existing bytes are untouched: the first write is a strict prefix of the
    // file after the second append.
    expect(result.afterSecond.startsWith(result.afterFirst)).toBe(true)
    expect(result.afterSecond.length).toBeGreaterThan(result.afterFirst.length)
    // The chain still links and verifies across the appended entries.
    expect(result.entries).toHaveLength(2)
    expect(result.entries[1]!.prevEntrySha256?.value).toBe(result.entries[0]!.entrySha256.value)
    expect(verifyChain(result.entries)).toBe(true)
  })

  test('tampering with persisted entries is detected after append-only writes', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const path = journalPathFor(cwd, planDigest)
        yield* appendSideEffect({
          planDigest,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: { packageName: '@kitz/core' },
          result: 'succeeded',
          attemptedAt: utc('2026-01-01T00:00:00Z'),
        })
        const raw = yield* Fs.readString(path)
        yield* Fs.write(path, raw.replace('@kitz/core@1.0.0', '@evil/pkg@9.9.9'))
        const entries = yield* readEntries(path)
        return verifyChain(entries)
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(result).toBe(false)
  })

  test('finds successful publish entries for a subject across plan journals', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const otherPlan = Digest.make({ algorithm: 'sha256', value: 'b'.repeat(64) })
    const entries = await Effect.runPromise(
      Effect.gen(function* () {
        yield* appendSideEffect({
          planDigest,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: {},
          result: 'attempting',
          attemptedAt: utc('2026-01-01T00:00:00Z'),
        })
        yield* appendSideEffect({
          planDigest,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: {},
          result: 'succeeded',
          attemptedAt: utc('2026-01-01T00:00:01Z'),
        })
        yield* appendSideEffect({
          planDigest: otherPlan,
          kind: 'registry-publish',
          subject: '@kitz/core@1.0.0',
          planned: {},
          result: 'succeeded',
          attemptedAt: utc('2026-01-01T00:00:02Z'),
        })
        yield* appendSideEffect({
          planDigest: otherPlan,
          kind: 'git-tag-push',
          subject: '@kitz/core@1.0.0',
          planned: {},
          result: 'succeeded',
          attemptedAt: utc('2026-01-01T00:00:03Z'),
        })
        return yield* findPublishEntries('@kitz/core@1.0.0')
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    // Only successful registry-publish entries match — one per plan journal.
    expect(entries).toHaveLength(2)
    // oxlint-disable-next-line kitz/domain/no-native-map-set -- Read-only order-insensitive comparison.
    expect(new Set(entries.map((entry) => entry.planDigest.value))).toEqual(
      // oxlint-disable-next-line kitz/domain/no-native-map-set -- Read-only order-insensitive comparison.
      new Set([planDigest.value, otherPlan.value]),
    )
    expect(entries.every((entry) => entry.kind === 'registry-publish')).toBe(true)
    expect(entries.every((entry) => entry.result === 'succeeded')).toBe(true)
  })

  test('finds nothing when the journal directory does not exist', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const entries = await Effect.runPromise(
      findPublishEntries('@kitz/core@1.0.0').pipe(
        Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd }))),
      ),
    )

    expect(entries).toEqual([])
  })
})

// ── Properties ───────────────────────────────────────────────────────

roundtrips('SideEffectEntry', SideEffectEntry)

const sideEffectKinds = SideEffectKind.literals
const sideEffectResults = ['attempting', 'succeeded', 'failed'] as const

type SideEffectEntryInput = Parameters<typeof appendHash>[0]

const arbEntryInput: fc.Arbitrary<SideEffectEntryInput> = fc.record({
  entryId: fc.string(),
  planDigest: fc.constant(planDigest),
  kind: fc.constantFrom(...sideEffectKinds),
  subject: fc.string(),
  idempotencyKey: fc.string(),
  planned: arbJsonRecord,
  attemptedAt: arbIso.map((iso) => DateTime.makeUnsafe(iso)),
  result: fc.constantFrom(...sideEffectResults),
})

const makeChain = (inputs: readonly SideEffectEntryInput[]): SideEffectEntry[] => {
  const entries: SideEffectEntry[] = []
  for (const input of inputs) {
    entries.push(appendHash(input, entries.at(-1)))
  }
  return entries
}

const rotate = <const T>(values: readonly T[], current: T): T =>
  values[(values.indexOf(current) + 1) % values.length]!

// Every mutation below is guaranteed to change the entry's hashed content or
// its chain linkage, so the property's "tampered" precondition always holds:
// string fields get a suffix, literal fields rotate to the next literal, the
// planned record gains/changes a key whose value always differs from the
// original, timestamps shift by one second, and digests change value.
const tamperMutations: readonly ((entry: SideEffectEntry) => SideEffectEntry)[] = [
  (entry) => updateSideEffectEntry(entry, { entryId: `${entry.entryId}x` }),
  (entry) => updateSideEffectEntry(entry, { subject: `${entry.subject}x` }),
  (entry) => updateSideEffectEntry(entry, { idempotencyKey: `${entry.idempotencyKey}x` }),
  (entry) => updateSideEffectEntry(entry, { kind: rotate(sideEffectKinds, entry.kind) }),
  (entry) => updateSideEffectEntry(entry, { result: rotate(sideEffectResults, entry.result) }),
  (entry) =>
    updateSideEffectEntry(entry, {
      planned: {
        ...entry.planned,
        __tampered: `${JSON.stringify(entry.planned['__tampered'] ?? null)}x`,
      },
    }),
  (entry) =>
    updateSideEffectEntry(entry, { attemptedAt: DateTime.add(entry.attemptedAt, { seconds: 1 }) }),
  (entry) =>
    updateSideEffectEntry(entry, {
      entrySha256: Digest.make({ algorithm: 'sha256', value: `${entry.entrySha256.value}0` }),
    }),
  (entry) => updateSideEffectEntry(entry, { prevEntrySha256: sha256Json('forged-previous-entry') }),
]

Test.property(
  'verifyChain accepts every untampered chain and rejects any single-field mutation of any entry',
  fc.array(arbEntryInput, { minLength: 1, maxLength: 5 }),
  fc.nat(),
  fc.nat(),
  (inputs, entrySeed, mutationSeed) => {
    const entries = makeChain(inputs)
    expect(verifyChain(entries)).toBe(true)

    const index = entrySeed % entries.length
    const mutate = tamperMutations[mutationSeed % tamperMutations.length]!
    const tampered = entries.map((entry, i) => (i === index ? mutate(entry) : entry))
    expect(verifyChain(tampered)).toBe(false)
  },
)
