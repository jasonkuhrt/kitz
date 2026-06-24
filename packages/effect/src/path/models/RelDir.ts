import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze, backSegment, herePrefix, separator } from '../path-analyzer/codec-string/__.js'
import { Segments } from './Segments.js'

/**
 * Relative directory value — the decoded path (a step array) with instance behavior.
 * Internal; the public binding is {@link RelDir}.
 */
class RelDirValue extends S.TaggedClass<RelDirValue>()('RelDir', {
  segments: Segments,
}) {
  /** Encode back to the canonical string form (e.g. `./src/`). */
  override toString(): string {
    return S.encodeSync(RelDir)(this)
  }

  /** Count of leading parent-traversal (`..`) steps, derived from {@link segments}. */
  get back(): number {
    let count = 0
    for (const segment of this.segments) {
      if (segment._tag === 'Up') count++
      else break
    }
    return count
  }

  /** The directory name (last segment), or empty string for current/parent-only paths. */
  get name(): string {
    const last = this.segments.at(-1)
    return last !== undefined && last._tag === 'Name' ? last.name : ''
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
class RelDir_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(RelDirValue, {
      encode: SchemaGetter.transform((decoded) => {
        // Steps carry their own `..`, so the encoded segment array already includes
        // any parent traversals; only the leading `./` marker is conditional.
        const pathString = S.encodeSync(Segments)(decoded.segments).join(separator)
        if (decoded.segments.length === 0) return herePrefix
        const startsWithBack = decoded.segments[0]?._tag === 'Up'
        return startsWithBack
          ? `${pathString}${separator}`
          : `${herePrefix}${pathString}${separator}`
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
            // Fold the unresolved `..` count into leading Up steps.
            segments: S.decodeSync(Segments)([
              ...Array.from({ length: analysis.back }, () => backSegment),
              ...analysis.path,
            ]),
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

export const RelDir = RelDir_
export type RelDir = typeof RelDir_.Type
