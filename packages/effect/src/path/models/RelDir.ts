import { Array, Effect, flow, Option, Result, Schema as S, SchemaGetter } from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { analyzeDirRel, format } from '../analyzer.js'
import { ancestorSegments } from '../core/ancestors.js'
import { attachNodeInspect } from '../core/inspect.js'
import { renderPath } from '../core/render.js'
import { parentOf } from '../core/segments.js'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { FileName } from './FileName.js'
import { RelFile } from './RelFile.js'
import { Segment } from './segment.js'

/**
 * Relative directory value — the decoded path (ascent count + segments) with instance behavior.
 */
class RelDir__ extends S.TaggedClass<RelDir__>()('RelDir', {
  /** Count of leading parent-traversal (`..`) steps. */
  ascent: NaturalInt.pipe(S.withConstructorDefault(Effect.succeed(0))),
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or `None` for current/parent-only paths. */
  get name(): Option.Option<Segment> {
    return Array.last(this.segments)
  }

  /** Whether this directory is the relative anchor (`./`). */
  get isRoot(): boolean {
    return this.ascent === 0 && this.segments.length === 0
  }

  /** Directory depth, counted by named segments from the relative anchor; ascent is excluded. */
  get depth(): number {
    return this.segments.length
  }

  /** Reinterpret this directory path as a file by using the last segment as the filename, or `None` for segment-less dirs. */
  get asFile(): Option.Option<RelFile> {
    return Option.map(this.name, (fileName) =>
      RelFile.make({
        ascent: this.ascent,
        segments: Array.dropRight(this.segments, 1),
        fileName: FileName.make({ stem: fileName, extension: Option.none() }),
      }),
    )
  }

  /** Ancestor directories, starting at the parent and ending at the same relative anchor; segment-less dirs have none. */
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

  /** The directory re-anchored at the filesystem root, dropping `ascent` traversal (`./src/` → `/src/`). To resolve against a base directory instead, use the flat `ensureAbs`. */
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

/**
 * `RelDir` — a relative directory path, as a `string` ⇄ `RelDir` value codec.
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
) {}

export const RelDir = RelDir_
export type RelDir = typeof RelDir_.Type
