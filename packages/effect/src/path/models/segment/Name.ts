import { Schema as S, SchemaGetter } from 'effect'

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
export const Name = NameEncodedString.pipe(
  S.decodeTo(NameDecoded, {
    decode: SchemaGetter.transform((name) => NameDecoded.make({ name })),
    encode: SchemaGetter.transform((step) => step.name),
  }),
)

export type Name = typeof Name.Type
