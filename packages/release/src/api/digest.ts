import { Schema } from 'effect'

export class Digest extends Schema.Class<Digest>('Digest')({
  algorithm: Schema.Literal('sha256'),
  value: Schema.String,
}) {
  static is = Schema.is(Digest)
  static decode = Schema.decodeUnknownEffect(Digest)
  static decodeSync = Schema.decodeUnknownSync(Digest)
  static encode = Schema.encodeUnknownEffect(Digest)
  static encodeSync = Schema.encodeUnknownSync(Digest)
  static equivalence = Schema.toEquivalence(Digest)
  static ordered = false as const
  static make = this.makeUnsafe
}

const compareKeys = (a: string, b: string): number => a.localeCompare(b)

const normalizeJsonValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalizeJsonValue)
  if (value === null || typeof value !== 'object') return value

  const record = value as Readonly<Record<string, unknown>>
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .toSorted(compareKeys)
      .map((key) => [key.normalize('NFC'), normalizeJsonValue(record[key])]),
  )
}

export const canonicalJson = (value: unknown): string => JSON.stringify(normalizeJsonValue(value))

export const sha256Text = (value: string): Digest =>
  Digest.make({
    algorithm: 'sha256',
    value: new Bun.CryptoHasher('sha256').update(value).digest('hex'),
  })

export const sha256Bytes = (value: Uint8Array): Digest =>
  Digest.make({
    algorithm: 'sha256',
    value: new Bun.CryptoHasher('sha256').update(value).digest('hex'),
  })

export const sha256Json = (value: unknown): Digest => sha256Text(canonicalJson(value))
