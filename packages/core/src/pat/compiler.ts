import { Arr } from '#arr'
import { Num } from '#num'
import { Rec } from '#rec'
import { Str } from '#str'
import * as S from 'effect/Schema'

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
  let schema: any = S.Number

  if (constraint.$gt !== undefined) {
    schema = schema.pipe(S.check(S.isGreaterThan(constraint.$gt) as any))
  }
  if (constraint.$gte !== undefined) {
    schema = schema.pipe(S.check(S.isGreaterThanOrEqualTo(constraint.$gte) as any))
  }
  if (constraint.$lt !== undefined) {
    schema = schema.pipe(S.check(S.isLessThan(constraint.$lt) as any))
  }
  if (constraint.$lte !== undefined) {
    schema = schema.pipe(S.check(S.isLessThanOrEqualTo(constraint.$lte) as any))
  }
  if (constraint.$eq !== undefined) {
    schema = S.Literal(constraint.$eq)
  }

  return schema
}

/**
 * Compile a string constraint object to an Effect Schema.
 */
const compileStringConstraint = (constraint: StringConstraint): S.Top => {
  let schema: any = S.String

  if (constraint.$length !== undefined) {
    if (Num.is(constraint.$length)) {
      schema = schema.pipe(S.check(S.isMinLength(constraint.$length) as any))
    } else {
      // Nested number constraint
      const numConstraint = constraint.$length
      if (numConstraint.$gte !== undefined) {
        schema = schema.pipe(S.check(S.isMinLength(numConstraint.$gte) as any))
      }
      if (numConstraint.$gt !== undefined) {
        schema = schema.pipe(S.check(S.isMinLength(numConstraint.$gt + 1) as any))
      }
      if (numConstraint.$lte !== undefined) {
        schema = schema.pipe(S.check(S.isMaxLength(numConstraint.$lte) as any))
      }
      if (numConstraint.$lt !== undefined) {
        schema = schema.pipe(S.check(S.isMaxLength(numConstraint.$lt - 1) as any))
      }
      if (numConstraint.$eq !== undefined) {
        schema = schema.pipe(S.check(S.isMinLength(numConstraint.$eq) as any))
      }
    }
  }

  if (constraint.$format !== undefined) {
    schema = schema.pipe(S.check(S.isPattern(constraint.$format) as any))
  }

  return schema
}

/**
 * Compile an array constraint object to an Effect Schema.
 */
const compileArrayConstraint = (constraint: ArrayConstraint): S.Top => {
  let schema: any = S.Array(S.Unknown)

  // Handle '$every' - all elements must match
  if (constraint.$every !== undefined) {
    const elementSchema = toSchema(constraint.$every)
    schema = S.Array(elementSchema)
  }

  // Handle '$some' - at least one element must match
  if (constraint.$some !== undefined) {
    const elementSchema = toSchema(constraint.$some)
    schema = schema.pipe(
      S.check(
        S.makeFilter(
          (arr: unknown[]) =>
            arr.some((el) => S.is(elementSchema as any)(el)) ||
            `Array must have at least one element matching the pattern`,
        ) as any,
      ),
    )
  }

  // Handle length constraint
  if (constraint.$length !== undefined) {
    if (Num.is(constraint.$length)) {
      schema = schema.pipe(
        S.check(S.isMinLength(constraint.$length) as any, S.isMaxLength(constraint.$length) as any),
      )
    } else {
      const numConstraint = constraint.$length
      if (numConstraint.$gte !== undefined) {
        schema = schema.pipe(S.check(S.isMinLength(numConstraint.$gte) as any))
      }
      if (numConstraint.$gt !== undefined) {
        schema = schema.pipe(S.check(S.isMinLength(numConstraint.$gt + 1) as any))
      }
      if (numConstraint.$lte !== undefined) {
        schema = schema.pipe(S.check(S.isMaxLength(numConstraint.$lte) as any))
      }
      if (numConstraint.$lt !== undefined) {
        schema = schema.pipe(S.check(S.isMaxLength(numConstraint.$lt - 1) as any))
      }
      if (numConstraint.$eq !== undefined) {
        schema = schema.pipe(
          S.check(S.isMinLength(numConstraint.$eq) as any, S.isMaxLength(numConstraint.$eq) as any),
        )
      }
    }
  }

  return schema
}

/**
 * Compile a combinator object to an Effect Schema.
 */
const compileCombinator = (combinator: Combinator): S.Top => {
  // Handle '$not'
  if (combinator.$not !== undefined) {
    const innerSchema = toSchema(combinator.$not)
    return S.Unknown.pipe(
      S.check(
        S.makeFilter(
          (value) => !S.is(innerSchema as any)(value) || `Value must not match the negated pattern`,
        ) as any,
      ),
    ) as any
  }

  // Handle '$or' (union)
  if (combinator.$or !== undefined && Arr.is(combinator.$or)) {
    const schemas = combinator.$or.map(toSchema)
    return S.Union(schemas)
  }

  // Handle '$and' (intersection)
  if (combinator.$and !== undefined && Arr.is(combinator.$and)) {
    const schemas = combinator.$and.map(toSchema)
    // Validate against all schemas using a filter
    return S.Unknown.pipe(
      S.check(
        S.makeFilter((value) => schemas.every((schema) => S.is(schema as any)(value)), {
          message: `Value must match all patterns in $and`,
        }) as any,
      ),
    ) as any
  }

  return S.Unknown
}

/**
 * Compile a pattern to an Effect Schema.
 *
 * Converts various pattern types to executable Effect Schemas:
 * - Literals → `S.Literal(value)`
 * - Regex → `S.String.pipe(S.check(S.isPattern(regex) as any))`
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
    return S.String.pipe(S.check(S.isPattern(pattern) as any))
  }

  // Primitive literals
  if (
    Str.is(pattern) ||
    Num.is(pattern) ||
    typeof pattern === 'boolean' ||
    typeof pattern === 'bigint' ||
    pattern === null
  ) {
    return S.Literal(pattern as any)
  }

  // Ambiguous { $length: ... } - could be string OR array constraint
  // Create a union that matches both interpretations
  if (Rec.is(pattern)) {
    const keys = Object.keys(pattern)
    if (keys.length === 1 && keys[0] === '$length') {
      const lengthValue = (pattern as any).$length
      // Generate schemas for both string and array interpretations
      const stringSchema = Num.is(lengthValue)
        ? S.String.pipe(S.check(S.isMinLength(lengthValue) as any))
        : compileStringConstraint({ $length: lengthValue })
      const arraySchema = Num.is(lengthValue)
        ? S.Array(S.Unknown).pipe(
            S.check(S.isMinLength(lengthValue) as any, S.isMaxLength(lengthValue) as any),
          )
        : compileArrayConstraint({ $length: lengthValue })
      return S.Union([stringSchema, arraySchema]) as any
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
