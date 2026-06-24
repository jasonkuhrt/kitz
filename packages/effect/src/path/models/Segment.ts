import { Schema as S, SchemaGetter } from 'effect'

/**
 * A parent-traversal step (`..`) — moving up one directory.
 * Internal decoded form; the public codec is {@link Up}.
 */
class UpDecoded extends S.TaggedClass<UpDecoded>()('Up', {}) {}

/**
 * Codec for a parent-traversal step: `'..'` ⇄ {@link UpDecoded}.
 * Used as a member of {@link Segment}'s union.
 */
class Up_ extends S.asClass(
  S.Literal('..').pipe(
    S.decodeTo(UpDecoded, {
      decode: SchemaGetter.transform(() => UpDecoded.make({})),
      encode: SchemaGetter.transform(() => '..'),
    }),
  ),
) {
  static is = S.is(this)
}

const Up = Up_

/**
 * A current-directory step (`.`) — a no-op that resolves away during normalization.
 * Internal decoded form; the public codec is {@link Here}.
 */
class HereDecoded extends S.TaggedClass<HereDecoded>()('Here', {}) {}

/**
 * Codec for a current-directory step: `'.'` ⇄ {@link HereDecoded}.
 * Used as a member of {@link Segment}'s union.
 */
class Here_ extends S.asClass(
  S.Literal('.').pipe(
    S.decodeTo(HereDecoded, {
      decode: SchemaGetter.transform(() => HereDecoded.make({})),
      encode: SchemaGetter.transform(() => '.'),
    }),
  ),
) {
  static is = S.is(this)
}

const Here = Here_

/**
 * The string payload of a {@link Name} step: a POSIX-safe path component that is
 * not a traversal reference.
 *
 * - cannot contain `/` (path separator) or NUL
 * - cannot be empty (would create `//`)
 * - cannot be `.` or `..` (those are not names — `..` is an {@link Up} step, and
 *   `.` is a no-op resolved away during normalization)
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

/**
 * Codec for a named-descent step: `name` ⇄ {@link NameDecoded}.
 * Used as a member of {@link Segment}'s union.
 */
class Name_ extends S.asClass(
  NameEncodedString.pipe(
    S.decodeTo(NameDecoded, {
      decode: SchemaGetter.transform((name) => NameDecoded.make({ name })),
      encode: SchemaGetter.transform((step) => step.name),
    }),
  ),
) {
  static is = S.is(this)
}

const Name = Name_

/**
 * `Segment` — one step of a path: either a parent traversal (`..`, an {@link Up})
 * or a named descent (a {@link Name}). The binding **is** the string codec
 * (`string` ⇄ `Up | Name`), usable directly as a schema — e.g. `S.Array(Segment)`.
 *
 * @example
 * ```ts
 * Segment.decodeSync('..')   // Up
 * Segment.decodeSync('.')    // Here
 * Segment.decodeSync('src')  // Name { name: 'src' }
 * ```
 */
class Segment_ extends S.asClass(S.Union([Up, Here, Name])) {
  static Name = Name

  static Up = Up

  static Here = Here

  /** Check whether a value is a valid {@link Segment} step. */
  static is = S.is(this)

  /** Whether a step is a parent traversal (`..`). */
  static isParent = (segment: Segment): boolean => segment._tag === 'Up'

  static encodeSync = S.encodeSync(this)
  static encode = S.encodeEffect(this)
  static decode = S.decodeEffect(this)
  static decodeSync = S.decodeSync(this)
  static decodeExit = S.decodeUnknownExit(this)
}

/**
 * `Segment` — the string ⇄ step codec, with codec statics ({@link Segment_.fromString},
 * `is`, `encode`/`decode`, `isParent`).
 */
export const Segment = Segment_

/**
 * A single path step: a parent traversal ({@link Up}) or a named descent ({@link Name}).
 */
export type Segment = typeof Segment_.Type
