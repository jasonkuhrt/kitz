/**
 * File resources with typed schemas.
 *
 * Resources represent files that can be read/written with automatic
 * schema-based encoding/decoding. The schema transforms between the
 * in-memory type and the file's string content.
 *
 * @example
 * ```ts
 * import { Resource } from '@kitz/resource'
 * import { Git } from '@kitz/git'
 *
 * // Text-based schema (gitignore, yaml, etc.)
 * const gitignore = Resource.create('.gitignore', Git.Gitignore.Schema, Git.Gitignore.empty)
 *
 * // JSON schema
 * const config = Resource.createJson('config.json', ConfigSchema, defaultConfig)
 *
 * // Usage
 * const data = yield* config.readOrEmpty(projectDir)
 * const updated = yield* config.update(projectDir, (c) => ({ ...c, version: '2.0' }))
 * ```
 *
 * @module
 */

import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Fs } from '@kitz/fs'
import { Effect, Option, ParseResult, Schema, SchemaAST } from 'effect'
import { EncodeError, NotFoundError, ParseError, ReadError, WriteError } from './errors.js'

export { EncodeError, NotFoundError, ParseError, ReadError, WriteError }

export type ResourceError = ReadError | WriteError | ParseError | EncodeError | NotFoundError

// ─── Interfaces ──────────────────────────────────────────────────────────────

/**
 * A file resource with read, write, update, and delete operations.
 *
 * @typeParam T - The in-memory type after decoding
 * @typeParam R - Effect requirements (typically FileSystem)
 */
export interface Resource<T = unknown, R = FileSystem.FileSystem> {
  /**
   * Read the resource from disk.
   *
   * @param path - Directory containing the resource, or absolute file path
   * @returns Some(value) if file exists, None if not found
   */
  read: (path: Fs.Path.$Abs) => Effect.Effect<Option.Option<T>, ResourceError, R>

  /**
   * Read the resource, failing if not found.
   *
   * @param path - Directory containing the resource, or absolute file path
   */
  readRequired: (path: Fs.Path.$Abs) => Effect.Effect<T, ResourceError, R>

  /**
   * Read the resource, returning empty value if not found.
   *
   * @param path - Directory containing the resource, or absolute file path
   */
  readOrEmpty: (path: Fs.Path.$Abs) => Effect.Effect<T, ResourceError, R>

  /**
   * Write the resource to disk.
   *
   * @param value - Value to encode and write
   * @param path - Directory to write to, or absolute file path
   */
  write: (value: T, path: Fs.Path.$Abs) => Effect.Effect<void, ResourceError, R>

  /**
   * Read, transform, and write the resource atomically.
   *
   * @param path - Directory containing the resource, or absolute file path
   * @param fn - Transform function applied to current value (or empty if not found)
   * @returns The new value after transformation
   */
  update: (path: Fs.Path.$Abs, fn: (current: T) => T) => Effect.Effect<T, ResourceError, R>

  /**
   * Delete the resource file.
   *
   * @param path - Directory containing the resource, or absolute file path
   * @returns true if file existed and was deleted, false if not found
   */
  delete: (path: Fs.Path.$Abs) => Effect.Effect<boolean, ResourceError, R>
}

/**
 * A read-only file resource (no write/update/delete operations).
 *
 * Used for formats like JSONC where round-trip would lose data (comments).
 *
 * @typeParam T - The in-memory type after decoding
 * @typeParam R - Effect requirements (typically FileSystem)
 */
export interface ReadOnlyResource<T = unknown, R = FileSystem.FileSystem> {
  /**
   * Read the resource from disk.
   *
   * @param path - Directory containing the resource, or absolute file path
   * @returns Some(value) if file exists, None if not found
   */
  read: (path: Fs.Path.$Abs) => Effect.Effect<Option.Option<T>, ResourceError, R>

  /**
   * Read the resource, failing if not found.
   *
   * @param path - Directory containing the resource, or absolute file path
   */
  readRequired: (path: Fs.Path.$Abs) => Effect.Effect<T, ResourceError, R>

  /**
   * Read the resource, returning empty value if not found.
   *
   * @param path - Directory containing the resource, or absolute file path
   */
  readOrEmpty: (path: Fs.Path.$Abs) => Effect.Effect<T, ResourceError, R>
}

// ─── Options ─────────────────────────────────────────────────────────────────

/**
 * Options for creating resources.
 */
export interface CreateOptions {
  /**
   * Preserve unknown properties during schema decode/encode.
   *
   * When true, properties not defined in the schema are preserved
   * during round-trips. Useful for config files like package.json
   * that have many fields beyond what your schema defines.
   *
   * @default false
   */
  preserveExcessProperties?: boolean
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Resolve path to absolute file path.
 * If path is already a file, use it directly.
 * If path is a directory, join with filename.
 */
const resolvePath = (path: Fs.Path.$Abs, filename: string): Fs.Path.AbsFile => {
  if (Fs.Path.AbsFile.is(path)) {
    return path
  }
  const relFile = Schema.decodeSync(Fs.Path.RelFile.Schema)(filename)
  return Fs.Path.join(path, relFile)
}

// ─── Core Factory ────────────────────────────────────────────────────────────

/**
 * Create a resource with a string-based schema.
 *
 * The schema must transform between `T` (in-memory type) and `string`
 * (file content). For JSON schemas, use {@link createJson} instead.
 *
 * @param filename - Filename to use when path is a directory
 * @param schema - Schema that transforms between T and string
 * @param emptyValue - Default value when file doesn't exist
 * @param options - Optional configuration
 *
 * @example
 * ```ts
 * // Custom text format with Schema<T, string>
 * const gitignore = Resource.create(
 *   '.gitignore',
 *   Git.Gitignore.Schema,
 *   Git.Gitignore.empty
 * )
 * ```
 */
export const create = <T, R = never>(
  filename: string,
  schema: Schema.Schema<T, string, R>,
  emptyValue: T,
  options?: CreateOptions,
): Resource<T, FileSystem.FileSystem | R> => {
  const parseOptions: SchemaAST.ParseOptions | undefined = options?.preserveExcessProperties
    ? { onExcessProperty: 'preserve' }
    : undefined

  const decode = (content: string, filePath: Fs.Path.AbsFile) =>
    Schema.decode(schema, parseOptions)(content).pipe(
      Effect.mapError((error) =>
        new ParseError({
          context: {
            path: filePath,
            detail: ParseResult.TreeFormatter.formatErrorSync(error),
          },
        })
      ),
    )

  const encode = (value: T, filePath: Fs.Path.AbsFile) =>
    Schema.encode(schema, parseOptions)(value).pipe(
      Effect.mapError((error) =>
        new EncodeError({
          context: {
            path: filePath,
            detail: ParseResult.TreeFormatter.formatErrorSync(error),
          },
        })
      ),
    )

  const read = (path: Fs.Path.$Abs) =>
    Effect.gen(function*() {
      const filePath = resolvePath(path, filename)

      const exists = yield* Fs.exists(filePath).pipe(
        Effect.mapError((error: PlatformError) =>
          new ReadError({
            context: {
              path: filePath,
              detail: `check exists: ${error.message}`,
            },
          })
        ),
      )

      if (!exists) return Option.none()

      const content = yield* Fs.readString(filePath).pipe(
        Effect.mapError((error: PlatformError) =>
          new ReadError({
            context: {
              path: filePath,
              detail: error.message,
            },
          })
        ),
      )

      const decoded = yield* decode(content, filePath)
      return Option.some(decoded)
    })

  const readRequired = (path: Fs.Path.$Abs) =>
    Effect.gen(function*() {
      const result = yield* read(path)
      if (Option.isNone(result)) {
        const filePath = resolvePath(path, filename)
        return yield* Effect.fail(
          new NotFoundError({
            context: { path: filePath },
          }),
        )
      }
      return result.value
    })

  const readOrEmpty = (path: Fs.Path.$Abs) =>
    Effect.gen(function*() {
      const result = yield* read(path)
      return Option.getOrElse(result, () => emptyValue)
    })

  const write = (value: T, path: Fs.Path.$Abs) =>
    Effect.gen(function*() {
      const filePath = resolvePath(path, filename)
      const content = yield* encode(value, filePath)

      // Fs.write auto-creates parent directories
      yield* Fs.write(filePath, content).pipe(
        Effect.mapError((error: PlatformError) =>
          new WriteError({
            context: {
              path: filePath,
              detail: error.message,
            },
          })
        ),
      )
    })

  const update = (path: Fs.Path.$Abs, fn: (current: T) => T) =>
    Effect.gen(function*() {
      const current = yield* readOrEmpty(path)
      const updated = fn(current)
      yield* write(updated, path)
      return updated
    })

  const delete_ = (path: Fs.Path.$Abs) =>
    Effect.gen(function*() {
      const filePath = resolvePath(path, filename)

      const exists = yield* Fs.exists(filePath).pipe(
        Effect.mapError((error: PlatformError) =>
          new WriteError({
            context: {
              path: filePath,
              detail: `check exists: ${error.message}`,
            },
          })
        ),
      )

      if (!exists) return false

      yield* Fs.remove(filePath).pipe(
        Effect.mapError((error: PlatformError) =>
          new WriteError({
            context: {
              path: filePath,
              detail: `delete: ${error.message}`,
            },
          })
        ),
      )

      return true
    })

  return {
    read,
    readRequired,
    readOrEmpty,
    write,
    update,
    delete: delete_,
  }
}

// ─── JSON Convenience ────────────────────────────────────────────────────────

/**
 * Create a JSON resource.
 *
 * Wraps the schema with `Schema.parseJson` internally, so you provide
 * a schema for the parsed object type (not string).
 *
 * @param filename - Filename to use when path is a directory
 * @param schema - Schema for the JSON object type
 * @param emptyValue - Default value when file doesn't exist
 * @param options - Optional configuration
 *
 * @example
 * ```ts
 * const config = Resource.createJson(
 *   'config.json',
 *   Schema.Struct({ name: Schema.String, port: Schema.Number }),
 *   { name: '', port: 3000 }
 * )
 * ```
 */
export const createJson = <A, I, R = never>(
  filename: string,
  schema: Schema.Schema<A, I, R>,
  emptyValue: A,
  options?: CreateOptions,
): Resource<A, FileSystem.FileSystem | R> => {
  // Compose with parseJson to get Schema<A, string>
  const jsonSchema = Schema.compose(Schema.parseJson(), schema)
  return create(filename, jsonSchema, emptyValue, options) as Resource<A, FileSystem.FileSystem | R>
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

export const isReadError = (error: ResourceError): error is ReadError => error._tag === 'ResourceReadError'

export const isWriteError = (error: ResourceError): error is WriteError => error._tag === 'ResourceWriteError'

export const isParseError = (error: ResourceError): error is ParseError => error._tag === 'ResourceParseError'

export const isEncodeError = (error: ResourceError): error is EncodeError => error._tag === 'ResourceEncodeError'

export const isResourceError = (u: unknown): u is ResourceError =>
  typeof u === 'object' && u !== null && '_tag' in u
  && (u._tag === 'ResourceReadError' || u._tag === 'ResourceWriteError'
    || u._tag === 'ResourceParseError' || u._tag === 'ResourceEncodeError')
