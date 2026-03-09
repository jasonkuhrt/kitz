import { ParseResult, Schema } from 'effect'
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
 * const ConfigFromJsonc = Schema.compose(parseJsonc(), MyConfigSchema)
 *
 * // With comments preserved during parsing
 * const jsonc = '{ "name": "my-app", "port": 3000 }'
 *
 * const config = Schema.decodeUnknownSync(ConfigFromJsonc)(jsonc)
 * ```
 */
export const parseJsonc = (): Schema.Schema<unknown, string> => {
  return Schema.transformOrFail(Schema.String, Schema.Unknown, {
    strict: true,
    decode: (input, _, ast) =>
      ParseResult.try({
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
          new ParseResult.Type(
            ast,
            input,
            error instanceof Error ? error.message : 'Invalid JSONC string',
          ),
      }),
    encode: (value, _, ast) =>
      ParseResult.try({
        try: () => JSON.stringify(value, null, 2),
        catch: (error) =>
          new ParseResult.Type(
            ast,
            value,
            error instanceof Error ? error.message : 'Cannot encode to JSON string',
          ),
      }),
  }).annotations({
    schemaId: jsoncParseSchemaId,
    title: 'parseJsonc',
  })
}
