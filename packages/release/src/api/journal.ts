import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect, FileSystem, Schema } from 'effect'
import { sha256Json } from './digest.js'
import { jsonLinesFile } from './persistence.js'
import { PlanDigest, SideEffectEntry, type SideEffectKind } from './release-contract.js'

const journalDir = Fs.Path.RelDir.fromString('./.release/journal/')
const journalResource = jsonLinesFile(SideEffectEntry)

export interface SideEffectInput {
  readonly planDigest: string | PlanDigest
  readonly kind: SideEffectKind
  readonly subject: string
  readonly planned: Readonly<Record<string, unknown>>
  readonly result: SideEffectEntry['result']
  readonly attemptedAt?: string
}

const entryDigestInput = (entry: SideEffectEntry): unknown => {
  const encoded = Schema.encodeSync(SideEffectEntry)(entry)
  const { entrySha256: _, ...withoutHash } = encoded
  return withoutHash
}

export const hashEntry = (entry: SideEffectEntry) => sha256Json(entryDigestInput(entry))

export const appendHash = (
  entry: Omit<SideEffectEntry, 'entrySha256' | 'prevEntrySha256'>,
  previous?: SideEffectEntry,
): SideEffectEntry => {
  const pending = SideEffectEntry.make({
    ...entry,
    ...(previous !== undefined ? { prevEntrySha256: previous.entrySha256 } : {}),
    entrySha256: sha256Json('pending'),
  })

  return SideEffectEntry.make(Object.assign({}, pending, { entrySha256: hashEntry(pending) }))
}

export const verifyChain = (entries: readonly SideEffectEntry[]): boolean =>
  entries.every((entry, index) => {
    const previous = entries[index - 1]
    const expectedPrevious = previous?.entrySha256
    const hasExpectedPrevious =
      expectedPrevious === undefined
        ? entry.prevEntrySha256 === undefined
        : entry.prevEntrySha256?.value === expectedPrevious.value
    return hasExpectedPrevious && hashEntry(entry).value === entry.entrySha256.value
  })

export const journalPathFor = (
  cwd: Fs.Path.AbsDir,
  planDigest: string | PlanDigest,
): Fs.Path.AbsFile => {
  const digest = typeof planDigest === 'string' ? planDigest : planDigest.value
  return Fs.Path.join(
    Fs.Path.join(cwd, journalDir),
    Fs.Path.RelFile.fromString(`./${digest}.jsonl`),
  )
}

export const readEntries = (
  path: Fs.Path.AbsFile,
): Effect.Effect<readonly SideEffectEntry[], Resource.ResourceError, FileSystem.FileSystem> =>
  journalResource.read(path)

export const writeEntries = (
  path: Fs.Path.AbsFile,
  entries: readonly SideEffectEntry[],
): Effect.Effect<void, Resource.ResourceError, FileSystem.FileSystem> =>
  journalResource.write(entries, path)

export const makeEntry = (input: SideEffectInput, previous?: SideEffectEntry): SideEffectEntry => {
  const planDigest =
    typeof input.planDigest === 'string'
      ? PlanDigest.make({ algorithm: 'sha256', value: input.planDigest })
      : input.planDigest
  const attemptedAt = input.attemptedAt ?? new Date().toISOString()
  return appendHash(
    {
      entryId: `${input.kind}:${input.subject}:${input.result}:${attemptedAt}`,
      planDigest,
      kind: input.kind,
      subject: input.subject,
      idempotencyKey: sha256Json({
        planDigest: planDigest.value,
        kind: input.kind,
        subject: input.subject,
        planned: input.planned,
      }).value,
      planned: input.planned,
      attemptedAt,
      result: input.result,
    },
    previous,
  )
}

export const appendSideEffect = (
  input: SideEffectInput,
): Effect.Effect<SideEffectEntry, Resource.ResourceError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const path = journalPathFor(env.cwd, input.planDigest)
    const entries = yield* readEntries(path)
    const previous = entries.at(-1)
    const entry = makeEntry(input, previous)
    yield* writeEntries(path, [...entries, entry])
    return entry
  })
