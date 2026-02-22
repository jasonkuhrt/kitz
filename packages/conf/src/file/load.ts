import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Fs } from '@kitz/fs'
import { Mod } from '@kitz/mod'
import { Effect, Option, ParseResult, pipe, Schema } from 'effect'
import type { ConfigDefinition } from './define.js'
import { InvalidExportError, NotFoundError } from './errors.js'

/**
 * Result of searching for a config file.
 */
type SearchResult =
  | { readonly _tag: 'Module'; readonly path: Fs.Path.AbsFile }
  | { readonly _tag: 'Json'; readonly path: Fs.Path.AbsFile }
  | { readonly _tag: 'PackageJson'; readonly path: Fs.Path.AbsFile; readonly field: string }
  | { readonly _tag: 'NotFound' }

/**
 * Search for a config file in the given directory.
 */
const searchForConfig = (
  definition: ConfigDefinition<Schema.Schema.AnyNoContext>,
  cwd: Fs.Path.AbsDir,
): Effect.Effect<SearchResult, PlatformError, FileSystem.FileSystem> => {
  const { name, extensions, json, packageJson } = definition

  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    // 1. Search for TS/JS module files
    for (const ext of extensions) {
      const filename = `${name}.config${ext}`
      const filePath = Fs.Path.join(cwd, Fs.Path.RelFile.fromString(filename))
      const exists = yield* fs.exists(Fs.Path.toString(filePath))
      if (exists) {
        return { _tag: 'Module' as const, path: filePath }
      }
    }

    // 2. Search for JSON files
    for (const jsonFile of json) {
      const filePath = Fs.Path.join(cwd, Fs.Path.RelFile.fromString(jsonFile))
      const exists = yield* fs.exists(Fs.Path.toString(filePath))
      if (exists) {
        return { _tag: 'Json' as const, path: filePath }
      }
    }

    // 3. Search for package.json fields
    if (packageJson.length > 0) {
      const pkgPath = Fs.Path.join(cwd, Fs.Path.RelFile.fromString('package.json'))
      const exists = yield* fs.exists(Fs.Path.toString(pkgPath))
      if (exists) {
        const content = yield* fs.readFileString(Fs.Path.toString(pkgPath))
        const pkg = JSON.parse(content) as Record<string, unknown>
        for (const field of packageJson) {
          if (field in pkg) {
            return { _tag: 'PackageJson' as const, path: pkgPath, field }
          }
        }
      }
    }

    return { _tag: 'NotFound' as const }
  })
}

/**
 * Load raw config data from the found file.
 */
const loadRawConfig = (
  result: Exclude<SearchResult, { _tag: 'NotFound' }>,
  definition: ConfigDefinition<Schema.Schema.AnyNoContext>,
): Effect.Effect<unknown, Mod.ImportError | PlatformError | InvalidExportError, FileSystem.FileSystem> => {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    switch (result._tag) {
      case 'Module': {
        const exported = definition.importFn
          ? yield* Mod.importDefault<unknown, Mod.DynamicImportFileOptions>(result.path, {
            importFn: definition.importFn,
          })
          : yield* Mod.importDefault<unknown>(result.path)
        if (exported === undefined || exported === null) {
          return yield* Effect.fail(
            new InvalidExportError({
              context: {
                path: Fs.Path.toString(result.path),
                found: String(exported),
              },
            }),
          )
        }
        return exported
      }
      case 'Json': {
        const content = yield* fs.readFileString(Fs.Path.toString(result.path))
        return JSON.parse(content)
      }
      case 'PackageJson': {
        const content = yield* fs.readFileString(Fs.Path.toString(result.path))
        const pkg = JSON.parse(content) as Record<string, unknown>
        return pkg[result.field]
      }
    }
  })
}

/**
 * Generate the list of file patterns that would be searched.
 */
const getSearchPatterns = (definition: ConfigDefinition<Schema.Schema.AnyNoContext>): string[] => {
  const patterns: string[] = []
  for (const ext of definition.extensions) {
    patterns.push(`${definition.name}.config${ext}`)
  }
  for (const jsonFile of definition.json) {
    patterns.push(jsonFile)
  }
  for (const field of definition.packageJson) {
    patterns.push(`package.json#${field}`)
  }
  return patterns
}

/**
 * Error types for config loading.
 */
export type LoadError =
  | NotFoundError
  | InvalidExportError
  | Mod.ImportError
  | PlatformError
  | ParseResult.ParseError

/**
 * Load a config file based on the definition.
 *
 * Searches for config files in order:
 * 1. TS/JS module files: `{name}.config.{ts,js,mjs,mts}`
 * 2. JSON files (if enabled)
 * 3. package.json fields (if enabled)
 *
 * If no file is found:
 * - When schema has required fields: fails with NotFoundError
 * - When all fields are optional: returns decoded empty object
 *
 * @example
 * ```ts
 * const config = yield* Conf.File.load(ReleaseConfig)
 * ```
 *
 * @example
 * ```ts
 * // With custom cwd
 * const config = yield* Conf.File.load(ReleaseConfig, '/path/to/project')
 * ```
 */
export const load = <S extends Schema.Schema.AnyNoContext>(
  definition: ConfigDefinition<S>,
  cwd?: string,
): Effect.Effect<Schema.Schema.Type<S>, LoadError, FileSystem.FileSystem> => {
  return Effect.gen(function*() {
    const cwdPath = cwd
      ? Fs.Path.AbsDir.fromString(cwd)
      : yield* pipe(
        Effect.sync(() => process.cwd()),
        Effect.map(Fs.Path.AbsDir.fromString),
      )

    const searchResult = yield* searchForConfig(definition, cwdPath)

    if (searchResult._tag === 'NotFound') {
      if (definition.required) {
        return yield* Effect.fail(
          new NotFoundError({
            context: {
              name: definition.name,
              cwd: Fs.Path.toString(cwdPath),
              patterns: getSearchPatterns(definition),
            },
          }),
        )
      }
      // Schema has no required fields, decode empty object
      return yield* Schema.decode(definition.schema)({})
    }

    const rawConfig = yield* loadRawConfig(searchResult, definition)
    return yield* Schema.decode(definition.schema)(rawConfig)
  })
}

/**
 * Try to load a config file, returning Option.none if not found.
 *
 * Unlike {@link load}, this never fails with NotFoundError.
 * Other errors (parse, import, etc.) still propagate.
 */
export const loadOptional = <S extends Schema.Schema.AnyNoContext>(
  definition: ConfigDefinition<S>,
  cwd?: string,
): Effect.Effect<Option.Option<Schema.Schema.Type<S>>, Exclude<LoadError, NotFoundError>, FileSystem.FileSystem> => {
  return pipe(
    load(definition, cwd),
    Effect.map(Option.some),
    Effect.catchTag('KitConfFileNotFoundError', () => Effect.succeed(Option.none())),
  )
}
