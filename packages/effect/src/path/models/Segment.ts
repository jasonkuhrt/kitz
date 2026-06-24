import { Schema as S, SchemaGetter } from 'effect'
import { Statics } from './core.js'

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
const Up = Statics.Codec(
  S.asClass(
    UpEncoded.pipe(
      S.decodeTo(UpDecoded, {
        decode: SchemaGetter.transform(() => upDecoded),
        encode: SchemaGetter.transform(() => upEncoded),
      }),
    ),
  ),
)

/**
 * A current-directory step (`.`) — a no-op that resolves away during normalization.
 * Internal decoded form; the public codec is {@link Here}.
 */
class HereDecoded extends S.TaggedClass<HereDecoded>()('Here', {}) {}

/** Codec for a current-directory step: `'.'` ⇄ {@link HereDecoded}. */
const Here = Statics.Codec(
  S.asClass(
    S.Literal('.').pipe(
      S.decodeTo(HereDecoded, {
        decode: SchemaGetter.transform(() => HereDecoded.make({})),
        encode: SchemaGetter.transform(() => '.'),
      }),
    ),
  ),
)

/**
 * The string payload of a {@link Name} step: a POSIX-safe path component that is
 * not a traversal reference (no `/` or NUL, non-empty, not `.` or `..`).
 */
const NameEncodedString = S.String.pipe(
  S.check(
    S.makeFilter((s) => s.length > 0, { message: 'Path segment cannot be empty' }),
    // oxlint-disable-next-line no-control-regex -- matching NUL is intentional: POSIX path segments may not contain it.
    S.isPattern(/^[^/\u0000]+$/, { message: 'Path segment cannot contain / or null bytes' }),
    S.makeFilter((s) => s !== '.' && s !== '..', {
      message: '"." and ".." are traversal references, not names',
    }),
  ),
)

/**
 * A named-descent step — moving into a single named directory or file component.
 * Internal decoded form; the public codec is {@link Name}.
 */
class NameDecoded extends S.TaggedClass<NameDecoded>()('Name', { name: NameEncodedString }) {}

/** Codec for a named-descent step: `name` ⇄ {@link NameDecoded}. */
const Name = Statics.Codec(
  S.asClass(
    NameEncodedString.pipe(
      S.decodeTo(NameDecoded, {
        decode: SchemaGetter.transform((name) => NameDecoded.make({ name })),
        encode: SchemaGetter.transform((step) => step.name),
      }),
    ),
  ),
)

/**
 * `Segment` — one step of a path: a parent traversal (`..`, {@link Up}), a
 * current-dir no-op (`.`, {@link Here}), or a named descent ({@link Name}). The
 * binding **is** the `string` ⇄ step codec; its codec statics (`is`, `decodeSync`,
 * `encodeSync`, …) come from {@link Statics.Codec}.
 *
 * @example
 * ```ts
 * Segment.decodeSync('..')   // Up
 * Segment.decodeSync('.')    // Here
 * Segment.decodeSync('src')  // Name { name: 'src' }
 * ```
 */
class Segment_ extends Statics.Codec(S.asClass(S.Union([Up, Here, Name]))) {
  static Name = Name
  static Up = Up
  static Here = Here

  /** Whether a step is a parent traversal (`..`). */
  static isParent = (segment: Segment): boolean => segment._tag === 'Up'
}

export const Segment = Segment_
export type Segment = typeof Segment_.Type
