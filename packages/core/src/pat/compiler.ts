import { Arr } from '#arr'
import { Num } from '#num'
import { Rec } from '#rec'
import { Str } from '#str'
import * as S from 'effect/Schema'
import type * as SchemaAST from 'effect/SchemaAST'

/**
 * Schemas built by toSchema are always service-free (no DecodingServices required).
 * This type narrows S.Top to satisfy S.is/S.decodeSync which require DecodingServices: never.
 */
type ServiceFreeSchema = S.Top & { readonly DecodingServices: never }

/**
 * Constraint object for strings.
 *
 * Supports length and format constraints.
 */
export type StringConstraint = {
  /** String length (exact or constraint object) */
  $length?: number | NumberConstraint
  /** Regex pattern the string must match */
  $format?: RegExp
}

/**
 * Constraint object for numbers.
 *
 * Supports comparison operators.
 */
export type NumberConstraint = {
  /** Greater than */
  $gt?: number
  /** Greater than or equal */
  $gte?: number
  /** Less than */
  $lt?: number
  /** Less than or equal */
  $lte?: number
  /** Equal to */
  $eq?: number
}

/**
 * Array constraint object.
 *
 * Supports element matching and length constraints.
 */
export type ArrayConstraint = {
  /** At least one element matches */
  $some?: unknown
  /** All elements match */
  $every?: unknown
  /** Array length (exact or constraint object) */
  $length?: number | NumberConstraint
}

/**
 * Universal combinators that work with any pattern.
 */
export type Combinator = {
  /** Negation - value must NOT match pattern */
  $not?: unknown
  /** Union - value matches ANY of the patterns */
  $or?: unknown[]
  /** Intersection - value matches ALL of the patterns */
  $and?: unknown[]
}

/**
 * Check if value is a string constraint object.
 */
const isStringConstraint = (value: unknown): value is StringConstraint => {
  if (!Rec.is(value)) return false
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((k) => k === '$length' || k === '$format')
}

/**
 * Check if value is a number constraint object.
 */
const isNumberConstraint = (value: unknown): value is NumberConstraint => {
  if (!Rec.is(value)) return false
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((k) => ['$gt', '$gte', '$lt', '$lte', '$eq'].includes(k))
}

/**
 * Check if value is an array constraint object.
 */
const isArrayConstraint = (value: unknown): value is ArrayConstraint => {
  if (!Rec.is(value)) return false
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((k) => k === '$some' || k === '$every' || k === '$length')
}

/**
 * Check if value is a combinator object.
 */
const isCombinator = (value: unknown): value is Combinator => {
  if (!Rec.is(value)) return false
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((k) => k === '$not' || k === '$or' || k === '$and')
}

/**
 * Compile a number constraint object to an Effect Schema.
 */
const compileNumberConstraint = (constraint: NumberConstraint): S.Top => {
  if (constraint.$eq !== undefined) {
    return S.Literal(constraint.$eq)
  }

  let schema = S.Number

  if (constraint.$gt !== undefined) {
    schema = schema.check(S.isGreaterThan(constraint.$gt))
  }
  if (constraint.$gte !== undefined) {
    schema = schema.check(S.isGreaterThanOrEqualTo(constraint.$gte))
  }
  if (constraint.$lt !== undefined) {
    schema = schema.check(S.isLessThan(constraint.$lt))
  }
  if (constraint.$lte !== undefined) {
    schema = schema.check(S.isLessThanOrEqualTo(constraint.$lte))
  }

  return schema
}

/**
 * Compile a string constraint object to an Effect Schema.
 */
const compileStringConstraint = (constraint: StringConstraint): S.Top => {
  let schema = S.String

  if (constraint.$length !== undefined) {
    if (Num.is(constraint.$length)) {
      schema = schema.check(S.isMinLength(constraint.$length))
    } else {
      // Nested number constraint
      const numConstraint = constraint.$length
      if (numConstraint.$gte !== undefined) {
        schema = schema.check(S.isMinLength(numConstraint.$gte))
      }
      if (numConstraint.$gt !== undefined) {
        schema = schema.check(S.isMinLength(numConstraint.$gt + 1))
      }
      if (numConstraint.$lte !== undefined) {
        schema = schema.check(S.isMaxLength(numConstraint.$lte))
      }
      if (numConstraint.$lt !== undefined) {
        schema = schema.check(S.isMaxLength(numConstraint.$lt - 1))
      }
      if (numConstraint.$eq !== undefined) {
        schema = schema.check(S.isMinLength(numConstraint.$eq))
      }
    }
  }

  if (constraint.$format !== undefined) {
    schema = schema.check(S.isPattern(constraint.$format))
  }

  return schema
}

/**
 * Compile an array constraint object to an Effect Schema.
 */
const compileArrayConstraint = (constraint: ArrayConstraint): S.Top => {
  // Build base array schema — $every changes element type
  const base =
    constraint.$every !== undefined ? S.Array(toSchema(constraint.$every)) : S.Array(S.Unknown)

  // Collect all checks to apply to the base schema.
  // All checks work on { readonly length: number } or readonly unknown[],
  // both of which are compatible with the array's Type.
  const checks: Array<SchemaAST.Check<readonly unknown[]>> = []

  // Handle '$some' - at least one element must match
  if (constraint.$some !== undefined) {
    const elementSchema = toSchema(constraint.$some) as ServiceFreeSchema
    checks.push(
      S.makeFilter(
        (arr: readonly unknown[]) =>
          arr.some((el) => S.is(elementSchema)(el)) ||
          `Array must have at least one element matching the pattern`,
      ),
    )
  }

  // Handle length constraint
  if (constraint.$length !== undefined) {
    if (Num.is(constraint.$length)) {
      checks.push(S.isMinLength(constraint.$length), S.isMaxLength(constraint.$length))
    } else {
      const numConstraint = constraint.$length
      if (numConstraint.$gte !== undefined) {
        checks.push(S.isMinLength(numConstraint.$gte))
      }
      if (numConstraint.$gt !== undefined) {
        checks.push(S.isMinLength(numConstraint.$gt + 1))
      }
      if (numConstraint.$lte !== undefined) {
        checks.push(S.isMaxLength(numConstraint.$lte))
      }
      if (numConstraint.$lt !== undefined) {
        checks.push(S.isMaxLength(numConstraint.$lt - 1))
      }
      if (numConstraint.$eq !== undefined) {
        checks.push(S.isMinLength(numConstraint.$eq), S.isMaxLength(numConstraint.$eq))
      }
    }
  }

  if (checks.length > 0) {
    const [first, ...rest] = checks
    return base.check(first!, ...rest)
  }
  return base
}

/**
 * Compile a combinator object to an Effect Schema.
 */
const compileCombinator = (combinator: Combinator): S.Top => {
  // Handle '$not'
  if (combinator.$not !== undefined) {
    const innerSchema = toSchema(combinator.$not) as ServiceFreeSchema
    return S.Unknown.check(
      S.makeFilter(
        (value) => !S.is(innerSchema)(value) || `Value must not match the negated pattern`,
      ),
    )
  }

  // Handle '$or' (union)
  if (combinator.$or !== undefined && Arr.is(combinator.$or)) {
    const schemas = combinator.$or.map(toSchema)
    return S.Union(schemas)
  }

  // Handle '$and' (intersection)
  if (combinator.$and !== undefined && Arr.is(combinator.$and)) {
    const schemas = combinator.$and.map(toSchema) as ServiceFreeSchema[]
    // Validate against all schemas using a filter
    return S.Unknown.check(
      S.makeFilter(
        (value) => schemas.every((s) => S.is(s)(value)) || `Value must match all patterns in $and`,
      ),
    )
  }

  return S.Unknown
}

/**
 * Compile a pattern to an Effect Schema.
 *
 * Converts various pattern types to executable Effect Schemas:
 * - Literals → `S.Literal(value)`
 * - Regex → `S.String.check(S.isPattern(regex))`
 * - Schemas → pass through
 * - Constraint objects → compiled to schema pipelines
 * - Combinators → compiled to schema combinators
 * - Objects → `S.Struct({ ... }).pipe(S.lenient)`
 * - Arrays → array constraint schemas
 *
 * @param pattern - The pattern to compile
 * @returns An Effect Schema that validates the pattern
 */
export const toSchema = (pattern: unknown): S.Top => {
  // Already a schema - pass through
  if (S.isSchema(pattern)) {
    return pattern
  }

  // Regex → String with pattern
  if (pattern instanceof RegExp) {
    return S.String.check(S.isPattern(pattern))
  }

  // Null literal
  if (pattern === null) {
    return S.Null
  }

  // Primitive literals
  if (
    Str.is(pattern) ||
    Num.is(pattern) ||
    typeof pattern === 'boolean' ||
    typeof pattern === 'bigint'
  ) {
    return S.Literal(pattern)
  }

  // Ambiguous { $length: ... } - could be string OR array constraint
  // Create a union that matches both interpretations
  if (Rec.is(pattern)) {
    const keys = Object.keys(pattern)
    if (keys.length === 1 && keys[0] === '$length') {
      const lengthValue = pattern['$length'] as number | NumberConstraint
      // Generate schemas for both string and array interpretations
      const stringSchema: S.Top = Num.is(lengthValue)
        ? S.String.check(S.isMinLength(lengthValue))
        : compileStringConstraint({ $length: lengthValue })
      const arraySchema: S.Top = Num.is(lengthValue)
        ? S.Array(S.Unknown).check(S.isMinLength(lengthValue), S.isMaxLength(lengthValue))
        : compileArrayConstraint({ $length: lengthValue })
      return S.Union([stringSchema, arraySchema])
    }
  }

  // Constraint objects
  if (isNumberConstraint(pattern)) {
    return compileNumberConstraint(pattern)
  }

  if (isStringConstraint(pattern)) {
    return compileStringConstraint(pattern)
  }

  if (isArrayConstraint(pattern)) {
    return compileArrayConstraint(pattern)
  }

  // Combinators
  if (isCombinator(pattern)) {
    return compileCombinator(pattern)
  }

  // Arrays - check if it's an array value (not a constraint object)
  if (Arr.is(pattern)) {
    // Array literal means tuple matching
    const schemas = pattern.map(toSchema)
    return S.Tuple(schemas)
  }

  // Objects - partial struct matching
  if (Rec.is(pattern)) {
    // All operators now have $ prefix, so we can treat everything as data fields
    const fields: Record<string, S.Top> = {}
    for (const [key, value] of Object.entries(pattern)) {
      fields[key] = toSchema(value)
    }
    return S.Struct(fields)
  }

  // Fallback - accept anything
  return S.Unknown
}
