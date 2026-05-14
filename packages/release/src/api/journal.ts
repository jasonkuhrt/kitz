import { Schema } from 'effect'
import { sha256Json } from './digest.js'
import { SideEffectEntry } from './release-contract.js'

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

  return SideEffectEntry.make({
    ...pending,
    entrySha256: hashEntry(pending),
  })
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
