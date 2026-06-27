import { Effect, flow, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeFileName } from '../analyzer.js'
import * as Extension from './Extension.js'

/** Filename value — a stem plus optional extension (e.g. `file.txt`). */
class FileName__ extends S.TaggedClass<FileName__>()('FileName', {
  stem: S.String,
  extension: S.OptionFromNullOr(Extension.Extension),
}) {}

class FileName_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(FileName__, {
      encode: SchemaGetter.transform((encoded) =>
        encoded.extension ? `${encoded.stem}${encoded.extension}` : encoded.stem,
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
) {}

export const FileName = FileName_
export type FileName = typeof FileName_.Type
