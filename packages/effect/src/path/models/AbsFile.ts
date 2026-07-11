import {
  Effect,
  flow,
  Function as Fn,
  type Option,
  Result,
  Schema as S,
  SchemaGetter,
  SchemaParser,
} from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { withStatics } from '../../schema/withStatics.js'
import { type AnalysisFile, analyzeFileAbs, format } from '../analyzer.js'
import { ancestorSegments } from '../core/ancestors.js'
import { attachPathEqual } from '../core/equality.js'
import { fileUrlOf, pathStringFromFileUrl } from '../core/fileUrl.js'
import { attachNodeInspect } from '../core/inspect.js'
import { renderPath } from '../core/render.js'
import { resolveFileName } from '../core/setParts.js'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withLiteralStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import type { Extension } from './Extension.js'
import { FileName } from './FileName.js'
import { Segment, segment } from './segment.js'

export declare namespace AbsFile {
  export type Parts =
    | {
        /** Replace the containing absolute directory. */
        readonly dir?: AbsDir
        /** Replace the whole filename. */
        readonly name?: FileName
        readonly stem?: never
        readonly extension?: never
      }
    | {
        /** Replace the containing absolute directory. */
        readonly dir?: AbsDir
        readonly name?: never
        /** Replace the filename stem, preserving or composing with `extension`. */
        readonly stem?: string
        /** Replace the final extension; `None` removes it. */
        readonly extension?: Extension | Option.Option<Extension>
      }
}

/**
 * Absolute file value — the decoded path (directory + filename).
 * Absolute paths can't lead with `..`, so there is no `ascent`.
 */
class AbsFile__ extends S.TaggedClass<AbsFile__>()('AbsFile', {
  /**
   * Containing absolute directory. Constructor default is the absolute anchor
   * for literal/schema construction; application code building non-root files
   * should pass `dir` explicitly or prefer `join(dir, relFile)`.
   */
  dir: S.suspend((): S.toType<typeof AbsDir> => S.toType(AbsDir)).pipe(
    S.withConstructorDefault(Effect.sync(() => AbsDir.anchor)),
  ),
  fileName: FileName,
}) {
  /** The file's full name — stem plus extension (e.g. `index.ts`); node:path's `basename`. */
  get name(): string {
    return this.fileName.name
  }

  /** The file's name before the final extension; node:path's `parse().name` corresponds to this. The split uses the last dot after index 0: `archive.tar.gz` has stem `archive.tar`, while `.gitignore` has no extension. */
  get stem(): string {
    return this.fileName.stem
  }

  /** The final extension after the last dot (with leading dot), or `None`; `archive.tar.gz` has extension `.gz`. */
  get extension(): Option.Option<Extension> {
    return this.fileName.extension
  }

  /** Directory segments delegated from the containing dir. */
  get segments(): ReadonlyArray<Segment> {
    return this.dir.segments
  }

  /** Directory depth, counted by segments from the absolute anchor before the filename; the filename itself is excluded. */
  get depth(): number {
    return this.dir.depth
  }

  /** Reinterpret this file path as a directory by folding the filename into the segment list. */
  get asDir(): AbsDir {
    return AbsDir.make({ segments: [...this.segments, segment(this.fileName.name)] })
  }

  /** Ancestor directories, starting at this file's containing directory and ending at the root, the absolute anchor; unlike Rust's `Path::ancestors`, this does not include the file itself. */
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

const decodeAnalysis = (analysis: AnalysisFile) =>
  SchemaParser.decodeEffect(AbsDir.FromStruct)({ segments: analysis.segments }).pipe(
    Effect.map((dir) => ({
      _tag: 'AbsFile' as const,
      dir,
      fileName: analysis.fileName,
    })),
  )

/**
 * `AbsFile` — an absolute file path, as a `string` ⇄ `AbsFile` value codec.
 * Path values are lexical: `..` folds at decode (`a/../b` decodes as `b`), so equality is normal-form identity, not filesystem-target identity — symlinks can make lexically distinct paths reach the same file. Symlink-aware resolution belongs to filesystem APIs.
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
            'A POSIX absolute file path — starts with `/`, does not end with `/` (e.g. `/home/user/notes.txt`); ascending above the root clamps (`/a/../../b` decodes as `/b`).',
          examples: ['/home/user/notes.txt', '/etc/hostname'],
        }),
        S.decodeTo(AbsFile__, {
          encode: SchemaGetter.transform((encoded) =>
            format({ isPathAbsolute: true, ascent: 0, fileName: encoded.fileName })(
              encoded.dir.segments,
            ),
          ),
          decode: SchemaGetter.transformOrFail(
            flow(analyzeFileAbs, Effect.fromResult, Effect.flatMap(decodeAnalysis)),
          ),
        }),
        S.overrideToFormatter(() => (path) => path.toString()),
      ),
    ),
  ),
) {
  /**
   * Rebuild an absolute file with patched file components.
   *
   * @example
   * ```ts
   * AbsFile.setParts(file, { stem: 'README' })
   * pipe(file, AbsFile.setParts({ extension: Option.none() }))
   * ```
   */
  static readonly setParts: {
    (file: typeof AbsFile_.Type, parts: AbsFile.Parts): typeof AbsFile_.Type
    (parts: AbsFile.Parts): (file: typeof AbsFile_.Type) => typeof AbsFile_.Type
  } = Fn.dual(2, (file: typeof AbsFile_.Type, parts: AbsFile.Parts): typeof AbsFile_.Type =>
    AbsFile_.make({
      dir: parts.dir ?? file.dir,
      fileName: resolveFileName(file.fileName, parts),
    }),
  )

  /**
   * Decode/encode absolute files as native `file:` URL instances.
   *
   * @example
   * ```ts
   * S.decodeSync(AbsFile.FromUrl)(new URL(import.meta.url))
   * ```
   */
  static readonly FromUrl = S.URL.pipe(
    S.decodeTo(AbsFile__, {
      encode: SchemaGetter.transform((encoded) =>
        fileUrlOf({ segments: encoded.dir.segments, fileName: encoded.fileName }),
      ),
      decode: SchemaGetter.transformOrFail(
        flow(
          pathStringFromFileUrl,
          Result.flatMap(analyzeFileAbs),
          Effect.fromResult,
          Effect.flatMap(decodeAnalysis),
        ),
      ),
    }),
  )

  /**
   * Decode/encode paths as flat structured JSON instead of strings.
   *
   * @example
   * ```ts
   * const Payload = S.Struct({ entry: AbsFile.FromStruct })
   * ```
   */
  static readonly FromStruct = S.Struct({
    segments: S.Array(Segment),
    fileName: FileName,
  }).pipe(
    S.decodeTo(AbsFile__, {
      encode: SchemaGetter.transform((encoded) => ({
        segments: encoded.dir.segments,
        fileName: S.decodeSync(FileName)(encoded.fileName),
      })),
      decode: SchemaGetter.transform((decoded) => ({
        _tag: 'AbsFile' as const,
        dir: AbsDir.make({ segments: decoded.segments }),
        fileName: S.encodeSync(FileName)(decoded.fileName),
      })),
    }),
  )

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
              dir: S.toArbitrary(AbsDir.Realistic),
              fileName: S.toArbitrary(FileName.Realistic),
            })
            .map((input) => AbsFile_.make(input)),
      },
    }),
  )
}

export const AbsFile = AbsFile_
export type AbsFile = typeof AbsFile_.Type
