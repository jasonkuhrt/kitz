import type { Option } from 'effect'
import type { expectTypeOf } from 'vite-plus/test'
import type * as Path from './__.js'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false

type Assert<T extends true> = T
type IsFunction<T> = T extends (...args: never[]) => unknown ? true : false

declare const absFile: Path.AbsFile
declare const relFile: Path.RelFile
declare const absDir: Path.AbsDir
declare const relDir: Path.RelDir
declare const file: Path.File
declare const dir: Path.Dir
declare const anyPath: Path.Any

type _ExpectTypeOfExported = Assert<IsFunction<typeof expectTypeOf>>

type _AbsFileName = Assert<Equal<typeof absFile.name, string>>
type _AbsFileStem = Assert<Equal<typeof absFile.stem, string>>
type _AbsFileExtension = Assert<
  Equal<typeof absFile.extension, Option.Option<Path.Extension.Extension>>
>
type _AbsFileDir = Assert<Equal<typeof absFile.dir, Path.AbsDir>>
type _AbsFileParent = Assert<Equal<typeof absFile.parent, Path.AbsFile>>
type _AbsFileFileUrl = Assert<Equal<typeof absFile.fileUrl, URL>>

type _RelFileName = Assert<Equal<typeof relFile.name, string>>
type _RelFileStem = Assert<Equal<typeof relFile.stem, string>>
type _RelFileExtension = Assert<
  Equal<typeof relFile.extension, Option.Option<Path.Extension.Extension>>
>
type _RelFileDir = Assert<Equal<typeof relFile.dir, Path.RelDir>>
type _RelFileParent = Assert<Equal<typeof relFile.parent, Path.RelFile>>
type _RelFileAtRoot = Assert<Equal<typeof relFile.atRoot, Path.AbsFile>>

type _AbsDirName = Assert<Equal<typeof absDir.name, Option.Option<Path.Segment>>>
type _AbsDirParent = Assert<Equal<typeof absDir.parent, Path.AbsDir>>
type _AbsDirFileUrl = Assert<Equal<typeof absDir.fileUrl, URL>>

type _RelDirName = Assert<Equal<typeof relDir.name, Option.Option<Path.Segment>>>
type _RelDirParent = Assert<Equal<typeof relDir.parent, Path.RelDir>>
type _RelDirAtRoot = Assert<Equal<typeof relDir.atRoot, Path.AbsDir>>

type _FileStem = Assert<Equal<typeof file.stem, string>>
type _FileExtension = Assert<Equal<typeof file.extension, Option.Option<Path.Extension.Extension>>>
type _FileDir = Assert<Equal<typeof file.dir, Path.AbsDir | Path.RelDir>>

type _DirName = Assert<Equal<typeof dir.name, Option.Option<Path.Segment>>>
type _AnyParent = Assert<Equal<typeof anyPath.parent, Path.Any>>

// @ts-expect-error `stem` is file-only; `Path.Any` must be narrowed first.
type _AnyHasNoStem = Path.Any['stem']

type _JoinAbsDirRelDir = Assert<Equal<Path.Join<Path.AbsDir, Path.RelDir>, Path.AbsDir>>
type _JoinAbsDirRelFile = Assert<Equal<Path.Join<Path.AbsDir, Path.RelFile>, Path.AbsFile>>
type _JoinRelDirRelDir = Assert<Equal<Path.Join<Path.RelDir, Path.RelDir>, Path.RelDir>>
type _JoinRelDirRelFile = Assert<Equal<Path.Join<Path.RelDir, Path.RelFile>, Path.RelFile>>

type _RelativeToAbsDir = Assert<Equal<Path.RelativeTo<Path.AbsDir>, Path.RelDir>>
type _RelativeToAbsFile = Assert<Equal<Path.RelativeTo<Path.AbsFile>, Path.RelFile>>
type _RelativeToRelDir = Assert<Equal<Path.RelativeTo<Path.RelDir>, Path.RelDir>>
type _RelativeToRelFile = Assert<Equal<Path.RelativeTo<Path.RelFile>, Path.RelFile>>

type _EnsureAbsAbsDir = Assert<Equal<Path.EnsureAbs<Path.AbsDir>, Path.AbsDir>>
type _EnsureAbsAbsFile = Assert<Equal<Path.EnsureAbs<Path.AbsFile>, Path.AbsFile>>
type _EnsureAbsRelDir = Assert<Equal<Path.EnsureAbs<Path.RelDir>, Path.AbsDir>>
type _EnsureAbsRelFile = Assert<Equal<Path.EnsureAbs<Path.RelFile>, Path.AbsFile>>

type _FromLiteralRoot = Assert<Equal<Path.FromLiteral<'/'>, Path.AbsDir>>
type _FromLiteralAbsFile = Assert<Equal<Path.FromLiteral<'/x'>, Path.AbsFile>>
type _FromLiteralAbsDir = Assert<Equal<Path.FromLiteral<'/x/'>, Path.AbsDir>>
type _FromLiteralRelFile = Assert<Equal<Path.FromLiteral<'./x'>, Path.RelFile>>
type _FromLiteralRelDir = Assert<Equal<Path.FromLiteral<'./x/'>, Path.RelDir>>
type _FromLiteralParentFile = Assert<Equal<Path.FromLiteral<'../x'>, Path.RelFile>>
type _FromLiteralParentDir = Assert<Equal<Path.FromLiteral<'../x/'>, Path.RelDir>>
type _FromLiteralDotfile = Assert<Equal<Path.FromLiteral<'./.gitignore'>, Path.RelFile>>
type _FromLiteralTrailingDot = Assert<Equal<Path.FromLiteral<'x.'>, Path.RelDir>>
type _FromLiteralString = Assert<Equal<Path.FromLiteral<string>, Path.Any>>

type _AbsFileLiteral = Assert<
  Equal<ReturnType<typeof Path.AbsFile.fromLiteral<'/x'>>, Path.AbsFile>
>
type _AbsDirLiteral = Assert<Equal<ReturnType<typeof Path.AbsDir.fromLiteral<'/x'>>, Path.AbsDir>>
type _RelFileLiteral = Assert<
  Equal<ReturnType<typeof Path.RelFile.fromLiteral<'./x'>>, Path.RelFile>
>
type _RelDirLiteral = Assert<Equal<ReturnType<typeof Path.RelDir.fromLiteral<'./x'>>, Path.RelDir>>

type AbsFileRelParameter = Parameters<typeof Path.AbsFile.fromLiteral<'./x'>>[0]
type AbsFileDirParameter = Parameters<typeof Path.AbsFile.fromLiteral<'/x/'>>[0]
type RelDirAbsParameter = Parameters<typeof Path.RelDir.fromLiteral<'/x/'>>[0]
type RelFileDirParameter = Parameters<typeof Path.RelFile.fromLiteral<'./x/'>>[0]
type AbsDirStringParameter = Parameters<typeof Path.AbsDir.fromLiteral<string>>[0]

// @ts-expect-error relative literals are rejected by the absolute file constructor.
type _AbsFileRejectsRel = Assert<Equal<AbsFileRelParameter, './x'>>

// @ts-expect-error trailing-slash literals are rejected by the absolute file constructor.
type _AbsFileRejectsDir = Assert<Equal<AbsFileDirParameter, '/x/'>>

// @ts-expect-error absolute literals are rejected by the relative directory constructor.
type _RelDirRejectsAbs = Assert<Equal<RelDirAbsParameter, '/x/'>>

// @ts-expect-error directory literals are rejected by the relative file constructor.
type _RelFileRejectsDir = Assert<Equal<RelFileDirParameter, './x/'>>

// @ts-expect-error dynamic strings are rejected by literal-only target constructors.
type _AbsDirRejectsDynamicString = Assert<Equal<AbsDirStringParameter, string>>
