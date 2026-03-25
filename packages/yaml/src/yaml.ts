import { Resource } from '@kitz/resource'
import { Effect, Option, Schema, SchemaIssue, SchemaTransformation } from 'effect'
import * as FileSystem from 'effect/FileSystem'
import * as YAML from 'yaml'

const yamlParseSchemaId = Symbol.for('kitz/schema/ParseYaml')

const formatYamlError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Invalid YAML value'

/**
 * Parse YAML text into unknown values and encode unknown values back to YAML text.
 *
 * This is the YAML equivalent of Effect's built-in JSON string codecs and is intended
 * to be composed with a downstream schema for exact runtime decoding.
 *
 * @example
 * ```ts
 * import { Schema } from 'effect'
 * import { Yaml } from '@kitz/yaml'
 *
 * const Config = Schema.Struct({
 *   name: Schema.String,
 *   enabled: Schema.Boolean,
 * })
 *
 * const ConfigFromYaml = Schema.compose(Yaml.parseYaml(), Config)
 *
 * const config = Schema.decodeUnknownSync(ConfigFromYaml)(`
 * name: demo
 * enabled: true
 * `)
 * ```
 */
export const parseYaml = (): Schema.Schema<unknown, string> =>
  Schema.String.pipe(
    Schema.decodeTo(
      Schema.Unknown,
      SchemaTransformation.transformOrFail({
        decode: (input) =>
          Effect.try({
            try: () => {
              const document = YAML.parseDocument(input, {
                prettyErrors: false,
              })

              if (document.errors.length > 0) {
                throw document.errors[0]
              }

              return document.toJS()
            },
            catch: (error) =>
              new SchemaIssue.InvalidValue(Option.some(input), {
                message: formatYamlError(error),
              }),
          }),
        encode: (value) =>
          Effect.try({
            try: () => YAML.stringify(value),
            catch: (error) =>
              new SchemaIssue.InvalidValue(Option.some(value), {
                message: formatYamlError(error),
              }),
        }),
      }),
    ),
    Schema.annotate({
      schemaId: yamlParseSchemaId,
      title: 'parseYaml',
    }),
  )

/**
 * Create a typed YAML file resource.
 *
 * This is a convenience wrapper around {@link Resource.create} that composes
 * {@link parseYaml} with the provided schema.
 *
 * @example
 * ```ts
 * import { Schema } from 'effect'
 * import { Yaml } from '@kitz/yaml'
 *
 * const Config = Schema.Struct({
 *   name: Schema.String,
 *   port: Schema.Number,
 * })
 *
 * const configResource = Yaml.createResource('app.yaml', Config, {
 *   name: 'demo',
 *   port: 3000,
 * })
 * ```
 */
export const createResource = <A, I, R = never>(
  filename: string,
  schema: Schema.Schema<A, I, R>,
  emptyValue: A,
  options?: Resource.CreateOptions,
): Resource.Resource<A, FileSystem.FileSystem | R> =>
  Resource.create(filename, parseYaml().pipe(Schema.decodeTo(schema)), emptyValue, options)
