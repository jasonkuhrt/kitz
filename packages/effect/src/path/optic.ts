import { Optic, Result, type Option } from 'effect'
import * as AbsDirModel from './models/AbsDir.js'
import * as AbsFileModel from './models/AbsFile.js'
import type * as AnyModel from './models/Any.js'
import * as FileNameModel from './models/FileName.js'
import * as RelDirModel from './models/RelDir.js'
import * as RelFileModel from './models/RelFile.js'
import type * as ExtensionModel from './models/Extension.js'
import type * as SegmentModel from './models/segment.js'

/** Prism focusing `Path.Any` values that are absolute files. */
export const absFile = Optic.makePrism<AnyModel.Any, AbsFileModel.AbsFile>(
  (path) =>
    AbsFileModel.AbsFile.is(path) ? Result.succeed(path) : Result.fail('Expected AbsFile'),
  (path) => path,
)

/** Prism focusing `Path.Any` values that are absolute directories. */
export const absDir = Optic.makePrism<AnyModel.Any, AbsDirModel.AbsDir>(
  (path) => (AbsDirModel.AbsDir.is(path) ? Result.succeed(path) : Result.fail('Expected AbsDir')),
  (path) => path,
)

/** Prism focusing `Path.Any` values that are relative files. */
export const relFile = Optic.makePrism<AnyModel.Any, RelFileModel.RelFile>(
  (path) =>
    RelFileModel.RelFile.is(path) ? Result.succeed(path) : Result.fail('Expected RelFile'),
  (path) => path,
)

/** Prism focusing `Path.Any` values that are relative directories. */
export const relDir = Optic.makePrism<AnyModel.Any, RelDirModel.RelDir>(
  (path) => (RelDirModel.RelDir.is(path) ? Result.succeed(path) : Result.fail('Expected RelDir')),
  (path) => path,
)

const absFileExtension = Optic.makeLens<
  AbsFileModel.AbsFile,
  Option.Option<ExtensionModel.Extension>
>(
  (file) => file.extension,
  (extension, file) =>
    AbsFileModel.AbsFile.make({
      segments: file.segments,
      fileName: FileNameModel.FileName.make({ stem: file.stem, extension }),
    }),
)

const relFileExtension = Optic.makeLens<
  RelFileModel.RelFile,
  Option.Option<ExtensionModel.Extension>
>(
  (file) => file.extension,
  (extension, file) =>
    RelFileModel.RelFile.make({
      ascent: file.ascent,
      segments: file.segments,
      fileName: FileNameModel.FileName.make({ stem: file.stem, extension }),
    }),
)

/** Prototype-safe optics for absolute file paths. */
export const AbsFile = {
  /** Lens focusing the file name value. */
  fileName: Optic.makeLens<AbsFileModel.AbsFile, FileNameModel.FileName>(
    (file) => file.fileName,
    (fileName, file) => AbsFileModel.AbsFile.make({ segments: file.segments, fileName }),
  ),

  /** Lens focusing the last-dot stem. */
  stem: Optic.makeLens<AbsFileModel.AbsFile, string>(
    (file) => file.stem,
    (stem, file) =>
      AbsFileModel.AbsFile.make({
        segments: file.segments,
        fileName: FileNameModel.FileName.make({ stem, extension: file.extension }),
      }),
  ),

  /** Optional focusing the extension value when the filename has one. */
  extension: absFileExtension.compose(Optic.some<ExtensionModel.Extension>()),

  /** Lens focusing the directory segments that precede the filename. */
  segments: Optic.makeLens<AbsFileModel.AbsFile, readonly SegmentModel.Segment[]>(
    (file) => file.segments,
    (segments, file) => AbsFileModel.AbsFile.make({ segments, fileName: file.fileName }),
  ),
}

/** Prototype-safe optics for relative file paths. */
export const RelFile = {
  /** Lens focusing the file name value. */
  fileName: Optic.makeLens<RelFileModel.RelFile, FileNameModel.FileName>(
    (file) => file.fileName,
    (fileName, file) =>
      RelFileModel.RelFile.make({
        ascent: file.ascent,
        segments: file.segments,
        fileName,
      }),
  ),

  /** Lens focusing the last-dot stem. */
  stem: Optic.makeLens<RelFileModel.RelFile, string>(
    (file) => file.stem,
    (stem, file) =>
      RelFileModel.RelFile.make({
        ascent: file.ascent,
        segments: file.segments,
        fileName: FileNameModel.FileName.make({ stem, extension: file.extension }),
      }),
  ),

  /** Optional focusing the extension value when the filename has one. */
  extension: relFileExtension.compose(Optic.some<ExtensionModel.Extension>()),

  /** Lens focusing the directory segments that precede the filename. */
  segments: Optic.makeLens<RelFileModel.RelFile, readonly SegmentModel.Segment[]>(
    (file) => file.segments,
    (segments, file) =>
      RelFileModel.RelFile.make({ ascent: file.ascent, segments, fileName: file.fileName }),
  ),
}
