import { Effect, Option, SchemaGetter, SchemaIssue, Schema } from 'effect'
import * as JsoncParser from 'jsonc-parser'

const jsoncParseSchemaId = Symbol.for('libra/schema/ParseJsonc')

/**
 * Parse JSONC (JSON with Comments) string into unknown value.
 * This is the JSONC equivalent of Effect's built-in parseJson.
 *
 * @example
 * ```typescript
 * import { Schema } from 'effect'
 * import { parseJsonc } from './jsonc'
 *
 * const MyConfigSchema = Schema.Struct({
 *   name: Schema.String,
 *   port: Schema.Number
 * })
 *
 * // Parse JSONC string to config
 * const ConfigFromJsonc = parseJsonc().pipe(Schema.decodeTo(MyConfigSchema))
 *
 * // With comments preserved during parsing
 * const jsonc = '{ "name": "my-app", "port": 3000 }'
 *
 * const config = Schema.decodeUnknownSync(ConfigFromJsonc)(jsonc)
 * ```
 */
export const parseJsonc = (): Schema.Codec<unknown, string> => {
  return Schema.String.pipe(
    Schema.decodeTo(Schema.Unknown, {
      decode: SchemaGetter.transformOrFail((input) =>
        Effect.try({
          try: () => {
            const errors: JsoncParser.ParseError[] = []
            const result = JsoncParser.parse(input, errors, {
              allowTrailingComma: true,
              allowEmptyContent: true,
            })

            if (errors.length > 0) {
              const firstError = errors[0]!
              // Calculate line and column from offset
              const lines = input.substring(0, firstError.offset).split('\n')
              const line = lines.length
              const column = lines[lines.length - 1]?.length ?? 0

              throw new Error(
                `${JsoncParser.printParseErrorCode(firstError.error)} at line ${line}, column ${column}`,
              )
            }

            return result
          },
          catch: (error) =>
            new SchemaIssue.InvalidValue(Option.some(input), {
              message: error instanceof Error ? error.message : 'Invalid JSONC string',
            }),
        }),
      ),
      encode: SchemaGetter.transformOrFail((value) =>
        Effect.try({
          try: () => JSON.stringify(value, null, 2),
          catch: (error) =>
            new SchemaIssue.InvalidValue(Option.some(value), {
              message: error instanceof Error ? error.message : 'Cannot encode to JSON string',
            }),
        }),
      ),
    }),
  ).annotate({
    schemaId: jsoncParseSchemaId,
    title: 'parseJsonc',
  })
}
