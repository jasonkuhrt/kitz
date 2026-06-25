import { Effect, Exit, Match, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze } from '../analyzer.js'
import * as Extension from './Extension.js'

/**
 * Schema representing a filename (stem + extension).
 * Used within file path members to represent file information.
 */
export class FileName extends S.TaggedClass<FileName>()('FileName', {
  stem: S.String,
  extension: S.OptionFromNullOr(Extension.Extension),
}) {
  /**
   * Schema for transforming between string and FileName class.
   */
  static String = S.String.pipe(
    S.decodeTo(FileName, {
      encode: SchemaGetter.transform((decoded) => {
        const filename = decoded.extension ? `${decoded.stem}${decoded.extension}` : decoded.stem
        return filename
      }),
      decode: SchemaGetter.transformOrFail((input) => {
        return Match.value(analyze(input, { hint: 'file' })).pipe(
          Match.tagsExhaustive({
            file: (file) => {
              // File should be just a filename, not a path
              if (file.path.length > 0 || file.path.some((s) => s === '..')) {
                return Effect.fail(
                  new SchemaIssue.InvalidValue(Option.some(input), {
                    message: `File should be a filename only, not a path`,
                  }),
                )
              }

              // The analysis already extracts the extension but we need to validate it
              if (file.file.extension) {
                const extResult = S.decodeUnknownExit(Extension.Extension)(file.file.extension)
                if (Exit.isFailure(extResult)) {
                  return Effect.fail(
                    new SchemaIssue.InvalidValue(Option.some(input), {
                      message: `Invalid file extension: ${file.file.extension}`,
                    }),
                  )
                }
                return Effect.succeed({
                  _tag: 'FileName' as const,
                  stem: file.file.stem,
                  extension: extResult.value,
                })
              } else {
                return Effect.succeed({
                  _tag: 'FileName' as const,
                  stem: file.file.stem,
                  extension: null,
                })
              }
            },
            dir: () =>
              Effect.fail(
                new SchemaIssue.InvalidValue(Option.some(input), {
                  message: `File cannot be a directory`,
                }),
              ),
          }),
        )
      }),
    }),
  )
}
