import { Schema as S, SchemaGetter } from 'effect'
import { Statics } from '../core.js'

/**
 * A parent-traversal step (`..`) — moving up one directory.
 * Internal decoded form; the public codec is {@link Up}.
 */
class UpDecoded extends S.TaggedClass<UpDecoded>()('Up', {}) {}

const UpEncoded = S.Literal('..')

/// ━ Constant Values

const upDecoded = UpDecoded.make()
const upEncoded = UpEncoded.literal

/// ━ With Codec

/** Codec for a parent-traversal step: `'..'` ⇄ {@link UpDecoded}. */
export const Up = Statics.Codec(
  S.asClass(
    UpEncoded.pipe(
      S.decodeTo(UpDecoded, {
        decode: SchemaGetter.transform(() => upDecoded),
        encode: SchemaGetter.transform(() => upEncoded),
      }),
    ),
  ),
)

export type Up = typeof Up.Type
