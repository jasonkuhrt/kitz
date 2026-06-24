import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { stringSeparator } from '../constants.js'
import { analyze } from '../path-analyzer/codec-string/__.js'
import { Segments } from './Segments.js'

/**
 * Absolute directory value — the decoded path (segments) with instance behavior.
 * Internal; the public binding is {@link AbsDir}.
 */
class AbsDirValue extends S.TaggedClass<AbsDirValue>()('FsPathAbsDir', {
  segments: Segments,
}) {
  /** Encode back to the canonical string form (e.g. `/home/user/`). */
  override toString(): string {
    return S.encodeSync(AbsDir)(this)
  }

  /** The directory name (last segment), or empty string for root. */
  get name(): string {
    const last = this.segments.at(-1)
    return last !== undefined && last._tag === 'Name' ? last.name : ''
  }
}

/**
 * `AbsDir` — an absolute directory path.
 *
 * The binding **is** the string codec (`string` ⇄ `AbsDir`), usable directly as a
 * schema — `S.Struct({ p: AbsDir })`, `S.Union([AbsDir, …])` — with no `.Schema` hop.
 *
 * @example
 * ```ts
 * const dir = AbsDir.fromString('/home/user/')
 * const ConfigSchema = S.Struct({ sourcePath: AbsDir, outputPath: AbsDir })
 * ```
 */
class AbsDir_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(AbsDirValue, {
      encode: SchemaGetter.transform((decoded) => {
        const pathString = S.encodeSync(Segments)(decoded.segments).join(stringSeparator)
        return decoded.segments.length === 0 ? '/' : `/${pathString}/`
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
        if (!analysis.isPathAbsolute) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(input), {
              message: 'Absolute paths must start with /',
            }),
          )
        }

        return Effect.succeed(AbsDirValue.make({ segments: S.decodeSync(Segments)(analysis.path) }))
      }),
    }),
  ),
) {
  /** Type guard for {@link AbsDir} instances. */
  static is = S.is(this)

  /** Decode an absolute directory path from a string. Throws on invalid input. */
  static fromString = <const input extends string>(input: input): AbsDir =>
    S.decodeSync(this)(input)
}

export const AbsDir = AbsDir_
export type AbsDir = typeof AbsDir_.Type
