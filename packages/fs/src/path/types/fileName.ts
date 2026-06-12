import { Sch } from '@kitz/sch'
import { Effect, Exit, Match, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { CodecString as Analyzer } from '../../path-analyzer/codec-string/_.js'
import * as Extension from './extension.js'

/**
 * Schema representing a filename (stem + extension).
 * Used within file path members to represent file information.
 */
// Canonical-form generators. The structural fields admit values whose string
// encoding re-decodes differently (stem 'a.b' + null extension encodes to
// 'a.b', which decodes as stem 'a' + extension '.b'). A stem CHECK can't
// forbid dots — real decodes produce dotted stems ('b.tar.gz' → stem
// 'b.tar'). So GENERATION is constrained instead: dot-free stems,
// single-dot extensions. Validation is unchanged.
const stemField = S.String.annotate({
  toArbitrary: () => (fc) => fc.stringMatching(/^[A-Za-z0-9_-]{1,12}$/),
})
const extensionField = Extension.Extension.annotate({
  toArbitrary: () => (fc) => fc.stringMatching(/^\.[A-Za-z0-9]{1,8}$/),
})

export class FileName extends Sch.TaggedClass<FileName>()('FileName', {
  stem: stemField,
  extension: S.NullOr(extensionField),
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
