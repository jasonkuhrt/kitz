import { Array, Effect, flow, Option, Result, Schema as S, SchemaGetter } from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { analyzeDirRel, format } from '../analyzer.js'
import { ancestorSegments } from '../core/ancestors.js'
import { attachPathEqual } from '../core/equality.js'
import { attachNodeInspect } from '../core/inspect.js'
import { renderPath } from '../core/render.js'
import { parentOf } from '../core/segments.js'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { Ascent, maxSegments, Segments } from './arbitrary.js'
import { FileName } from './FileName.js'
import { RelFile } from './RelFile.js'
import { Segment, segment } from './segment.js'

/**
 * Relative directory value — the decoded path (ascent count + segments) with instance behavior.
 */
class RelDir__ extends S.TaggedClass<RelDir__>()('RelDir', {
  /** Count of leading parent-traversal (`..`) steps. */
  ascent: Ascent.pipe(S.withConstructorDefault(Effect.succeed(0))),
  segments: Segments.pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or `None` for current/parent-only paths. */
  get name(): Option.Option<Segment> {
    return Array.last(this.segments)
  }

  /** Whether this dir is the relative anchor `./`. Pure-ascent paths (`../../`) are above the anchor, not at it. */
  get isAnchor(): boolean {
    return this.ascent === 0 && this.segments.length === 0
  }

  /** Directory depth, counted by named segments from the anchor; ascent is excluded. */
  get depth(): number {
    return this.segments.length
  }

  /** Reinterpret this directory path as a file by using the last segment as the filename, or `None` for segment-less dirs. */
  get asFile(): Option.Option<RelFile> {
    return Option.map(this.name, (fileName) =>
      RelFile.make({
        dir: RelDir_.make({
          ascent: this.ascent,
          segments: Array.dropRight(this.segments, 1),
        }),
        fileName: FileName.make({ stem: fileName, extension: Option.none() }),
      }),
    )
  }

  /** Ancestor directories, excluding this directory, starting at the parent and ending at the anchor; unlike Rust's `Path::ancestors`, this does not include self. */
  get ancestors(): readonly RelDir[] {
    return ancestorSegments(this.segments, { includeSelf: false }).map((segments) =>
      RelDir_.make({ ascent: this.ascent, segments }),
    )
  }

  /** The parent directory — drops the last segment (grows `ascent` when segment-less). */
  get parent(): RelDir {
    const parent = parentOf(this.ascent, this.segments)
    return RelDir_.make({ ascent: parent.ascent, segments: parent.segments })
  }

  /** The directory re-anchors at the absolute anchor (the filesystem root), dropping `ascent` — consistent with the POSIX `/..` clamp. To resolve against a base directory instead, use the flat `ensureAbs`. */
  get atRoot(): AbsDir {
    return AbsDir.make({ segments: this.segments })
  }

  /** Canonical encoded path string. */
  override toString(): string {
    return renderPath({
      isPathAbsolute: false,
      ascent: this.ascent,
      segments: this.segments,
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

attachNodeInspect<RelDir__>(RelDir__.prototype)
attachPathEqual<RelDir__>(RelDir__.prototype)

/**
 * `RelDir` — a relative directory path, as a `string` ⇄ `RelDir` value codec.
 * Path values are lexical: `..` folds at decode (`a/../b` decodes as `b`), so equality is normal-form identity, not filesystem-target identity — symlinks can make lexically distinct paths reach the same file. Symlink-aware resolution belongs to filesystem APIs.
 *
 * @example
 * ```ts
 * const dir = S.decodeSync(RelDir)('./src/')
 * ```
 */
export class RelDir_ extends withLiteralStatics(
  withStatics(
    S.asClass(
      S.String.pipe(
        S.annotate({
          identifier: 'RelDir',
          title: 'Relative directory path',
          description:
            'A POSIX relative directory path — leading `..` steps count as ascent; canonical form starts with `./` or `../` and ends with `/` (e.g. `./src/`).',
          examples: ['./src/', '../'],
        }),
        S.decodeTo(RelDir__, {
          encode: SchemaGetter.transform((encoded) =>
            format({ isPathAbsolute: false, ascent: encoded.ascent })(encoded.segments),
          ),
          decode: SchemaGetter.transformOrFail(
            flow(
              analyzeDirRel,
              Result.map((analysis) => ({
                _tag: 'RelDir' as const,
                ascent: analysis.ascent,
                segments: analysis.segments,
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
  /** The relative anchor `./` — the identity of `join`. */
  static readonly anchor: typeof RelDir_.Type = RelDir_.make({ ascent: 0, segments: [] })

  /**
   * Decode/encode paths as flat structured JSON instead of strings.
   *
   * @example
   * ```ts
   * const Payload = S.Struct({ base: RelDir.FromStruct })
   * ```
   */
  static readonly FromStruct = S.Struct({
    ascent: Ascent,
    segments: S.Array(Segment),
  }).pipe(
    S.decodeTo(RelDir__, {
      encode: SchemaGetter.transform((encoded) => ({
        ascent: encoded.ascent,
        segments: encoded.segments.map(segment),
      })),
      decode: SchemaGetter.transform((decoded) => ({
        _tag: 'RelDir' as const,
        ascent: decoded.ascent,
        segments: decoded.segments,
      })),
    }),
  )

  /**
   * Variant schema carrying a realistic generation bias — same set as the
   * canonical schema; generation mixes realistic directories 20:1 over the
   * canonical distribution.
   */
  static readonly Realistic = RelDir_.pipe(
    withArbitraryHints({
      candidate: {
        weight: 20,
        make: (fc) =>
          fc
            .record({
              ascent: S.toArbitrary(Ascent),
              segments: fc.array(S.toArbitrary(Segment.Realistic), { maxLength: maxSegments }),
            })
            .map((input) => RelDir_.make(input)),
      },
    }),
  )
}

export const RelDir = RelDir_
export type RelDir = typeof RelDir_.Type
