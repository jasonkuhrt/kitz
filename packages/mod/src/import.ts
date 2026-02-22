import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Effect, Option, pipe, Schema as S } from 'effect'

/**
 * Base ES module type. Use as constraint or when module structure is unknown.
 */
export interface EsModule {
  /** The module's default export. */
  default: unknown
  /** Named exports. */
  [key: string]: unknown
}

// ============================================
// Import Errors
// ============================================

const baseTags = ['kit', 'mod', 'import'] as const

/**
 * Module not found at the specified path.
 *
 * Triggered by Node.js codes: ERR_MODULE_NOT_FOUND, ENOENT
 */
export const ImportErrorNotFound = Err.TaggedContextualError(
  'KitModImportErrorNotFound',
  baseTags,
  {
    context: S.Struct({
      /** The file path that was not found. */
      path: Fs.Path.AbsFile.Schema,
    }),
    message: (ctx) => `Module not found: ${Fs.Path.toString(ctx.path)}`,
    cause: S.instanceOf(Error),
  },
)

/**
 * Instance type of {@link ImportErrorNotFound}.
 */
export type ImportErrorNotFound = InstanceType<typeof ImportErrorNotFound>

/**
 * Syntax error in the module source code.
 *
 * Triggered when parsing fails due to invalid JavaScript/TypeScript syntax.
 */
export const ImportErrorSyntax = Err.TaggedContextualError(
  'KitModImportErrorSyntax',
  baseTags,
  {
    context: S.Struct({
      /** The file path with syntax error. */
      path: Fs.Path.AbsFile.Schema,
    }),
    message: (ctx) => `Syntax error in module: ${Fs.Path.toString(ctx.path)}`,
    cause: S.instanceOf(SyntaxError),
  },
)

/**
 * Instance type of {@link ImportErrorSyntax}.
 */
export type ImportErrorSyntax = InstanceType<typeof ImportErrorSyntax>

/**
 * Package configuration error.
 *
 * Triggered by Node.js codes: ERR_INVALID_PACKAGE_CONFIG, ERR_PACKAGE_PATH_NOT_EXPORTED, etc.
 */
export const ImportErrorPackageConfig = Err.TaggedContextualError(
  'KitModImportErrorPackageConfig',
  baseTags,
  {
    context: S.Struct({
      /** The file path that triggered the error. */
      path: Fs.Path.AbsFile.Schema,
      /** The Node.js error code. */
      code: S.String,
    }),
    message: (ctx) => `Package config error for ${Fs.Path.toString(ctx.path)}: ${ctx.code}`,
    cause: S.instanceOf(Error),
  },
)

/**
 * Instance type of {@link ImportErrorPackageConfig}.
 */
export type ImportErrorPackageConfig = InstanceType<typeof ImportErrorPackageConfig>

/**
 * Permission denied when accessing the module file.
 *
 * Triggered by Node.js code: EACCES
 */
export const ImportErrorPermissionDenied = Err.TaggedContextualError(
  'KitModImportErrorPermissionDenied',
  baseTags,
  {
    context: S.Struct({
      /** The file path that permission was denied for. */
      path: Fs.Path.AbsFile.Schema,
    }),
    message: (ctx) => `Permission denied: ${Fs.Path.toString(ctx.path)}`,
    cause: S.instanceOf(Error),
  },
)

/**
 * Instance type of {@link ImportErrorPermissionDenied}.
 */
export type ImportErrorPermissionDenied = InstanceType<typeof ImportErrorPermissionDenied>

/**
 * Unsupported file format or extension.
 *
 * Triggered by Node.js code: ERR_UNKNOWN_FILE_EXTENSION
 */
export const ImportErrorUnsupportedFormat = Err.TaggedContextualError(
  'KitModImportErrorUnsupportedFormat',
  baseTags,
  {
    context: S.Struct({
      /** The file path with unsupported format. */
      path: Fs.Path.AbsFile.Schema,
      /** The file extension, if available. */
      extension: S.optional(S.String),
    }),
    message: (ctx) => `Unsupported format: ${Fs.Path.toString(ctx.path)}${ctx.extension ? ` (${ctx.extension})` : ''}`,
    cause: S.instanceOf(Error),
  },
)

/**
 * Instance type of {@link ImportErrorUnsupportedFormat}.
 */
export type ImportErrorUnsupportedFormat = InstanceType<typeof ImportErrorUnsupportedFormat>

/**
 * Catch-all for other import errors not covered by specific types.
 */
export const ImportErrorOther = Err.TaggedContextualError(
  'KitModImportErrorOther',
  baseTags,
  {
    context: S.Struct({
      /** The file path that failed to import. */
      path: Fs.Path.AbsFile.Schema,
      /** The Node.js error code, if available. */
      code: S.optional(S.String),
    }),
    message: (ctx) => `Import failed: ${Fs.Path.toString(ctx.path)}${ctx.code ? ` (${ctx.code})` : ''}`,
    cause: S.instanceOf(Error),
  },
)

/**
 * Instance type of {@link ImportErrorOther}.
 */
export type ImportErrorOther = InstanceType<typeof ImportErrorOther>

/**
 * Union of all import error types.
 *
 * Each error has a distinct `_tag` for use with Effect's `catchTag`.
 */
export type ImportError =
  | ImportErrorNotFound
  | ImportErrorSyntax
  | ImportErrorPackageConfig
  | ImportErrorPermissionDenied
  | ImportErrorUnsupportedFormat
  | ImportErrorOther

/**
 * Categorize an import error into the appropriate typed error.
 */
const createImportError = (path: Fs.Path.AbsFile, cause: Error): ImportError => {
  const code = (cause as NodeJS.ErrnoException).code

  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'ENOENT') {
    return new ImportErrorNotFound({ context: { path }, cause })
  }
  if (code === 'EACCES') {
    return new ImportErrorPermissionDenied({ context: { path }, cause })
  }
  if (code === 'ERR_UNKNOWN_FILE_EXTENSION') {
    const extension = Fs.Path.toString(path).split('.').pop()
    return new ImportErrorUnsupportedFormat({
      context: extension ? { path, extension } : { path },
      cause,
    })
  }
  if (code?.startsWith('ERR_INVALID_PACKAGE') || code?.startsWith('ERR_PACKAGE')) {
    return new ImportErrorPackageConfig({ context: { path, code }, cause })
  }
  if (cause instanceof SyntaxError) {
    return new ImportErrorSyntax({ context: { path }, cause })
  }

  return new ImportErrorOther({ context: code ? { path, code } : { path }, cause })
}

export interface DynamicImportFileOptions {
  /**
   * Append mtime query param to bust Node.js ESM module cache.
   *
   * Required because ESM caches by URL with no invalidation API.
   * Useful in development/watch mode scenarios.
   *
   * @default false
   */
  bustCache?: boolean

  /**
   * Custom import function to use instead of native `import()`.
   *
   * Useful for bundlers like Vite that provide their own module resolution
   * which can handle features Node.js native ESM cannot, such as:
   * - Resolving `.js` → `.ts` extensions
   * - TypeScript path aliases
   * - Virtual modules
   *
   * @example Vite 5 (ssrLoadModule)
   * ```ts
   * // In Vite plugin configureServer():
   * Mod.dynamicImportFile(path, {
   *   importFn: (url) => server.ssrLoadModule(url)
   * })
   * ```
   *
   * @example Vite 6+ (ModuleRunner)
   * ```ts
   * // In Vite plugin configureServer():
   * const runner = createServerModuleRunner(server.environments.ssr)
   * Mod.dynamicImportFile(path, {
   *   importFn: (url) => runner.import(url)
   * })
   * ```
   */
  importFn?: (url: string) => Promise<unknown>
}

/**
 * Dynamically import a local file as an Effect.
 *
 * Handles the promise wrapper and provides typed module structure.
 * Optionally supports cache busting via mtime query parameter.
 *
 * **Return type adapts to options:**
 * - Without `bustCache`: `Effect<Module, ImportError>` - may fail with import error
 * - With `bustCache: true`: `Effect<Module, ImportError | PlatformError, FileSystem>` - also requires filesystem
 *
 * @param path - Absolute file path to import
 * @param options - Import options
 *
 * @example
 * ```ts
 * // Simplest usage - no type, no options
 * const path = Fs.Path.AbsFile.fromString('/path/to/module.js')
 * const mod = yield* Mod.dynamicImportFile(path)
 * mod.default // unknown
 * ```
 *
 * @example
 * ```ts
 * // Typed default export
 * const mod = yield* Mod.dynamicImportFile<{ default: Config }>(path)
 * ```
 *
 * @example
 * ```ts
 * // Full module type with named exports
 * const mod = yield* Mod.dynamicImportFile<{
 *   default: Config
 *   helper: () => void
 * }>(path)
 * ```
 *
 * @example
 * ```ts
 * // With cache busting - requires FileSystem service
 * const mod = yield* Mod.dynamicImportFile(path, { bustCache: true })
 * // Must provide FileSystem layer
 * program.pipe(Effect.provide(NodeFileSystem.layer))
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import | MDN: import()} - Dynamic import expression
 * @see {@link https://nodejs.org/api/esm.html | Node.js: ESM} - Module resolution and caching behavior
 * @see {@link https://github.com/nodejs/node/issues/49442 | Node.js #49442} - Why no cache invalidation API exists
 */
export const dynamicImportFile = <
  $Module extends EsModule = EsModule,
  const $Options extends DynamicImportFileOptions | undefined = undefined,
>(
  path: Fs.Path.AbsFile,
  options?: $Options,
): DynamicImportFileResult<$Module, $Options> => {
  const importUrl = Fs.Path.toFileUrl(path)

  // Use custom importFn if provided, otherwise native import()
  const performImport = options?.importFn
    ? () => options.importFn!(importUrl.href)
    : () => import(importUrl.href)

  const doImport = Effect.tryPromise({
    try: performImport,
    catch: (cause) => createImportError(path, cause instanceof Error ? cause : new Error(String(cause))),
  }) as Effect.Effect<$Module, ImportError>

  if (options?.bustCache) {
    return Effect.gen(function*() {
      const info = yield* Fs.stat(path)
      const mtime = pipe(
        info.mtime,
        Option.map(d => d.getTime()),
        Option.getOrElse(() => 0),
      )
      importUrl.searchParams.set('t', String(mtime))
      return yield* doImport
    }) as any
  }

  return doImport as any
}

/**
 * Result type for {@link dynamicImportFile}.
 *
 * Always includes {@link ImportError} for import failures.
 * When `bustCache: true`, also requires FileSystem service and may fail with PlatformError.
 */
// dprint-ignore
export type DynamicImportFileResult<$Module, $Options> =
  $Options extends { bustCache: true } ? Effect.Effect<$Module, ImportError | PlatformError, FileSystem.FileSystem> :
                                         Effect.Effect<$Module, ImportError, never>

/**
 * Dynamically import a file and extract its default export.
 *
 * Convenience wrapper around {@link dynamicImportFile} that extracts the default export.
 * Useful when you only care about the default export and don't need named exports.
 *
 * @param path - Absolute file path to import
 * @param options - Import options (same as {@link dynamicImportFile})
 *
 * @example
 * ```ts
 * // Import and extract default export in one step
 * const config = yield* Mod.importDefault<Config>(path)
 * // vs:
 * const mod = yield* Mod.dynamicImportFile<{ default: Config }>(path)
 * const config = mod.default
 * ```
 *
 * @see {@link dynamicImportFile} - For full module access including named exports
 */
export const importDefault = <
  $Default,
  const $Options extends DynamicImportFileOptions | undefined = undefined,
>(
  path: Fs.Path.AbsFile,
  options?: $Options,
): ImportDefaultResult<$Default, $Options> => {
  return Effect.map(
    dynamicImportFile<{ default: $Default }, $Options>(path, options),
    (mod) => mod.default,
  ) as any
}

/**
 * Result type for {@link importDefault}.
 *
 * Same error and requirement characteristics as {@link DynamicImportFileResult},
 * but returns the default export directly instead of the full module.
 */
// dprint-ignore
export type ImportDefaultResult<$Default, $Options> =
  $Options extends { bustCache: true } ? Effect.Effect<$Default, ImportError | PlatformError, FileSystem.FileSystem> :
                                         Effect.Effect<$Default, ImportError, never>
