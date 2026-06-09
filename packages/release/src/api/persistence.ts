import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect, Option, PlatformError, Schema, SchemaAST, SchemaIssue, FileSystem } from 'effect'

const formatSchemaIssue = SchemaIssue.makeFormatterDefault()
const UnknownJsonFromString = Schema.fromJsonString(Schema.Unknown)

const mapReadError = (path: Fs.Path.AbsFile, detail: string): Resource.ReadError =>
  new Resource.ReadError({ context: { path, detail } })

const mapWriteError = (path: Fs.Path.AbsFile, detail: string): Resource.WriteError =>
  new Resource.WriteError({ context: { path, detail } })

const mapParseError = (path: Fs.Path.AbsFile, detail: string): Resource.ParseError =>
  new Resource.ParseError({ context: { path, detail } })

const mapEncodeError = (path: Fs.Path.AbsFile, detail: string): Resource.EncodeError =>
  new Resource.EncodeError({ context: { path, detail } })

const readStringIfExists = (
  path: Fs.Path.AbsFile,
): Effect.Effect<Option.Option<string>, Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const exists = yield* Fs.exists(path).pipe(
      Effect.mapError((error: PlatformError.PlatformError) =>
        mapReadError(path, `check exists: ${error.message}`),
      ),
    )
    if (!exists) return Option.none()
    return Option.some(
      yield* Fs.readString(path).pipe(
        Effect.mapError((error: PlatformError.PlatformError) => mapReadError(path, error.message)),
      ),
    )
  })

const writeString = (
  path: Fs.Path.AbsFile,
  content: string,
): Effect.Effect<void, Resource.ResourceError, FileSystem.FileSystem> =>
  Fs.write(path, content).pipe(
    Effect.mapError((error: PlatformError.PlatformError) => mapWriteError(path, error.message)),
  )

const parseJson = (path: Fs.Path.AbsFile, content: string) =>
  Schema.decodeUnknownEffect(UnknownJsonFromString)(content).pipe(
    Effect.mapError((error) => mapParseError(path, formatSchemaIssue(error.issue))),
  )

const decodeUnknown =
  <A, I, R>(path: Fs.Path.AbsFile, schema: Schema.Codec<A, I, R>) =>
  (input: unknown) =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.mapError((error) => mapParseError(path, formatSchemaIssue(error.issue))),
    )

const encodeUnknown = <A, I, R>(
  path: Fs.Path.AbsFile,
  schema: Schema.Codec<A, I, R>,
  value: A,
  options?: SchemaAST.ParseOptions,
) =>
  Schema.encodeEffect(schema)(value, options).pipe(
    Effect.mapError((error) => mapEncodeError(path, formatSchemaIssue(error.issue))),
  )

export interface JsonFile<A, R = never> {
  readonly read: (
    path: Fs.Path.AbsFile,
  ) => Effect.Effect<Option.Option<A>, Resource.ResourceError, FileSystem.FileSystem | R>
  readonly readRequired: (
    path: Fs.Path.AbsFile,
  ) => Effect.Effect<A, Resource.ResourceError, FileSystem.FileSystem | R>
  readonly write: (
    value: A,
    path: Fs.Path.AbsFile,
  ) => Effect.Effect<void, Resource.ResourceError, FileSystem.FileSystem | R>
  readonly delete: (
    path: Fs.Path.AbsFile,
  ) => Effect.Effect<boolean, Resource.ResourceError, FileSystem.FileSystem>
}

export const jsonFile = <A, I, R = never>(
  schema: Schema.Codec<A, I, R>,
  options?: Resource.CreateOptions,
): JsonFile<A, R> => {
  const parseOptions: SchemaAST.ParseOptions | undefined = options?.preserveExcessProperties
    ? { onExcessProperty: 'preserve' }
    : undefined

  const read = (path: Fs.Path.AbsFile) =>
    Effect.gen(function* () {
      const content = yield* readStringIfExists(path)
      if (Option.isNone(content)) return Option.none()
      const parsed = yield* parseJson(path, content.value)
      return Option.some(yield* decodeUnknown(path, schema)(parsed))
    })

  const readRequired = (path: Fs.Path.AbsFile) =>
    Effect.gen(function* () {
      const result = yield* read(path)
      if (Option.isSome(result)) return result.value
      return yield* Effect.fail(new Resource.NotFoundError({ context: { path } }))
    })

  const write = (value: A, path: Fs.Path.AbsFile) =>
    Effect.gen(function* () {
      const encoded = yield* encodeUnknown(path, schema, value, parseOptions)
      yield* writeString(path, `${JSON.stringify(encoded, null, 2)}\n`)
    })

  const delete_ = (path: Fs.Path.AbsFile) =>
    Effect.gen(function* () {
      const exists = yield* Fs.exists(path).pipe(
        Effect.mapError((error: PlatformError.PlatformError) =>
          mapWriteError(path, `check exists: ${error.message}`),
        ),
      )
      if (!exists) return false
      yield* Fs.remove(path).pipe(
        Effect.mapError((error: PlatformError.PlatformError) =>
          mapWriteError(path, `delete: ${error.message}`),
        ),
      )
      return true
    })

  return { read, readRequired, write, delete: delete_ }
}

export interface JsonLinesFile<A, R = never> {
  readonly read: (
    path: Fs.Path.AbsFile,
  ) => Effect.Effect<readonly A[], Resource.ResourceError, FileSystem.FileSystem | R>
  readonly write: (
    values: readonly A[],
    path: Fs.Path.AbsFile,
  ) => Effect.Effect<void, Resource.ResourceError, FileSystem.FileSystem | R>
}

export const jsonLinesFile = <A, I, R = never>(
  schema: Schema.Codec<A, I, R>,
): JsonLinesFile<A, R> => {
  const read = (path: Fs.Path.AbsFile) =>
    Effect.gen(function* () {
      const content = yield* readStringIfExists(path)
      if (Option.isNone(content)) return []
      return yield* Effect.all(
        content.value
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) =>
            Effect.gen(function* () {
              const parsed = yield* parseJson(path, line)
              return yield* decodeUnknown(path, schema)(parsed)
            }),
          ),
      )
    })

  const write = (values: readonly A[], path: Fs.Path.AbsFile) =>
    Effect.gen(function* () {
      const encoded = yield* Effect.all(values.map((value) => encodeUnknown(path, schema, value)))
      yield* writeString(path, `${encoded.map((value) => JSON.stringify(value)).join('\n')}\n`)
    })

  return { read, write }
}
