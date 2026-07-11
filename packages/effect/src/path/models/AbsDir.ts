import { Array, Effect, flow, Option, Result, Schema as S, SchemaGetter } from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { withStatics } from '../../schema/withStatics.js'
import { analyzeDirAbs, format } from '../analyzer.js'
import { ancestorSegments } from '../core/ancestors.js'
import { attachPathEqual } from '../core/equality.js'
import { fileUrlOf, pathStringFromFileUrl } from '../core/fileUrl.js'
import { attachNodeInspect } from '../core/inspect.js'
import { renderPath } from '../core/render.js'
import { parentOf } from '../core/segments.js'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withLiteralStatics } from '../core/statics.js'
import { maxSegments, Segments } from './arbitrary.js'
import { AbsFile } from './AbsFile.js'
import { FileName } from './FileName.js'
import { Segment, segment } from './segment.js'

/**
 * Absolute directory value — the decoded path (segments) with instance behavior.
 * Absolute paths can't lead with `..`, so there is no `ascent`.
 */
class AbsDir__ extends S.TaggedClass<AbsDir__>('@kitz/effect/Path/AbsDir')('AbsDir', {
  segments: Segments.pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or `None` for root. */
  get name(): Option.Option<Segment> {
    return Array.last(this.segments)
  }

  /** Whether this dir is the absolute anchor — the filesystem root `/`. */
  get isAnchor(): boolean {
    return this.segments.length === 0
  }

  /** Directory depth, counted by segments from the absolute anchor. */
  get depth(): number {
    return this.segments.length
  }

  /** Reinterpret this directory path as a file by using the last segment as the filename, or `None` for root. */
  get asFile(): Option.Option<AbsFile> {
    return Option.map(this.name, (fileName) =>
      AbsFile.make({
        dir: AbsDir_.make({ segments: Array.dropRight(this.segments, 1) }),
        fileName: FileName.make({ stem: fileName, extension: Option.none() }),
      }),
    )
  }

  /** Ancestor directories, excluding this directory, starting at the parent and ending at the root, the absolute anchor; unlike Rust's `Path::ancestors`, this does not include self. */
  get ancestors(): readonly AbsDir[] {
    return ancestorSegments(this.segments, { includeSelf: false }).map((segments) =>
      AbsDir_.make({ segments }),
    )
  }

  /** The parent directory — drops the last segment (root stays at root). */
  get parent(): AbsDir {
    return AbsDir_.make({ segments: parentOf(0, this.segments).segments })
  }

  /** The path as a `file://` URL. */
  get fileUrl(): URL {
    return fileUrlOf({ segments: this.segments })
  }

  /** Canonical encoded path string. */
  override toString(): string {
    return renderPath({ isPathAbsolute: true, ascent: 0, segments: this.segments })
  }

  /** JSON representation is the canonical encoded path string. */
  toJSON(): string {
    return this.toString()
  }

  [PrimaryKey.symbol](): string {
    return this.toString()
  }
}

attachNodeInspect<AbsDir__>(AbsDir__.prototype)
attachPathEqual<AbsDir__>(AbsDir__.prototype)

/**
 * `AbsDir` — an absolute directory path, as a `string` ⇄ `AbsDir` value codec.
 * Path values are lexical: `..` folds at decode (`a/../b` decodes as `b`), so equality is normal-form identity, not filesystem-target identity — symlinks can make lexically distinct paths reach the same file. Symlink-aware resolution belongs to filesystem APIs.
 *
 * @example
 * ```ts
 * const dir = S.decodeSync(AbsDir)('/home/user/')
 * ```
 */
export class AbsDir_ extends withLiteralStatics(
  withStatics(
    S.asClass(
      S.String.pipe(
        S.annotate({
          identifier: 'AbsDir',
          title: 'Absolute directory path',
          description:
            'A POSIX absolute directory path — starts with `/`; canonical form ends with `/` (e.g. `/home/user/`); ascending above the root clamps (`/a/../../b` decodes as `/b`).',
          examples: ['/home/user/', '/'],
        }),
        S.decodeTo(AbsDir__, {
          encode: SchemaGetter.transform((encoded) =>
            format({ isPathAbsolute: true, ascent: 0 })(encoded.segments),
          ),
          decode: SchemaGetter.transformOrFail(
            flow(
              analyzeDirAbs,
              Result.map((analysis) => ({ _tag: 'AbsDir' as const, segments: analysis.segments })),
              Effect.fromResult,
            ),
          ),
        }),
        S.overrideToFormatter(() => (path) => path.toString()),
      ),
    ),
  ),
) {
  /** The absolute anchor — the filesystem root `/`. */
  static readonly anchor: typeof AbsDir_.Type = AbsDir_.make({ segments: [] })

  /**
   * Decode/encode absolute dirs as native `file:` URL instances.
   *
   * @example
   * ```ts
   * S.decodeSync(AbsDir.FromUrl)(new URL('.', import.meta.url))
   * ```
   */
  static readonly FromUrl = S.URL.pipe(
    S.decodeTo(AbsDir__, {
      encode: SchemaGetter.transform((encoded) => fileUrlOf({ segments: encoded.segments })),
      decode: SchemaGetter.transformOrFail(
        flow(
          pathStringFromFileUrl,
          Result.flatMap(analyzeDirAbs),
          Result.map((analysis) => ({ _tag: 'AbsDir' as const, segments: analysis.segments })),
          Effect.fromResult,
        ),
      ),
    }),
  )

  /**
   * Decode/encode paths as flat structured JSON instead of strings.
   *
   * @example
   * ```ts
   * const Payload = S.Struct({ cwd: AbsDir.FromStruct })
   * ```
   */
  static readonly FromStruct = S.Struct({
    segments: S.Array(Segment),
  }).pipe(
    S.decodeTo(AbsDir__, {
      encode: SchemaGetter.transform((encoded) => ({ segments: encoded.segments.map(segment) })),
      decode: SchemaGetter.transform((decoded) => ({
        _tag: 'AbsDir' as const,
        segments: decoded.segments,
      })),
    }),
  )

  /**
   * Variant schema carrying a realistic generation bias — same set as the
   * canonical schema; generation mixes realistic directories 20:1 over the
   * canonical distribution.
   */
  static readonly Realistic = AbsDir_.pipe(
    withArbitraryHints({
      candidate: {
        weight: 20,
        make: (fc) =>
          fc
            .array(S.toArbitrary(Segment.Realistic), { maxLength: maxSegments })
            .map((segments) => AbsDir_.make({ segments })),
      },
    }),
  )
}

export const AbsDir = AbsDir_
export type AbsDir = typeof AbsDir_.Type
