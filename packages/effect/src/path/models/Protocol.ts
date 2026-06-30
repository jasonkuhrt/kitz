import { Schema as S, SchemaGetter } from 'effect'

/** Separator between a protocol name and the rest of a URL (`file` + `://`). */
const separator = '://'

/**
 * The known URL protocols, by decoded name. Extend with
 * `S.Union([S.Literal('file'), S.Literal('http'), ...])`.
 */
const ProtocolName = S.Literal('file')
type ProtocolName = typeof ProtocolName.Type

/**
 * A URL protocol (scheme) as a `string` ⇄ name codec. The decoded value is the
 * bare protocol name (`file`); the encoded value is the scheme prefix as written
 * in a URL (`file://`). Decoding a scheme outside the enum fails validation.
 *
 * @example
 * ```ts
 * S.decodeSync(Protocol)('file://') // 'file'
 * S.encodeSync(Protocol)('file')    // 'file://'
 * ```
 */
export const Protocol = S.String.pipe(
  S.decodeTo(ProtocolName, {
    // Strip the separator, then `ProtocolName` validates the name is in the enum.
    decode: SchemaGetter.transform((scheme) => scheme.slice(0, -separator.length) as ProtocolName),
    encode: SchemaGetter.transform((name) => `${name}${separator}`),
  }),
)

export type Protocol = typeof Protocol.Type
