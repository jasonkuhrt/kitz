---
name: kitz-fs
description: This skill should be used when working with filesystem operations or file paths. Covers reading, writing, checking existence, creating directories, joining paths, or any file/path manipulation with @kitz/fs.
---

# Filesystem Operations

Always use `@kitz/fs` (`Fs` and `Fs.Path`) instead of `@effect/platform` (`FileSystem`, `Path`) for filesystem and path operations.

## Why

- **Type-safe paths**: `Fs.Path` provides typed path representations (AbsDir, AbsFile, RelDir, RelFile) instead of raw strings
- **Compile-time validation**: String literals are validated at compile time
- **Unified API**: `Fs.*` operations accept both typed paths and string literals
- **Simpler layers**: No need for `NodePath.layer`

## Imports

```typescript
// GOOD
import { NodeFileSystem } from '@effect/platform-node'
import { Fs } from '@kitz/fs'

// BAD - Don't use these for fs/path operations
import { FileSystem, Path } from '@effect/platform'
import { NodePath } from '@effect/platform-node'
```

## Current Working Directory

Always use `@kitz/env` for cwd instead of `process.cwd()`:

```typescript
import { Env } from '@kitz/env'

const program = Effect.gen(function*() {
  const env = yield* Env.Env
  const configPath = Fs.Path.join(env.cwd, configRel) // env.cwd is already AbsDir
})
```

Why: `env.cwd` is already a typed `AbsDir`, avoiding manual string conversion and working across Node/Deno/Bun.

## Creating Paths

**Prefer `Fs.Path.fromString()`** - it auto-dispatches to the correct type based on the string pattern:

```typescript
// PREFERRED - auto-dispatch based on string literal
const dir = Fs.Path.fromString('/home/user/') // AbsDir (ends with /)
const file = Fs.Path.fromString('/home/user/config.json') // AbsFile (has extension)
const relDir = Fs.Path.fromString('./src/') // RelDir (starts with ./, ends with /)
const relFile = Fs.Path.fromString('./config.json') // RelFile (starts with ./, has extension)
```

The string pattern determines the type:

| Pattern                                  | Type    | Example                  |
| ---------------------------------------- | ------- | ------------------------ |
| Starts with `/`, ends with `/`           | AbsDir  | `/home/user/`            |
| Starts with `/`, has extension           | AbsFile | `/home/user/config.json` |
| Starts with `./` or `../`, ends with `/` | RelDir  | `./src/`                 |
| Starts with `./` or `../`, has extension | RelFile | `./config.json`          |

**Explicit constructors** - use when you need to be explicit, have a non-literal string, or for dotfiles:

```typescript
// Dynamic string from user input
const dir = Fs.Path.AbsDir.fromString(userProvidedPath)

// Dotfiles without extensions (see below)
const gitignore = Fs.Path.RelFile.fromString('./.gitignore')
```

## Dotfiles Without Extensions

**Dotfiles like `.gitignore`, `.env`, `.dockerignore` require explicit constructors for type inference.**

The generic `Fs.Path.fromString()` uses extension presence to distinguish files from directories:

- `.gitignore` → no extension → type inferred as `RelDir` ❌
- `.env.local` → has `.local` extension → type inferred as `RelFile` ✅
- `config.json` → has `.json` extension → type inferred as `RelFile` ✅

**Explicit constructors resolve the ambiguity** by passing hints to the analyzer:

```typescript
// TYPE ISSUE - Fs.Path.fromString infers RelDir (no extension detected)
const gitignore = Fs.Path.fromString('./.gitignore') // Type: RelDir

// CORRECT - explicit file constructor, type is RelFile
const gitignore = Fs.Path.RelFile.fromString('./.gitignore')
const env = Fs.Path.RelFile.fromString('./.env')
const dockerignore = Fs.Path.RelFile.fromString('./.dockerignore')

// These work fine with fromString (have extensions)
const envLocal = Fs.Path.fromString('./.env.local') // RelFile ✅
const config = Fs.Path.fromString('./config.json') // RelFile ✅
```

The explicit constructors (`RelFile.fromString`, `AbsFile.fromString`, etc.) pass a `hint` to the runtime analyzer, ensuring ambiguous dotfiles are correctly parsed as files or directories based on your intent.

## Joining Paths

`Fs.Path.join()` requires a directory as the first argument and a relative path as the second:

```typescript
const cwd = Fs.Path.fromString(process.cwd() + '/') // AbsDir
const configRel = Fs.Path.fromString('./config.json') // RelFile
const configPath = Fs.Path.join(cwd, configRel) // AbsFile

const srcDir = Fs.Path.fromString('./src/') // RelDir
const srcPath = Fs.Path.join(cwd, srcDir) // AbsDir
```

## Anti-Pattern: String Interpolation

Never use string interpolation to combine paths. Always use `Fs.Path.join()`:

```typescript
// BAD - String interpolation defeats type safety
const PLAN_DIR = Fs.Path.fromString('./.release/')
const PLAN_FILE = Fs.Path.fromString('./plan.json')
const path = Fs.Path.fromString(`./${PLAN_DIR}/${PLAN_FILE}`) // ❌ Anti-pattern

// GOOD - Use join to combine path segments
const PLAN_DIR = Fs.Path.fromString('./.release/')
const PLAN_FILE_NAME = Fs.Path.fromString('./plan.json')
const PLAN_FILE = Fs.Path.join(PLAN_DIR, PLAN_FILE_NAME) // ✅ Proper composition
```

Why this matters:

- String interpolation discards type information and re-parses
- `join()` preserves type safety and validates at compile time
- Typed constants can be joined with other paths or converted to string via `.toString()`

## Path Instance Methods & Getters

**Always prefer instance methods/getters over static functions** - cleaner code, smaller bundles:

```typescript
const configFile = Fs.Path.fromString('./config.json')

// PREFERRED - instance getter/method
configFile.name // 'config.json'
configFile.toString() // './config.json'

// AVOID - static functions (verbose, larger bundle)
Fs.Path.name(configFile)
Fs.Path.toString(configFile)
```

Available getters on all path types:

| Getter        | Returns                             | Example                  |
| ------------- | ----------------------------------- | ------------------------ |
| `.name`       | Last segment (filename or dir name) | `'config.json'`, `'src'` |
| `.toString()` | Full path string                    | `'./src/config.json'`    |

## Filesystem Operations

`Fs.*` functions accept both typed paths and string literals:

```typescript
// Check existence
const exists = yield * Fs.exists(configPath)
const exists2 = yield * Fs.exists('/etc/passwd') // String literal also works

// Read file as string
const content = yield * Fs.readString(configPath)

// Read file as bytes
const bytes = yield * Fs.read(filePath)

// Write file (content type based on extension)
yield * Fs.write(configPath, '{ "key": "value" }') // .json expects string/object
yield * Fs.write(readmePath, '# README') // .md expects string

// Create directory
yield * Fs.write(dirPath, { recursive: true })

// Remove file or directory
yield * Fs.remove(configPath)
yield * Fs.remove(dirPath, { recursive: true })
```

## Layer Setup

Only `NodeFileSystem.layer` is needed - no `NodePath.layer`:

```typescript
// GOOD
const layer = Layer.mergeAll(
  Env.Live,
  NodeFileSystem.layer,
  Git.GitLive,
)

// BAD - NodePath.layer is not needed
const layer = Layer.mergeAll(
  Env.Live,
  NodeFileSystem.layer,
  NodePath.layer, // Remove this
  Git.GitLive,
)
```

## Complete Example

```typescript
import { NodeFileSystem } from '@effect/platform-node'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'

const CONFIG_FILE = Fs.Path.fromString('./config.json')

const program = Effect.gen(function*() {
  const env = yield* Env.Env
  const configPath = Fs.Path.join(env.cwd, CONFIG_FILE)

  const exists = yield* Fs.exists(configPath)
  if (exists) {
    const content = yield* Fs.readString(configPath)
    console.log('Config:', content)
  } else {
    yield* Fs.write(configPath, { default: true })
    console.log('Created default config')
  }
})

const layer = Layer.mergeAll(Env.Live, NodeFileSystem.layer)

Effect.runPromise(Effect.provide(program, layer))
```
