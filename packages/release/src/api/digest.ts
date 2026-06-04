import { Json } from '@kitz/json'
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
}

/**
 * RFC 8785 (JCS) canonical JSON used as digest input.
 *
 * Every plan, config, and idempotency digest rides on this, so canonicalization
 * must be byte-stable across machines and locales. The implementation lives in
 * {@link Json.canonicalize} (a general JSON primitive); release only composes
 * it: object members sort by UTF-16 code unit (not locale collation), keys are
 * never Unicode-normalized, and numbers/strings use ECMAScript serialization.
 */
export const canonicalJson = (value: unknown): string => Json.canonicalize(value)

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
