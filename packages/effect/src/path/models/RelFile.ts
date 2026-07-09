import {
  Effect,
  flow,
  Function as Fn,
  type Option,
  Result,
  Schema as S,
  SchemaGetter,
} from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { analyzeFileRel, format } from '../analyzer.js'
import { ancestorSegments } from '../core/ancestors.js'
import { attachPathEqual } from '../core/equality.js'
import { attachNodeInspect } from '../core/inspect.js'
import { renderPath } from '../core/render.js'
import { resolveFileName } from '../core/setParts.js'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { AbsFile } from './AbsFile.js'
import type { Extension } from './Extension.js'
import { FileName } from './FileName.js'
import { RelDir } from './RelDir.js'
import { segment, type Segment } from './segment.js'

export declare namespace RelFile {
  export type Parts =
    | {
        /** Replace the containing relative directory, including its ascent. */
        readonly dir?: RelDir
        /** Replace the whole filename. */
        readonly name?: FileName
        readonly stem?: never
        readonly extension?: never
      }
    | {
        /** Replace the containing relative directory, including its ascent. */
        readonly dir?: RelDir
        readonly name?: never
        /** Replace the filename stem, preserving or composing with `extension`. */
        readonly stem?: string
        /** Replace the final extension; `None` removes it. */
        readonly extension?: Extension | Option.Option<Extension>
      }
}

/**
 * Relative file value — the decoded path (directory + filename).
 */
class RelFile__ extends S.TaggedClass<RelFile__>()('RelFile', {
  /**
   * Containing relative directory. Constructor default is the relative anchor
   * for literal/schema construction; application code building non-anchor files
   * should pass `dir` explicitly or prefer `join(dir, relFile)`.
   */
  dir: S.suspend((): S.toType<typeof RelDir> => S.toType(RelDir)).pipe(
    S.withConstructorDefault(Effect.sync(() => RelDir.anchor)),
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

  /** Leading parent-traversal count delegated from the containing dir. */
  get ascent(): number {
    return this.dir.ascent
  }

  /** Directory segments delegated from the containing dir. */
  get segments(): ReadonlyArray<Segment> {
    return this.dir.segments
  }

  /** Directory depth, counted by named segments from the anchor before the filename; ascent and filename are excluded. */
  get depth(): number {
    return this.dir.depth
  }

  /** Reinterpret this file path as a directory by folding the filename into the segment list. */
  get asDir(): RelDir {
    return RelDir.make({
      ascent: this.ascent,
      segments: [...this.segments, segment(this.fileName.name)],
    })
  }

  /** Ancestor directories, starting at this file's containing directory and ending at the anchor; unlike Rust's `Path::ancestors`, this does not include the file itself. */
  get ancestors(): readonly RelDir[] {
    return ancestorSegments(this.segments, { includeSelf: true }).map((segments) =>
      RelDir.make({ ascent: this.ascent, segments }),
    )
  }

  /** The file re-anchors at the absolute anchor (the filesystem root), dropping `ascent` — consistent with the POSIX `/..` clamp. To resolve against a base directory instead, use the flat `ensureAbs`. */
  get atRoot(): AbsFile {
    return AbsFile.make({ dir: this.dir.atRoot, fileName: this.fileName })
  }

  /** Canonical encoded path string. */
  override toString(): string {
    return renderPath({
      isPathAbsolute: false,
      ascent: this.ascent,
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

attachNodeInspect<RelFile__>(RelFile__.prototype)
attachPathEqual<RelFile__>(RelFile__.prototype)

/**
 * `RelFile` — a relative file path, as a `string` ⇄ `RelFile` value codec.
 * Path values are lexical: `..` folds at decode (`a/../b` decodes as `b`), so equality is normal-form identity, not filesystem-target identity — symlinks can make lexically distinct paths reach the same file. Symlink-aware resolution belongs to filesystem APIs.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(RelFile)('./src/index.ts')
 * ```
 */
export class RelFile_ extends withLiteralStatics(
  withStatics(
    S.asClass(
      S.String.pipe(
        S.annotate({
          identifier: 'RelFile',
          title: 'Relative file path',
          description:
            'A POSIX relative file path — leading `..` steps count as ascent; canonical form starts with `./` or `../` (e.g. `./src/index.ts`).',
          examples: ['./src/index.ts', '../notes.txt'],
        }),
        S.decodeTo(RelFile__, {
          encode: SchemaGetter.transform((encoded) =>
            format({
              isPathAbsolute: false,
              ascent: encoded.dir.ascent,
              fileName: encoded.fileName,
            })(encoded.dir.segments),
          ),
          decode: SchemaGetter.transformOrFail(
            flow(
              analyzeFileRel,
              Result.map((analysis) => ({
                _tag: 'RelFile' as const,
                dir: RelDir.make({
                  ascent: analysis.ascent,
                  segments: analysis.segments.map(segment),
                }),
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
   * Rebuild a relative file with patched file components.
   *
   * @example
   * ```ts
   * RelFile.setParts(file, { stem: 'README' })
   * pipe(file, RelFile.setParts({ extension: Option.none() }))
   * ```
   */
  static readonly setParts: {
    (file: typeof RelFile_.Type, parts: RelFile.Parts): typeof RelFile_.Type
    (parts: RelFile.Parts): (file: typeof RelFile_.Type) => typeof RelFile_.Type
  } = Fn.dual(2, (file: typeof RelFile_.Type, parts: RelFile.Parts): typeof RelFile_.Type =>
    RelFile_.make({
      dir: parts.dir ?? file.dir,
      fileName: resolveFileName(file.fileName, parts),
    }),
  )

  /**
   * Variant schema carrying a realistic generation bias — same set as the
   * canonical schema; generation mixes realistic files 20:1 over the
   * canonical distribution.
   */
  static readonly Realistic = RelFile_.pipe(
    withArbitraryHints({
      candidate: {
        weight: 20,
        make: (fc) =>
          fc
            .record({
              dir: S.toArbitrary(RelDir.Realistic),
              fileName: S.toArbitrary(FileName.Realistic),
            })
            .map((input) => RelFile_.make(input)),
      },
    }),
  )
}

export const RelFile = RelFile_
export type RelFile = typeof RelFile_.Type
