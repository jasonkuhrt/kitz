import { Schema as S, SchemaGetter } from 'effect'
import { Statics } from '../core.js'

/**
 * A current-directory step (`.`) — a no-op that resolves away during normalization.
 * Internal decoded form; the public codec is {@link Here}.
 */
class HereDecoded extends S.TaggedClass<HereDecoded>()('Here', {}) {}

const HereEncoded = S.Literal('.')

/// ━ Constant Values

const hereDecoded = HereDecoded.make()
const hereEncoded = HereEncoded.literal

/// ━ With Codec

/** Codec for a current-directory step: `'.'` ⇄ {@link HereDecoded}. */
export const Here = Statics.Codec(
  S.asClass(
    HereEncoded.pipe(
      S.decodeTo(HereDecoded, {
        decode: SchemaGetter.transform(() => hereDecoded),
        encode: SchemaGetter.transform(() => hereEncoded),
      }),
    ),
  ),
)

export type Here = typeof Here.Type
