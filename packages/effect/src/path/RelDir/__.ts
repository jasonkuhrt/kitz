import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { analyze, backPrefix, herePrefix, separator } from '../../path-analyzer/codec-string/__.js'
import { Segments } from '../types/segments.js'

/**
 * Back field with default 0.
 * Represents the count of unresolved parent directory traversals (..).
 * Required in the Type, optional in the constructor (defaults to 0).
 */
const Back = S.Int.pipe(
  S.check(S.isGreaterThanOrEqualTo(0)),
  S.withConstructorDefault(Effect.succeed(0)),
)

/**
 * Relative directory value — the decoded path (back + segments) with instance behavior.
 * Internal; the public binding is {@link RelDir}.
 */
class RelDirValue extends S.TaggedClass<RelDirValue>()('FsPathRelDir', {
  back: Back,
  segments: Segments,
}) {
  /** Encode back to the canonical string form (e.g. `./src/`). */
  override toString(): string {
    return S.encodeSync(RelDir)(this)
  }

  /** The directory name (last segment), or empty string for current/parent-only paths. */
  get name(): string {
    return this.segments.at(-1) ?? ''
  }
}

/**
 * `RelDir` — a relative directory path.
 *
 * The binding **is** the string codec (`string` ⇄ `RelDir`), usable directly as a
 * schema — `S.Struct({ p: RelDir })`, `S.Union([RelDir, …])` — with no `.Schema` hop.
 *
 * @example
 * ```ts
 * const dir = RelDir.fromString('./src/')
 * const ConfigSchema = S.Struct({ sourcePath: RelDir, outputPath: RelDir })
 * ```
 */
class RelDirCodec extends S.asClass(
  S.String.pipe(
    S.decodeTo(RelDirValue, {
      encode: SchemaGetter.transform((decoded) => {
        // Build the path string from back count and segments
        const backPrefixStr = backPrefix.repeat(decoded.back)
        const pathString = decoded.segments.join(separator)

        // Determine the prefix: use back traversal or current directory marker
        if (decoded.back > 0) {
          return pathString.length > 0 ? `${backPrefixStr}${pathString}${separator}` : backPrefixStr
        }
        return pathString.length > 0 ? `${herePrefix}${pathString}${separator}` : herePrefix
      }),
      decode: SchemaGetter.transformOrFail((input) => {
        // Analyze the input string with directory hint for ambiguous paths
        const analysis = analyze(input, { hint: 'directory' })

        if (analysis._tag !== 'dir') {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(input), {
              message: 'Expected a directory path, got a file path',
            }),
          )
        }
        if (analysis.isPathAbsolute) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(input), {
              message: 'Relative paths must not start with /',
            }),
          )
        }

        return Effect.succeed(
          RelDirValue.make({
            back: analysis.back,
            segments: analysis.path,
          }),
        )
      }),
    }),
  ),
) {
  /** Type guard for {@link RelDir} instances. */
  static is = S.is(this)

  /** Decode a relative directory path from a string. Throws on invalid input. */
  static fromString = <const input extends string>(input: input): RelDir =>
    S.decodeSync(this)(input)
}

export const RelDir = RelDirCodec
export type RelDir = S.Schema.Type<typeof RelDirCodec>
