import { Effect, flow, Option, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeFileName } from '../analyzer.js'
import * as Extension from './Extension.js'

const nullByte = String.fromCharCode(0)
const fileNameText = new RegExp(
  `^[^/${nullByte}.][^/${nullByte}]{0,31}` +
    `(\\.[^/${nullByte}.][^/${nullByte}]{0,15})?$` +
    `|^\\.[^/${nullByte}.][^/${nullByte}]{0,31}$`,
)

const canGenerateFileName = (name: string): boolean => {
  const result = analyzeFileName(name)
  return (
    Result.isSuccess(result) &&
    (result.success.extension === null || S.is(Extension.Extension)(result.success.extension))
  )
}

const unsafeAnalyzeGeneratedFileName = (
  name: string,
): { stem: string; extension: string | null } => {
  const result = analyzeFileName(name)
  if (Result.isFailure(result)) throw new Error('generated invalid filename')
  return result.success
}

const fileNameArbitrary = {
  toArbitrary: () => (fc: typeof import('effect/testing').FastCheck) =>
    fc
      .stringMatching(fileNameText)
      .filter(canGenerateFileName)
      .map(unsafeAnalyzeGeneratedFileName)
      .map((file) =>
        FileName__.make({
          stem: file.stem,
          extension: Option.fromNullOr(file.extension),
        }),
      ),
} satisfies S.Annotations.Bottom<FileName__, readonly []>

/** Filename value — a stem plus optional final extension, split on the last dot after index 0. */
class FileName__ extends S.TaggedClass<FileName__>()('FileName', {
  stem: S.String,
  extension: S.OptionFromNullOr(Extension.Extension),
}) {
  /** The rendered `stem(.ext)?` string form. */
  get name(): string {
    return Option.match(this.extension, {
      onNone: () => this.stem,
      onSome: (extension) => `${this.stem}${extension}`,
    })
  }
}

/**
 * `FileName` — a bare filename as a `string` ⇄ `{ stem, extension }` codec.
 *
 * @example
 * ```ts
 * const name = FileName.make({ stem: 'index', extension: Option.some('.ts') })
 * ```
 */
export class FileName_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(FileName__, {
      encode: SchemaGetter.transform((encoded) =>
        encoded.extension === null ? encoded.stem : `${encoded.stem}${encoded.extension}`,
      ),
      decode: SchemaGetter.transformOrFail(
        flow(
          analyzeFileName,
          Result.map((file) => ({
            _tag: 'FileName' as const,
            stem: file.stem,
            extension: file.extension,
          })),
          Effect.fromResult,
        ),
      ),
    }),
    S.annotate(fileNameArbitrary),
  ),
) {
  /**
   * Construct a canonical `FileName`. The stem and extension are re-joined and
   * re-split on the last dot — the same rule the string codec applies — so a
   * non-canonical input like `{ stem: 'a.txt', extension: none }` normalizes to
   * `{ stem: 'a', extension: '.txt' }`. This keeps a filename's representation
   * unique, so structurally-equal values are always the same filename.
   */
  static override make(input: {
    readonly stem: string
    readonly extension: Option.Option<Extension.Extension>
  }): FileName__ {
    const full = `${input.stem}${Option.getOrElse(input.extension, () => '')}`
    const dot = full.lastIndexOf('.')
    return super.make(
      dot > 0
        ? {
            stem: full.slice(0, dot),
            extension: Option.some(S.decodeSync(Extension.Extension)(full.slice(dot))),
          }
        : { stem: full, extension: Option.none() },
    )
  }
}

export const FileName = FileName_
export type FileName = typeof FileName_.Type
