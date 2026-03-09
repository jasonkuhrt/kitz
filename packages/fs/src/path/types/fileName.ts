import { Match, ParseResult, Schema as S } from 'effect'
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
  static is = S.is(FileName)

  /**
   * Schema for transforming between string and FileName class.
   */
  static String = S.transformOrFail(S.String, FileName, {
    strict: true,
    encode: (decoded) => {
      const filename = decoded.extension ? `${decoded.stem}${decoded.extension}` : decoded.stem
      return ParseResult.succeed(filename)
    },
    decode: (input, options, ast) => {
      return Match.value(Analyzer.analyze(input)).pipe(
        Match.tagsExhaustive({
          file: (file) => {
            // File should be just a filename, not a path
            if (file.path.length > 0 || file.path.some((s) => s === '..')) {
              return ParseResult.fail(
                new ParseResult.Type(ast, input, `File should be a filename only, not a path`),
              )
            }

            // The analysis already extracts the extension but we need to validate it
            if (file.file.extension) {
              const extResult = S.decodeEither(Extension.Extension)(file.file.extension)
              if (extResult._tag === 'Left') {
                return ParseResult.fail(
                  new ParseResult.Type(
                    ast,
                    input,
                    `Invalid file extension: ${file.file.extension}`,
                  ),
                )
              }
              return ParseResult.succeed(
                FileName.make({
                  stem: file.file.stem,
                  extension: extResult.right,
                }),
              )
            } else {
              return ParseResult.succeed(
                FileName.make({
                  stem: file.file.stem,
                  extension: null,
                }),
              )
            }
          },
          dir: () =>
            ParseResult.fail(new ParseResult.Type(ast, input, `File cannot be a directory`)),
        }),
      )
    },
  })
}
