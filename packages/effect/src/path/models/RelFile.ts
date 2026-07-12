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
import { type AnalysisFile, analyzeFileRel, format } from '../analyzer.js'
import { ancestorSegments } from '../core/ancestors.js'
import { attachPathEqual } from '../core/equality.js'
import { attachNodeInspect } from '../core/inspect.js'
import type { LiteralGuard } from '../core/literal.js'
import { renderPath } from '../core/render.js'
import { resolveFileName } from '../core/setParts.js'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withLiteralStatics } from '../core/statics.js'
import { AbsFile } from './AbsFile.js'
import { Ascent } from './arbitrary.js'
import type { Extension } from './Extension.js'
import { FileName, type FileNameLiteralGuard } from './FileName.js'
import { RelDir } from './RelDir.js'
import { Segment, segment } from './segment.js'

export declare namespace RelFile {
  export type Parts<
    $Dir extends RelDir | string = RelDir,
    $Name extends FileName | string = FileName,
  > =
    | {
        /** Replace the containing relative directory, including its ascent. */
        readonly dir?: $Dir
        /** Replace the whole filename. */
        readonly name?: $Name
        readonly stem?: never
        readonly extension?: never
      }
    | {
        /** Replace the containing relative directory, including its ascent. */
        readonly dir?: $Dir
        readonly name?: never
        /** Replace the filename stem, preserving or composing with `extension`. */
        readonly stem?: string
        /** Replace the final extension; `None` removes it. */
        readonly extension?: Extension | Option.Option<Extension>
      }
}

type RelFilePartsInput = RelFile.Parts<RelDir | string, FileName | string>

type RelFileSetPartsLiteralGuard<$S extends string, $Target> = LiteralGuard<
  $S,
  $Target,
  'Path.RelFile.setParts'
>

type RelFileSetPartsFileNameLiteralGuard<$S extends string> = FileNameLiteralGuard<
  $S,
  'Path.RelFile.setParts'
>

type Part<$Parts, $Key extends PropertyKey> = $Key extends keyof $Parts
  ? Exclude<$Parts[$Key], undefined>
  : never

type GuardedRelFileParts<$Parts extends RelFilePartsInput> = $Parts & {
  readonly dir?: Part<$Parts, 'dir'> extends infer $Dir
    ? $Dir extends string
      ? RelFileSetPartsLiteralGuard<$Dir, RelDir>
      : $Dir
    : never
  readonly name?: Part<$Parts, 'name'> extends infer $Name
    ? $Name extends string
      ? RelFileSetPartsFileNameLiteralGuard<$Name>
      : $Name
    : never
}

type RelFileSubject<$File extends RelFile__ | string> = $File extends string
  ? RelFileSetPartsLiteralGuard<$File, RelFile__>
  : $File

/**
 * Relative file value — the decoded path (directory + filename).
 */
class RelFile__ extends S.TaggedClass<RelFile__>('@kitz/effect/Path/RelFile')('RelFile', {
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
  get ascent(): typeof Ascent.Type {
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

  /**
   * Render display text. This display-only surface makes no identity or
   * roundtrip promise: never feed its output to a path decoder. With no options
   * it currently returns canonical text as a sensible default, not a contract;
   * display options may grow pragmatically.
   */
  format(options?: { readonly bare?: boolean }): string {
    return renderPath(
      {
        isPathAbsolute: false,
        ascent: this.ascent,
        segments: this.segments,
        fileName: this.fileName.name,
      },
      options,
    )
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

const decodeAnalysis = (analysis: AnalysisFile) =>
  SchemaParser.decodeEffect(RelDir.FromStruct)({
    ascent: analysis.ascent,
    segments: analysis.segments,
  }).pipe(
    Effect.map((dir) => ({
      _tag: 'RelFile' as const,
      dir,
      fileName: analysis.fileName,
    })),
  )

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
            flow(analyzeFileRel, Effect.fromResult, Effect.flatMap(decodeAnalysis)),
          ),
        }),
        S.overrideToFormatter(() => (path) => path.toString()),
      ),
    ),
  ),
  'Path.RelFile.make',
) {
  /** Build a relative file from a base dir, optional dynamic segments, and a validated name. */
  static readonly join: {
    (base: RelDir, name: string): RelFile
    (base: RelDir, segments: Iterable<string>, name: string): RelFile
  } = (base: RelDir, segmentsOrName: Iterable<string> | string, name?: string): RelFile => {
    const dir: RelDir = name === undefined ? base : RelDir.join(base, segmentsOrName as any)
    const nameText: string = name === undefined ? (segmentsOrName as any) : name
    return RelFile_.make({ dir, fileName: FileName.make(nameText) })
  }

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
    <const $File extends RelFile__ | string, const $Parts extends RelFilePartsInput>(
      file: RelFileSubject<$File>,
      parts: GuardedRelFileParts<$Parts>,
    ): typeof RelFile_.Type
    <const $Parts extends RelFilePartsInput>(
      parts: GuardedRelFileParts<$Parts>,
    ): <const $File extends RelFile__ | string>(file: RelFileSubject<$File>) => typeof RelFile_.Type
  } = Fn.dual(2, (file: RelFile__ | string, parts: RelFilePartsInput): typeof RelFile_.Type => {
    const fileValue: RelFile__ = typeof file === 'string' ? S.decodeSync(RelFile_)(file) : file
    const dir: RelDir =
      typeof parts.dir === 'string' ? S.decodeSync(RelDir)(parts.dir) : (parts.dir ?? fileValue.dir)
    const name: FileName | undefined =
      typeof parts.name === 'string' ? S.decodeSync(FileName)(parts.name) : parts.name

    return RelFile_.make({
      dir,
      fileName: resolveFileName(fileValue.fileName, {
        ...(name === undefined ? {} : { name }),
        ...(parts.stem === undefined ? {} : { stem: parts.stem }),
        ...(parts.extension === undefined ? {} : { extension: parts.extension }),
      }),
    })
  }) as any

  /**
   * Decode/encode paths as flat structured JSON instead of strings.
   *
   * @example
   * ```ts
   * const Payload = S.Struct({ entry: RelFile.FromStruct })
   * ```
   */
  static readonly FromStruct = S.Struct({
    ascent: Ascent,
    segments: S.Array(Segment),
    fileName: FileName,
  }).pipe(
    S.decodeTo(RelFile__, {
      encode: SchemaGetter.transform((encoded) => ({
        ascent: encoded.dir.ascent,
        segments: encoded.dir.segments,
        fileName: S.decodeSync(FileName)(encoded.fileName),
      })),
      decode: SchemaGetter.transform((decoded) => ({
        _tag: 'RelFile' as const,
        dir: RelDir.make({ ascent: decoded.ascent, segments: decoded.segments }),
        fileName: S.encodeSync(FileName)(decoded.fileName),
      })),
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
