import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { DateTime, Effect, FileSystem, Schema } from 'effect'
import * as ReleaseClock from './clock.js'
import { SideEffectEntry, type SideEffectKind } from './contract/journal.js'
import { Digest, sha256Json } from './digest.js'

const journalDir = Fs.Path.RelDir.fromString('./.release/journal/')
const journalResource = Resource.createJsonLines('journal.jsonl', SideEffectEntry)

export interface SideEffectInput {
  readonly planDigest: string | Digest
  readonly kind: SideEffectKind
  readonly subject: string
  readonly planned: Readonly<Record<string, unknown>>
  readonly result: SideEffectEntry['result']
  readonly attemptedAt?: DateTime.Utc
}

type TimedSideEffectInput = SideEffectInput & {
  readonly attemptedAt: DateTime.Utc
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
  planDigest: string | Digest,
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
  journalResource.readOrEmpty(path)

export const writeEntries = (
  path: Fs.Path.AbsFile,
  entries: readonly SideEffectEntry[],
): Effect.Effect<void, Resource.ResourceError, FileSystem.FileSystem> =>
  journalResource.write(entries, path)

export const makeEntry = (
  input: TimedSideEffectInput,
  previous?: SideEffectEntry,
): SideEffectEntry => {
  const planDigest =
    typeof input.planDigest === 'string'
      ? Digest.make({ algorithm: 'sha256', value: input.planDigest })
      : input.planDigest
  return appendHash(
    {
      entryId: `${input.kind}:${input.subject}:${input.result}:${DateTime.formatIso(
        input.attemptedAt,
      )}`,
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
      attemptedAt: input.attemptedAt,
      result: input.result,
    },
    previous,
  )
}

/**
 * Append one side effect to the plan-bound journal.
 *
 * The previous entry is read to extend the hash chain, but the write itself
 * is an O(1) filesystem append — existing journal bytes are never rewritten,
 * so a crash mid-append cannot truncate prior audit evidence.
 */
export const appendSideEffect = (
  input: SideEffectInput,
): Effect.Effect<SideEffectEntry, Resource.ResourceError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const path = journalPathFor(env.cwd, input.planDigest)
    const entries = yield* readEntries(path)
    const previous = entries.at(-1)
    const attemptedAt = input.attemptedAt ?? (yield* ReleaseClock.now)
    const entry = makeEntry({ ...input, attemptedAt }, previous)
    yield* journalResource.append(entry, path)
    return entry
  })

/**
 * Successful `registry-publish` journal entries for a release subject
 * (`<package>@<version>`), scanned across every plan-bound journal under
 * `.release/journal/`.
 */
export const findPublishEntries = (
  subject: string,
): Effect.Effect<
  readonly SideEffectEntry[],
  Resource.ResourceError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const root = Fs.Path.join(env.cwd, journalDir)
    const files = yield* fs
      .readDirectory(Fs.Path.toString(root))
      .pipe(Effect.orElseSucceed(() => [] as string[]))

    const groups = yield* Effect.forEach(
      files.filter((name) => name.endsWith('.jsonl')),
      (name) => readEntries(Fs.Path.join(root, Fs.Path.RelFile.fromString(`./${name}`))),
      { concurrency: 4 },
    )

    return groups
      .flat()
      .filter(
        (entry) =>
          entry.kind === 'registry-publish' &&
          entry.result === 'succeeded' &&
          entry.subject === subject,
      )
  })
