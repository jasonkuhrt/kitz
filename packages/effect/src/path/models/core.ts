import { Schema as S } from 'effect'

/**
 * Count of leading parent-traversal (`..`) steps in a segment list.
 *
 * Shared by the relative path value classes; absolute paths can't lead with `..`,
 * so they simply don't expose `back`. Typed structurally on `_tag` to avoid a
 * `core` ⇄ `Segment` import cycle.
 */
export const back = (segments: readonly { readonly _tag: string }[]): number => {
  let count = 0
  for (const segment of segments) {
    if (segment._tag === 'Up') count++
    else break
  }
  return count
}

/**
 * The codec statics baked on by {@link Statics.Codec}, as a **named** generic type.
 *
 * Being named is the whole point: a class that extends the combinator emits
 * `RelFile_base: B & CodecStatics<B>` — both halves are references, so the type
 * serializes compactly instead of inlining the full class (which overflows
 * declaration emit, TS7056). This mirrors effect's `Class<Self, S, Inherited>`
 * and `@heartbeat/effect-plus`'s `PlusStatics<TypeSide>`.
 */
export interface CodecStatics<B extends S.Codec<unknown, string, never, never>> {
  new (_: never): {}
  /** Type guard for this type. */
  readonly is: (u: unknown) => u is B['Type']
  /** Decode from the canonical string form. Throws on invalid input. */
  readonly fromString: (input: string) => B['Type']
  readonly encodeSync: (input: B['Type']) => B['Encoded']
  readonly decodeSync: (input: B['Encoded']) => B['Type']
  readonly encode: ReturnType<typeof S.encodeEffect<B>>
  readonly decode: ReturnType<typeof S.decodeEffect<B>>
  readonly decodeExit: ReturnType<typeof S.decodeUnknownExit<B>>
}

/**
 * Combinators that bake schema-operation statics onto a class so codec classes
 * don't hand-repeat them. A plain const object (not a `namespace`) to stay
 * erasable under `erasableSyntaxOnly`.
 */
export const Statics = {
  /**
   * Add the standard codec statics to an `S.asClass(...)`'d string codec.
   *
   * Factory-style: `export const Abs = Statics.Codec(S.asClass(S.Union([…])))`,
   * or extend it to add bespoke statics:
   *
   * ```ts
   * class Segment_ extends Statics.Codec(S.asClass(S.Union([Up, Here, Name]))) {
   *   static isParent = (s: Segment): boolean => s._tag === 'Up'
   * }
   * ```
   *
   * The return type is the **named** {@link CodecStatics}, not the inferred class —
   * that's what keeps declaration emit compact. The body is cast through since its
   * structural type is irrelevant to the public signature.
   */
  Codec: <B extends S.Codec<unknown, string, never, never>>(base: B): B & CodecStatics<B> => {
    const Base = base as B & (new (_: never) => {})
    return class extends Base {
      static is = S.is(base)
      static fromString = (input: string): B['Type'] => S.decodeSync(base)(input)
      static encodeSync = S.encodeSync(base)
      static decodeSync = S.decodeSync(base)
      static encode = S.encodeEffect(base)
      static decode = S.decodeEffect(base)
      static decodeExit = S.decodeUnknownExit(base)
    } as unknown as B & CodecStatics<B>
  },
}
