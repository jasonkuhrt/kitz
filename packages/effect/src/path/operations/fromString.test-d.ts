import { Assert } from '@kitz/assert'
import { Path } from '../../_.js'

// fromString should infer specific types from literal strings

// RelDir - starts with ./, ends with /
type _relDir = Assert.exact.of<ReturnType<typeof Path.fromString<'./.release/'>>, Path.RelDir>

// RelFile - starts with ./, has extension
type _relFile = Assert.exact.of<ReturnType<typeof Path.fromString<'./config.json'>>, Path.RelFile>

// AbsDir - starts with /, ends with /
type _absDir = Assert.exact.of<ReturnType<typeof Path.fromString<'/home/user/'>>, Path.AbsDir>

// AbsFile - starts with /, has extension
type _absFile = Assert.exact.of<
  ReturnType<typeof Path.fromString<'/home/user/config.json'>>,
  Path.AbsFile
>

// Plain string should return Path union
type _plainString = Assert.exact.of<ReturnType<typeof Path.fromString<string>>, Path>

// Dotfiles with extensions work correctly
type _envLocal = Assert.exact.of<ReturnType<typeof Path.fromString<'./.env.local'>>, Path.RelFile>

// Dotfiles WITHOUT extensions: type inference sees as directories
// Runtime with Path.fromString also returns RelDir (no hint)
// Use explicit constructor Path.RelFile.fromString('./.gitignore') for correct type AND runtime
type _gitignore = Assert.exact.of<
  ReturnType<typeof Path.fromString<'./.gitignore'>>,
  Path.RelDir // Type inference limitation - use RelFile.fromString() instead
>

// ============================================
// Explicit constructors - always return their specific type
// ============================================

// RelFile.fromString always returns RelFile
type _relFileExplicit = Assert.exact.of<
  ReturnType<typeof Path.RelFile.fromString<'./.gitignore'>>,
  Path.RelFile
>

// RelDir.fromString always returns RelDir
type _relDirExplicit = Assert.exact.of<
  ReturnType<typeof Path.RelDir.fromString<'./readme'>>,
  Path.RelDir
>

// AbsFile.fromString always returns AbsFile
type _absFileExplicit = Assert.exact.of<
  ReturnType<typeof Path.AbsFile.fromString<'/etc/hosts'>>,
  Path.AbsFile
>

// AbsDir.fromString always returns AbsDir
type _absDirExplicit = Assert.exact.of<
  ReturnType<typeof Path.AbsDir.fromString<'/var/log'>>,
  Path.AbsDir
>
