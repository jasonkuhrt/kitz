import { Effect, flow, Option, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeFileName } from '../analyzer.js'
import * as Extension from './Extension.js'

/** Filename value — a stem plus optional extension (e.g. `file.txt`). */
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
            extension: Option.some(full.slice(dot) as Extension.Extension),
          }
        : { stem: full, extension: Option.none() },
    )
  }
}

export const FileName = FileName_
export type FileName = typeof FileName_.Type
