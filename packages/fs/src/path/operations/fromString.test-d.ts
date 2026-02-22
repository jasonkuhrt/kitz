import { Assert } from '@kitz/assert'
import { Fs } from '../../_.js'

// fromString should infer specific types from literal strings

// RelDir - starts with ./, ends with /
type _relDir = Assert.exact.of<
  ReturnType<typeof Fs.Path.fromString<'./.release/'>>,
  Fs.Path.RelDir
>

// RelFile - starts with ./, has extension
type _relFile = Assert.exact.of<
  ReturnType<typeof Fs.Path.fromString<'./config.json'>>,
  Fs.Path.RelFile
>

// AbsDir - starts with /, ends with /
type _absDir = Assert.exact.of<
  ReturnType<typeof Fs.Path.fromString<'/home/user/'>>,
  Fs.Path.AbsDir
>

// AbsFile - starts with /, has extension
type _absFile = Assert.exact.of<
  ReturnType<typeof Fs.Path.fromString<'/home/user/config.json'>>,
  Fs.Path.AbsFile
>

// Plain string should return Path union
type _plainString = Assert.exact.of<
  ReturnType<typeof Fs.Path.fromString<string>>,
  Fs.Path
>

// Dotfiles with extensions work correctly
type _envLocal = Assert.exact.of<
  ReturnType<typeof Fs.Path.fromString<'./.env.local'>>,
  Fs.Path.RelFile
>

// Dotfiles WITHOUT extensions: type inference sees as directories
// Runtime with Fs.Path.fromString also returns RelDir (no hint)
// Use explicit constructor Fs.Path.RelFile.fromString('./.gitignore') for correct type AND runtime
type _gitignore = Assert.exact.of<
  ReturnType<typeof Fs.Path.fromString<'./.gitignore'>>,
  Fs.Path.RelDir // Type inference limitation - use RelFile.fromString() instead
>

// ============================================
// Explicit constructors - always return their specific type
// ============================================

// RelFile.fromString always returns RelFile
type _relFileExplicit = Assert.exact.of<
  ReturnType<typeof Fs.Path.RelFile.fromString<'./.gitignore'>>,
  Fs.Path.RelFile
>

// RelDir.fromString always returns RelDir
type _relDirExplicit = Assert.exact.of<
  ReturnType<typeof Fs.Path.RelDir.fromString<'./readme'>>,
  Fs.Path.RelDir
>

// AbsFile.fromString always returns AbsFile
type _absFileExplicit = Assert.exact.of<
  ReturnType<typeof Fs.Path.AbsFile.fromString<'/etc/hosts'>>,
  Fs.Path.AbsFile
>

// AbsDir.fromString always returns AbsDir
type _absDirExplicit = Assert.exact.of<
  ReturnType<typeof Fs.Path.AbsDir.fromString<'/var/log'>>,
  Fs.Path.AbsDir
>
