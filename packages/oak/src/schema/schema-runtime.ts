import { Result as Ef, Option, Schema as S } from 'effect'
import type { OakSchema } from './oak-schema.js'
import { isFailure, isSuccess, validateWithStandardSchema } from './standard-schema.js'

const decodeJsonUnknown = S.decodeUnknownOption(S.fromJsonString(S.Unknown))

const parseJsonOrString = (value: string): unknown =>
  decodeJsonUnknown(value).pipe(Option.getOrElse((): unknown => value))

/**
 * Validate a value using a OakSchema.
 *
 * Returns Result.Success on success or Result.Failure with validation errors.
 *
 * Note: Assumes synchronous validation. Oak only uses synchronous schemas (via Zod).
 */
export const validate = <___Input, ___Output>(
  schema: OakSchema<___Input, ___Output>,
  value: unknown,
): Ef.Result<___Output | undefined, { value: unknown; errors: string[] }> => {
  const result = validateWithStandardSchema(schema.standardSchema, value)

  if (result instanceof Promise) {
    return Ef.fail({ value, errors: [`Oak only supports synchronous schemas`] })
  }

  if (isSuccess(result)) {
    return Ef.succeed(result.value)
  }

  if (isFailure(result)) {
    const errors = result.issues?.map((issue) => issue.message ?? `Validation failed`) ?? [
      `Validation failed`,
    ]
    return Ef.fail({ value, errors })
  }

  return Ef.fail({ value, errors: [`Unknown validation error`] })
}

/**
 * Deserialize a string value into the schema's type.
 *
 * Uses structured schema metadata to determine how to parse the string value.
 */
export const deserialize = <___Input, ___Output>(
  schema: OakSchema<___Input, ___Output>,
  serializedValue: string,
): Ef.Result<___Output, Error> => {
  let parsedValue: unknown

  // Use structured schema metadata for deserialization
  switch (schema.metadata.schema._tag) {
    case `string`:
      parsedValue = serializedValue
      break

    case `boolean`: {
      const lower = serializedValue.toLowerCase()
      if (lower === `true` || lower === `1` || lower === `yes`) parsedValue = true
      else if (lower === `false` || lower === `0` || lower === `no`) parsedValue = false
      else parsedValue = serializedValue
      break
    }

    case `number`: {
      const num = Number(serializedValue)
      parsedValue = Number.isNaN(num) ? serializedValue : num
      break
    }

    case `literal`:
      // For literals, try to match the expected value type
      parsedValue = serializedValue
      break

    case `enum`: {
      // For enums, try to coerce to the correct type
      // Check if enum values are numbers
      if (schema.metadata.schema._tag === `enum` && schema.metadata.schema.values.length > 0) {
        const firstValue = schema.metadata.schema.values[0]
        if (typeof firstValue === `number`) {
          const num = Number(serializedValue)
          parsedValue = Number.isNaN(num) ? serializedValue : num
          break
        }
      }
      parsedValue = serializedValue
      break
    }

    case `union`:
      // For unions, try JSON parse, fall back to string
      parsedValue = parseJsonOrString(serializedValue)
      break

    default:
      // Fallback: try JSON parse, fall back to string
      parsedValue = parseJsonOrString(serializedValue)
  }

  // Validate the parsed value
  const result = validateWithStandardSchema(schema.standardSchema, parsedValue)

  if (result instanceof Promise) {
    return Ef.fail(new Error(`Oak only supports synchronous schemas`))
  }

  if (isSuccess(result)) {
    return Ef.succeed(result.value)
  }

  if (isFailure(result)) {
    const errors =
      result.issues?.map((issue) => issue.message ?? `Validation failed`).join(`, `) ??
      `Validation failed`
    return Ef.fail(new Error(`Deserialization failed: ${errors}`))
  }

  return Ef.fail(new Error(`Unknown deserialization error`))
}

/**
 * Get the display type string for help output.
 */
export const display = <___Input, ___Output>(schema: OakSchema<___Input, ___Output>): string => {
  return schema.metadata.helpHints?.displayType ?? `unknown`
}

/**
 * Get the expanded display type string for help output.
 */
export const displayExpanded = <___Input, ___Output>(
  schema: OakSchema<___Input, ___Output>,
): string => {
  return schema.metadata.helpHints?.displayTypeExpanded ?? display(schema)
}

/**
 * Get the schema tag (for backwards compatibility).
 *
 * Uses structured schema metadata instead of parsing display strings.
 */
export const getTag = <___Input, ___Output>(schema: OakSchema<___Input, ___Output>): string => {
  switch (schema.metadata.schema._tag) {
    case `boolean`:
      return `TypeBoolean`
    case `number`:
      return `TypeNumber`
    case `string`:
      return `TypeString`
    case `union`:
      return `TypeUnion`
    case `enum`:
    case `literal`:
      return `TypeScalar`
    default:
      return `TypeScalar`
  }
}

/**
 * Generate help text for a schema (used in CLI help output).
 *
 * Returns formatted text showing type, description, and refinements.
 */
export const help = <___Input, ___Output>(
  schema: OakSchema<___Input, ___Output>,
  _settings?: unknown,
): string => {
  const parts: string[] = []

  // Add display type (coloring baked in by schema extension)
  parts.push(displayExpanded(schema))

  // Add description if present
  if (schema.metadata.description) {
    parts.push(`\n${schema.metadata.description}`)
  }

  // Add refinements if present
  if (schema.metadata.helpHints?.refinements && schema.metadata.helpHints.refinements.length > 0) {
    parts.push(`\n• ${schema.metadata.helpHints.refinements.join(`\n• `)}`)
  }

  return parts.join(``)
}
