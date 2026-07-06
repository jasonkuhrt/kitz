import { Effect, flow, type Option, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeFileAbs, format } from '../analyzer.js'
import { fileUrlOf } from '../core/fileUrl.js'
import { parentOf } from '../core/segments.js'
import { withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import type { Extension } from './Extension.js'
import { FileName } from './FileName.js'
import { Segment } from './segment.js'

/**
 * Absolute file value — the decoded path (segments + filename).
 * Absolute paths can't lead with `..`, so there is no `back`.
 */
class AbsFile__ extends S.TaggedClass<AbsFile__>()('AbsFile', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {
  /** The file's full name — stem plus extension (e.g. `index.ts`). */
  get name(): string {
    return this.fileName.name
  }

  /** The file's name without its extension. Split on the last dot, so `archive.tar.gz` has stem `archive.tar`. */
  get stem(): string {
    return this.fileName.stem
  }

  /** The file's extension (with leading dot), or `None` for an extension-less file. */
  get extension(): Option.Option<Extension> {
    return this.fileName.extension
  }

  /** The file's containing directory (drops the filename). */
  get dir(): AbsDir {
    return AbsDir.make({ segments: this.segments })
  }

  /** The file relocated one directory level up — keeps the filename, drops the last directory segment (root stays at root). */
  get parent(): AbsFile {
    return AbsFile_.make({
      segments: parentOf(0, this.segments).segments,
      fileName: this.fileName,
    })
  }

  /** The path as a `file://` URL. */
  get fileUrl(): URL {
    return fileUrlOf({ segments: this.segments, fileName: this.fileName })
  }
}

/**
 * `AbsFile` — an absolute file path, as a `string` ⇄ `AbsFile` value codec.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(AbsFile)('/home/user/file.txt')
 * ```
 */
export class AbsFile_ extends withStatics(
  S.asClass(
    S.String.pipe(
      S.decodeTo(AbsFile__, {
        encode: SchemaGetter.transform((encoded) =>
          format({ isPathAbsolute: true, back: 0, fileName: encoded.fileName })(encoded.segments),
        ),
        decode: SchemaGetter.transformOrFail(
          flow(
            analyzeFileAbs,
            Result.map((analysis) => ({
              _tag: 'AbsFile' as const,
              segments: analysis.segments,
              fileName: analysis.fileName,
            })),
            Effect.fromResult,
          ),
        ),
      }),
    ),
  ),
) {}

export const AbsFile = AbsFile_
export type AbsFile = typeof AbsFile_.Type
