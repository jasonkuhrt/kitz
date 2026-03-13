import { Fn, Fn as _, Ts } from '@kitz/core'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Schema, SchemaAST, SchemaGetter } from 'effect'
import { createExtension } from '../../extension.js'
import type { Optionality, SchemaType } from '../../schema/oak-schema.js'
import { Term } from '../../term.js'

export type SupportedType = Schema.Top

/**
 * Effect Schema guard that rejects Schema.NullOr patterns.
 * CLI users cannot pass literal null values - they can only omit parameters.
 * Use Schema.UndefinedOr instead for optional parameters.
 */
export interface EffectSchemaGuard extends Fn.Kind.Kind {
  // @ts-expect-error - Intentional HKT pattern
  return: this['parameters'][0] extends Schema.NullOr<any>
    ? Ts.Err.StaticError<
        ['schema', 'nullor-not-supported'],
        {
          message: 'Schema.NullOr() is not supported in CLI parameters. Use Schema.UndefinedOr() instead, as CLI users can only omit parameters (undefined), not pass literal null.'
        }
      >
    : never // Valid schema - return never so ApplyGuard passes through original
}

export const EffectSchema = createExtension<SupportedType, EffectSchemaGuard>({
  name: `EffectSchema`,

  // Guard that rejects Schema.NullOr at compile-time
  guard: undefined as any,
  type: undefined as any,

  toStandardSchema: (schema: unknown): StandardSchemaV1<any, any> => {
    const effectSchema = schema as Schema.Codec<any, any>

    // Check if this is Schema.Option - if so, wrap it to accept plain values
    // For CLI purposes, we want to accept T | undefined instead of { _tag: "None" } | { _tag: "Some", value: T }
    if (isOptionSchema(effectSchema.ast)) {
      // Extract the inner type from the Option's "Some" branch
      // In v4, use SchemaAST.toEncoded to get the encoded form (Union of None | Some)
      const encodedAst = SchemaAST.toEncoded(effectSchema.ast)
      const fromUnion = encodedAst as SchemaAST.Union
      const someType = fromUnion.types.find((t) => {
        if (t._tag !== `Objects`) return false
        const typeLiteral = t
        const tagProp = typeLiteral.propertySignatures.find((p) => p.name === `_tag`)
        if (!tagProp) return false
        const tagType = tagProp.type
        if (tagType._tag !== `Literal`) return false
        return tagType.literal === `Some`
      })

      if (someType && someType._tag === `Objects`) {
        const valueProp = someType.propertySignatures.find((p) => p.name === `value`)
        if (valueProp) {
          // Build inner schema from AST and wrap it to handle Option encoding
          const innerSchema = buildSchemaFromAST(valueProp.type)
          const wrappedSchema = Schema.UndefinedOr(innerSchema).pipe(
            Schema.decodeTo(effectSchema as any, {
              decode: SchemaGetter.transform((value: any) =>
                value === undefined ? { _tag: `None` as const } : { _tag: `Some` as const, value },
              ),
              encode: SchemaGetter.transform((optionValue: any) =>
                optionValue._tag === `None` ? undefined : optionValue.value,
              ),
            }),
          )
          return Schema.toStandardSchemaV1(wrappedSchema as any)
        }
      }
    }

    // Effect Schema provides standardSchemaV1() to convert to Standard Schema V1
    return Schema.toStandardSchemaV1(effectSchema)
  },

  extractMetadata: (schema: unknown) => {
    const effectSchema = schema as Schema.Top
    const { description, optionality, schemaType, helpHints } =
      extractEffectSchemaMetadata(effectSchema)

    return {
      description,
      optionality,
      schema: schemaType,
      helpHints,
    }
  },
})

/**
 * Extract metadata from an Effect Schema for CLI help generation.
 */
const extractEffectSchemaMetadata = (
  effectSchema: Schema.Top,
  previous?: { description?: string | undefined; optionality?: Optionality<any> },
): {
  description?: string | undefined
  optionality: Optionality<any>
  schemaType: SchemaType
  helpHints?: any
} => {
  const ast = effectSchema.ast

  // Extract description from annotations
  const description = previous?.description ?? SchemaAST.resolveDescription(ast)

  // Detect optionality by analyzing the AST structure
  let optionality: Optionality<any>
  let unwrappedAst = ast

  if (previous?.optionality) {
    optionality = previous.optionality
  } else if (isOptionSchema(ast)) {
    // Schema.Option(T) - optional, returns Option.none() when omitted
    optionality = { _tag: `optional`, omittedValue: undefined }
    // Extract the underlying type from the Option transformation
    // The 'to' side of the transformation is the Option<T> type
    // We want to extract T from inside the Option
    // In v4, transformations are in the encoding chain. Extract the encoded AST
    // for the Option schema to find the "Some" branch with its value type.
    const encodedAst = SchemaAST.toEncoded(ast)
    const typeAst = SchemaAST.toType(ast)
    // The encoded side is a Union of { _tag: "None" } | { _tag: "Some", value: T }
    if (encodedAst._tag === `Union`) {
      const someType = encodedAst.types.find((t) => {
        if (t._tag !== `Objects`) return false
        const tagProp = t.propertySignatures.find((p) => p.name === `_tag`)
        if (!tagProp) return false
        const tagType = tagProp.type
        if (tagType._tag !== `Literal`) return false
        return tagType.literal === `Some`
      })
      if (someType && someType._tag === `Objects`) {
        const valueProp = someType.propertySignatures.find((p) => p.name === `value`)
        if (valueProp) {
          unwrappedAst = valueProp.type
        } else {
          unwrappedAst = typeAst // fallback
        }
      } else {
        unwrappedAst = typeAst // fallback
      }
    } else {
      unwrappedAst = typeAst // fallback
    }
  } else if (ast.encoding !== undefined) {
    // This AST has an encoding transformation chain
    // Check if the encoded form is a Union with undefined (indicates default pattern)
    const encodedAst = SchemaAST.toEncoded(ast)
    if (encodedAst._tag === `Union` && hasUndefinedMember(encodedAst as SchemaAST.Union)) {
      // This is a default value pattern (e.g., decodeTo with UndefinedOr)
      optionality = { _tag: `default`, getValue: () => undefined }
      unwrappedAst = SchemaAST.toType(ast)
    } else {
      optionality = { _tag: `required` }
      unwrappedAst = SchemaAST.toType(ast)
    }
  } else if (ast._tag === `Union`) {
    const unionAst = ast as SchemaAST.Union
    const hasUndefined = hasUndefinedMember(unionAst)
    const hasNull = hasNullMember(unionAst)

    if (hasUndefined || hasNull) {
      // Schema.UndefinedOr(T), Schema.NullOr(T), or Schema.NullishOr(T)
      // Determine what value to return when the parameter is omitted
      const omittedValue =
        hasUndefined && !hasNull
          ? undefined // UndefinedOr - return undefined
          : !hasUndefined && hasNull
            ? null // NullOr - return null
            : undefined // NullishOr (both) - return undefined by convention
      optionality = { _tag: `optional`, omittedValue }
      // Remove both undefined and null members to get the underlying type
      unwrappedAst = removeNullishFromUnion(unionAst)
    } else {
      optionality = { _tag: `required` }
    }
  } else {
    optionality = { _tag: `required` }
  }

  // Extract schema type and help hints from unwrapped AST
  const { schemaType, refinements, displayType, priority } = extractSchemaTypeInfo(unwrappedAst)

  return {
    description,
    optionality,
    schemaType,
    helpHints: {
      displayType,
      refinements: refinements.length > 0 ? refinements : undefined,
      priority,
    },
  }
}

/**
 * Extract schema type information from an AST node.
 */
const extractSchemaTypeInfo = (
  ast: SchemaAST.AST,
): { schemaType: SchemaType; refinements: string[]; displayType: string; priority: number } => {
  // Handle transformations by recursing into the type AST
  if (ast.encoding !== undefined) {
    return extractSchemaTypeInfo(SchemaAST.toType(ast))
  }

  // Handle basic types (with possible checks/refinements)
  const baseResult = extractBaseTypeInfo(ast)
  if (baseResult) {
    // If the AST has checks, extract refinement info from them
    if (ast.checks) {
      const refinements = extractChecksInfo(ast)
      return { ...baseResult, refinements }
    }
    return baseResult
  }

  if (ast._tag === `Union`) {
    return extractUnionInfo(ast as SchemaAST.Union)
  }

  // Fallback for unknown types
  return {
    schemaType: { _tag: `string` },
    refinements: [],
    displayType: Term.colors.secondary(`unknown`),
    priority: 0,
  }
}

/**
 * Extract base type info from an AST node (without refinements).
 */
const extractBaseTypeInfo = (
  ast: SchemaAST.AST,
): {
  schemaType: SchemaType
  refinements: string[]
  displayType: string
  priority: number
} | null => {
  if (ast._tag === `String`) {
    return {
      schemaType: { _tag: `string` },
      refinements: [],
      displayType: Term.colors.secondary(`string`),
      priority: 1,
    }
  }

  if (ast._tag === `Number`) {
    return {
      schemaType: { _tag: `number` },
      refinements: [],
      displayType: Term.colors.secondary(`number`),
      priority: 2,
    }
  }

  if (ast._tag === `Boolean`) {
    return {
      schemaType: { _tag: `boolean` },
      refinements: [],
      displayType: Term.colors.secondary(`boolean`),
      priority: 3,
    }
  }

  if (ast._tag === `Literal`) {
    const value = ast.literal
    return {
      schemaType: { _tag: `literal`, value },
      refinements: [],
      displayType: Term.colors.secondary(typeof value === `string` ? `'${value}'` : String(value)),
      priority: 5,
    }
  }

  return null
}

/**
 * Extract refinement descriptions from AST checks.
 */
const extractChecksInfo = (ast: SchemaAST.AST): string[] => {
  if (!ast.checks) return []
  const refinements: string[] = []
  for (const check of ast.checks) {
    const desc = SchemaAST.resolveDescription(ast)
    if (desc) {
      refinements.push(desc)
      break // Just use the overall description
    }
  }
  return refinements
}

/**
 * Extract information from a Union AST node.
 */
const extractUnionInfo = (
  ast: SchemaAST.Union,
): { schemaType: SchemaType; refinements: string[]; displayType: string; priority: number } => {
  // Check if all members are literals (enum-like)
  const allLiterals = ast.types.every((t) => t._tag === `Literal`)

  if (allLiterals) {
    const values = ast.types.map((t) => (t as SchemaAST.Literal).literal)
    const displayType = values
      .map((v) => Term.colors.secondary(typeof v === `string` ? `'${v}'` : String(v)))
      .join(Term.colors.dim(` | `))

    return {
      schemaType: { _tag: `enum`, values },
      refinements: [],
      displayType,
      priority: 4,
    }
  }

  // Mixed union - extract each member (already colored from recursive calls)
  const memberInfos = ast.types.map(extractSchemaTypeInfo)
  const displayType = memberInfos.map((m) => m.displayType).join(Term.colors.dim(` | `))

  return {
    schemaType: { _tag: `union`, members: memberInfos.map((m) => m.schemaType) },
    refinements: [],
    displayType,
    priority: 0,
  }
}

/**
 * Build a Schema from an AST node.
 * This handles basic types and delegates to Schema.make for complex types.
 */
const buildSchemaFromAST = (ast: SchemaAST.AST): Schema.Top => {
  // Handle basic keyword types
  switch (ast._tag) {
    case `String`:
      return Schema.String
    case `Number`:
      return Schema.Number
    case `Boolean`:
      return Schema.Boolean
    case `Literal`:
      // For literals, we need to use Schema.Literal with the actual value
      const literalValue = ast.literal
      return Schema.Literal(literalValue)
    default:
      // For complex types, use Schema.make to construct from AST
      return Schema.make(ast)
  }
}

/**
 * Check if this is a Schema.Option transformation.
 * Schema.Option creates a transformation from { _tag: "None" } | { _tag: "Some", value: T }
 */
const isOptionSchema = (ast: SchemaAST.AST): boolean => {
  // In v4, Option schemas have an encoding chain. Check the encoded form.
  if (!ast.encoding) return false

  const encodedAst = SchemaAST.toEncoded(ast)

  // Check if the encoded side is a Union with { _tag: "None" } | { _tag: "Some", value: T }
  if (encodedAst._tag === `Union`) {
    const union = encodedAst as SchemaAST.Union
    const hasNoneAndSome = union.types.some((t) => {
      if (t._tag !== `Objects`) return false
      return t.propertySignatures.some((p) => {
        if (p.name !== `_tag`) return false
        const type = p.type
        if (type._tag !== `Literal`) return false
        const literal = type.literal
        return literal === `None` || literal === `Some`
      })
    })
    return hasNoneAndSome
  }

  return false
}

/**
 * Check if a Union contains an UndefinedKeyword member.
 */
const hasUndefinedMember = (ast: SchemaAST.Union): boolean => {
  return ast.types.some((t) => t._tag === `Undefined`)
}

/**
 * Check if a Union contains a null Literal member.
 * In Effect Schema, null is represented as Literal with literal: null
 */
const hasNullMember = (ast: SchemaAST.Union): boolean => {
  return ast.types.some((t) => t._tag === `Literal` && t.literal === null)
}

/**
 * Remove Undefined and null Literal from a Union and return the remaining type.
 * Handles Schema.UndefinedOr, Schema.NullOr, and Schema.NullishOr patterns.
 */
const removeNullishFromUnion = (ast: SchemaAST.Union): SchemaAST.AST => {
  const nonNullishTypes = ast.types.filter(
    (t) => t._tag !== `Undefined` && !(t._tag === `Literal` && t.literal === null),
  )

  // If no types remain (shouldn't happen), return the original
  if (nonNullishTypes.length === 0) {
    return ast
  }

  // If only one type remains, return it directly
  if (nonNullishTypes.length === 1) {
    return nonNullishTypes[0]!
  }

  // Otherwise, return a new union without undefined/null
  return new SchemaAST.Union(nonNullishTypes, ast.mode, ast.annotations)
}
