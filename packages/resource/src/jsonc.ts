/**
 * JSONC (JSON with Comments) resources.
 *
 * JSONC resources are read-only because round-tripping would lose comments.
 * If you need to write JSONC files, use regular JSON resources which produce
 * valid JSONC output (without comments).
 *
 * @example
 * ```ts
 * import { Resource } from '@kitz/resource'
 *
 * const tsconfig = Resource.createJsonc(
 *   'tsconfig.json',
 *   TsConfigSchema,
 *   defaultTsConfig
 * )
 *
 * // Read-only operations
 * const config = yield* tsconfig.readOrEmpty(projectDir)
 * // tsconfig.write() // ← TypeScript error: property doesn't exist
 * ```
 *
 * @module
 */

import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Fs } from '@kitz/fs'
import { Jsonc } from '@kitz/jsonc'
import { Effect, Option, ParseResult, Schema, SchemaAST } from 'effect'
import { NotFoundError, ParseError, ReadError } from './errors.js'
import type { CreateOptions, ReadOnlyResource, ResourceError } from './resource.js'

export type { ReadOnlyResource } from './resource.js'

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

// ─── JSONC Factory ───────────────────────────────────────────────────────────

/**
 * Create a read-only JSONC resource.
 *
 * JSONC (JSON with Comments) files like tsconfig.json can be read but not
 * written, because encoding would lose comments. This returns a
 * {@link ReadOnlyResource} with only `read`, `readRequired`, and `readOrEmpty` methods.
 *
 * @param filename - Filename to use when path is a directory
 * @param schema - Schema for the JSON object type
 * @param emptyValue - Default value when file doesn't exist
 * @param options - Optional configuration
 *
 * @example
 * ```ts
 * const tsconfig = Resource.createJsonc(
 *   'tsconfig.json',
 *   Schema.Struct({
 *     compilerOptions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
 *   }),
 *   {}
 * )
 *
 * const config = yield* tsconfig.readOrEmpty(projectDir)
 * ```
 */
export const createJsonc = <A, I, R = never>(
  filename: string,
  schema: Schema.Schema<A, I, R>,
  emptyValue: A,
  options?: CreateOptions,
): ReadOnlyResource<A, FileSystem.FileSystem | R> => {
  const parseOptions: SchemaAST.ParseOptions | undefined = options?.preserveExcessProperties
    ? { onExcessProperty: 'preserve' }
    : undefined

  // Compose parseJsonc with the provided schema to get Schema<A, string>
  const jsoncSchema = Schema.compose(Jsonc.parseJsonc(), schema)

  const decode = (content: string, filePath: Fs.Path.AbsFile) =>
    Schema.decode(jsoncSchema, parseOptions)(content).pipe(
      Effect.mapError((error) =>
        new ParseError({
          context: {
            path: filePath,
            detail: ParseResult.TreeFormatter.formatErrorSync(error),
          },
        })
      ),
    )

  const read = (path: Fs.Path.$Abs): Effect.Effect<Option.Option<A>, ResourceError, FileSystem.FileSystem | R> =>
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

  const readRequired = (path: Fs.Path.$Abs): Effect.Effect<A, ResourceError, FileSystem.FileSystem | R> =>
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

  const readOrEmpty = (path: Fs.Path.$Abs): Effect.Effect<A, ResourceError, FileSystem.FileSystem | R> =>
    Effect.gen(function*() {
      const result = yield* read(path)
      return Option.getOrElse(result, () => emptyValue)
    })

  return {
    read,
    readRequired,
    readOrEmpty,
  }
}
