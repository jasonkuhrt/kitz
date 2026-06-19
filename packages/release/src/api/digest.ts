import { Array as A, Record as EffectRecord, Schema } from 'effect'

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
}

const compareKeys = (a: string, b: string): number => a.localeCompare(b)

const isObjectLike = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object'

const normalizeJsonValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return A.map(value, normalizeJsonValue)
  if (!isObjectLike(value)) return value

  return A.reduce(
    A.filter(Object.keys(value), (key) => value[key] !== undefined).toSorted(compareKeys),
    EffectRecord.empty<string, unknown>(),
    (record, key) => EffectRecord.set(record, key.normalize('NFC'), normalizeJsonValue(value[key])),
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
