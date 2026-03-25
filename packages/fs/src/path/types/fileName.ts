import { Effect, Exit, Match, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { CodecString as Analyzer } from '../../path-analyzer/codec-string/_.js'
import * as Extension from './extension.js'

/**
 * Schema representing a filename (stem + extension).
 * Used within file path members to represent file information.
 */
export class FileName extends S.TaggedClass<FileName>()('FileName', {
  stem: S.String,
  extension: S.NullOr(Extension.Extension),
}) {
  static make = this.makeUnsafe
  static is = S.is(FileName)

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
        return Match.value(Analyzer.analyze(input, { hint: 'file' })).pipe(
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
                return Effect.succeed(
                  FileName.make({
                    stem: file.file.stem,
                    extension: extResult.value,
                  }),
                )
              } else {
                return Effect.succeed(
                  FileName.make({
                    stem: file.file.stem,
                    extension: null,
                  }),
                )
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
