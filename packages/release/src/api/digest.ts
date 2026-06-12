import { Json } from '@kitz/json'
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'

export class Digest extends Sch.Class<Digest>()('Digest', {
  algorithm: Schema.Literal('sha256'),
  value: Schema.String,
}) {}

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

/**
 * SHA-256 digest of text or raw bytes (`Bun.CryptoHasher` accepts both).
 */
export const sha256 = (value: string | Uint8Array): Digest =>
  Digest.make({
    algorithm: 'sha256',
    value: new Bun.CryptoHasher('sha256').update(value).digest('hex'),
  })

/** Input-narrowed view of {@link sha256} for text content. */
export const sha256Text: (value: string) => Digest = sha256

/** Input-narrowed view of {@link sha256} for raw bytes. */
export const sha256Bytes: (value: Uint8Array) => Digest = sha256

export const sha256Json = (value: unknown): Digest => sha256(canonicalJson(value))
