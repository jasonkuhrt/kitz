import { Effect, flow, type Option, Result, Schema as S, SchemaGetter } from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { analyzeFileAbs, format } from '../analyzer.js'
import { ancestorSegments } from '../core/ancestors.js'
import { attachPathEqual } from '../core/equality.js'
import { fileUrlOf } from '../core/fileUrl.js'
import { attachNodeInspect } from '../core/inspect.js'
import { renderPath } from '../core/render.js'
import { parentOf } from '../core/segments.js'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { maxSegments, Segments } from './arbitrary.js'
import { Segment, segment } from './segment.js'
import type { Extension } from './Extension.js'
import { FileName } from './FileName.js'

/**
 * Absolute file value — the decoded path (segments + filename).
 * Absolute paths can't lead with `..`, so there is no `ascent`.
 */
class AbsFile__ extends S.TaggedClass<AbsFile__>()('AbsFile', {
  segments: Segments.pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {
  /** The file's full name — stem plus extension (e.g. `index.ts`). */
  get name(): string {
    return this.fileName.name
  }

  /** The file's name before the final extension. The split uses the last dot after index 0: `archive.tar.gz` has stem `archive.tar`, while `.gitignore` has no extension. */
  get stem(): string {
    return this.fileName.stem
  }

  /** The final extension after the last dot (with leading dot), or `None`; `archive.tar.gz` has extension `.gz`. */
  get extension(): Option.Option<Extension> {
    return this.fileName.extension
  }

  /** Whether this file is directly at the filesystem root. */
  get isRoot(): boolean {
    return this.segments.length === 0
  }

  /** Directory depth, counted by segments before the filename; the filename itself is excluded. */
  get depth(): number {
    return this.segments.length
  }

  /** The file's containing directory (drops the filename). */
  get dir(): AbsDir {
    return AbsDir.make({ segments: this.segments })
  }

  /** Reinterpret this file path as a directory by folding the filename into the segment list. */
  get asDir(): AbsDir {
    return AbsDir.make({ segments: [...this.segments, segment(this.fileName.name)] })
  }

  /** Ancestor directories, starting at this file's containing directory and ending at root. */
  get ancestors(): readonly AbsDir[] {
    return ancestorSegments(this.segments, { includeSelf: true }).map((segments) =>
      AbsDir.make({ segments }),
    )
  }

  /** The path as a `file://` URL. */
  get fileUrl(): URL {
    return fileUrlOf({ segments: this.segments, fileName: this.fileName })
  }

  /** Canonical encoded path string. */
  override toString(): string {
    return renderPath({
      isPathAbsolute: true,
      ascent: 0,
      segments: this.segments,
      fileName: this.fileName.name,
    })
  }

  /** JSON representation is the canonical encoded path string. */
  toJSON(): string {
    return this.toString()
  }

  [PrimaryKey.symbol](): string {
    return this.toString()
  }
}

attachNodeInspect<AbsFile__>(AbsFile__.prototype)
attachPathEqual<AbsFile__>(AbsFile__.prototype)

/**
 * `AbsFile` — an absolute file path, as a `string` ⇄ `AbsFile` value codec.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(AbsFile)('/home/user/file.txt')
 * ```
 */
export class AbsFile_ extends withLiteralStatics(
  withStatics(
    S.asClass(
      S.String.pipe(
        S.annotate({
          identifier: 'AbsFile',
          title: 'Absolute file path',
          description:
            'A POSIX absolute file path — starts with `/`, does not end with `/` (e.g. `/home/user/notes.txt`).',
          examples: ['/home/user/notes.txt', '/etc/hostname'],
        }),
        S.decodeTo(AbsFile__, {
          encode: SchemaGetter.transform((encoded) =>
            format({ isPathAbsolute: true, ascent: 0, fileName: encoded.fileName })(
              encoded.segments,
            ),
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
        S.overrideToFormatter(() => (path) => path.toString()),
      ),
    ),
  ),
) {
  /**
   * Variant schema carrying a realistic generation bias — same set as the
   * canonical schema; generation mixes realistic files 20:1 over the
   * canonical distribution.
   */
  static readonly Realistic = AbsFile_.pipe(
    withArbitraryHints({
      candidate: {
        weight: 20,
        make: (fc) =>
          fc
            .record({
              segments: fc.array(S.toArbitrary(Segment.Realistic), { maxLength: maxSegments }),
              fileName: S.toArbitrary(FileName.Realistic),
            })
            .map((input) => AbsFile_.make(input)),
      },
    }),
  )
}

export const AbsFile = AbsFile_
export type AbsFile = typeof AbsFile_.Type
