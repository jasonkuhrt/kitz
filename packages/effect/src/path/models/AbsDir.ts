import { Array, Effect, flow, Option, Result, Schema as S, SchemaGetter } from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { analyzeDirAbs, format } from '../analyzer.js'
import { ancestorSegments } from '../core/ancestors.js'
import { attachPathEqual } from '../core/equality.js'
import { fileUrlOf } from '../core/fileUrl.js'
import { attachNodeInspect } from '../core/inspect.js'
import { renderPath } from '../core/render.js'
import { parentOf } from '../core/segments.js'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { maxSegments, Segments } from './arbitrary.js'
import { AbsFile } from './AbsFile.js'
import { FileName } from './FileName.js'
import { Segment } from './segment.js'

/**
 * Absolute directory value — the decoded path (segments) with instance behavior.
 * Absolute paths can't lead with `..`, so there is no `ascent`.
 */
class AbsDir__ extends S.TaggedClass<AbsDir__>()('AbsDir', {
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
            'A POSIX absolute directory path — starts with `/`; canonical form ends with `/` (e.g. `/home/user/`).',
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
