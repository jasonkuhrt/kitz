import { Effect, flow, type Option, Result, Schema as S, SchemaGetter } from 'effect'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { analyzeFileRel, format } from '../analyzer.js'
import { parentOf } from '../core/segments.js'
import { withStatics } from '../core/statics.js'
import { AbsFile } from './AbsFile.js'
import type { Extension } from './Extension.js'
import { FileName } from './FileName.js'
import { RelDir } from './RelDir.js'
import { Segment } from './segment.js'

/**
 * Relative file value — the decoded path (back count + segments + filename).
 */
class RelFile__ extends S.TaggedClass<RelFile__>()('RelFile', {
  /** Count of leading parent-traversal (`..`) steps. */
  back: NaturalInt.pipe(S.withConstructorDefault(Effect.succeed(0))),
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
  get dir(): RelDir {
    return RelDir.make({ back: this.back, segments: this.segments })
  }

  /** The file relocated one directory level up — keeps the filename, drops the last directory segment (grows `back` when segment-less). */
  get parent(): RelFile {
    const parent = parentOf(this.back, this.segments)
    return RelFile_.make({
      back: parent.back,
      segments: parent.segments,
      fileName: this.fileName,
    })
  }

  /** The file re-anchored at the filesystem root, dropping `back` traversal (`./src/a.ts` → `/src/a.ts`). To resolve against a base directory instead, use the flat `ensureAbs`. */
  get atRoot(): AbsFile {
    return AbsFile.make({ segments: this.segments, fileName: this.fileName })
  }
}

/**
 * `RelFile` — a relative file path, as a `string` ⇄ `RelFile` value codec.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(RelFile)('./src/index.ts')
 * ```
 */
export class RelFile_ extends withStatics(
  S.asClass(
    S.String.pipe(
      S.decodeTo(RelFile__, {
        encode: SchemaGetter.transform((encoded) =>
          format({ isPathAbsolute: false, back: encoded.back, fileName: encoded.fileName })(
            encoded.segments,
          ),
        ),
        decode: SchemaGetter.transformOrFail(
          flow(
            analyzeFileRel,
            Result.map((analysis) => ({
              _tag: 'RelFile' as const,
              back: analysis.back,
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

export const RelFile = RelFile_
export type RelFile = typeof RelFile_.Type
