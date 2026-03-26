import { Fn, Fn as _, Ts } from '@kitz/core'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Option, Schema, SchemaAST, SchemaGetter } from 'effect'
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

    const optionInnerAst = getOptionInnerAst(effectSchema.ast)

    // Plain Schema.Option(T) expects Option values at runtime.
    // For CLI parameters we want to accept T | undefined and decode to Option<T>.
    if (optionInnerAst && effectSchema.ast.encoding === undefined) {
      const innerSchema = buildSchemaFromAST(optionInnerAst)
      const wrappedSchema = Schema.UndefinedOr(innerSchema).pipe(
        Schema.decodeTo(effectSchema as any, {
          decode: SchemaGetter.transform((value: any) =>
            value === undefined ? Option.none() : Option.some(value),
          ),
          encode: SchemaGetter.transform((optionValue: any) =>
            Option.isNone(optionValue) ? undefined : optionValue.value,
          ),
        }),
      )

      return Schema.toStandardSchemaV1(wrappedSchema as any)
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
  const annotatedDefault = getAnnotatedDefault(ast)
  const optionInnerAst = getOptionInnerAst(ast)

  // Extract description from annotations
  const description = previous?.description ?? SchemaAST.resolveDescription(ast)

  // Detect optionality by analyzing the AST structure
  let optionality: Optionality<any>
  let unwrappedAst = ast

  if (previous?.optionality) {
    optionality = previous.optionality
  } else if (optionInnerAst) {
    optionality = { _tag: `default`, getValue: () => Option.none() }
    unwrappedAst = optionInnerAst
  } else if (ast.encoding !== undefined) {
    // This AST has an encoding transformation chain
    const encodedUnion = getEncodedUnion(ast)
    unwrappedAst = SchemaAST.toType(ast)

    if (annotatedDefault.hasDefault) {
      optionality = { _tag: `default`, getValue: () => annotatedDefault.value }
    } else if (encodedUnion && (hasUndefinedMember(encodedUnion) || hasNullMember(encodedUnion))) {
      // This is a transformed default pattern (e.g., decodeTo with UndefinedOr)
      optionality = { _tag: `default`, getValue: () => undefined }
    } else {
      optionality = { _tag: `required` }
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

  if (ast._tag === `Null`) {
    return {
      schemaType: { _tag: `literal`, value: null },
      refinements: [],
      displayType: Term.colors.secondary(`null`),
      priority: 5,
    }
  }

  if (ast._tag === `Undefined`) {
    return {
      schemaType: { _tag: `literal`, value: undefined },
      refinements: [],
      displayType: Term.colors.secondary(`undefined`),
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
    const values = ast.types.map((t) => t.literal)
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
    case `Null`:
      return Schema.Null
    case `Undefined`:
      return Schema.Undefined
    default:
      // For complex types, use Schema.make to construct from AST
      return Schema.make(ast)
  }
}

/**
 * In Effect v4, Option schemas are Declarations annotated with the effect/Option type constructor.
 */
const isOptionSchema = (ast: SchemaAST.AST): boolean => {
  if (ast._tag !== `Declaration`) return false

  const typeConstructor = ast.annotations?.['typeConstructor'] as
    | { readonly _tag?: unknown }
    | undefined
  return typeConstructor?._tag === `effect/Option`
}

/**
 * Check if a Union contains an UndefinedKeyword member.
 */
const hasUndefinedMember = (ast: SchemaAST.Union): boolean => {
  return ast.types.some((t) => t._tag === `Undefined`)
}

/**
 * Check if a Union contains a null member.
 */
const hasNullMember = (ast: SchemaAST.Union): boolean => {
  return ast.types.some((t) => t._tag === `Null` || (t._tag === `Literal` && t.literal === null))
}

/**
 * Remove Undefined and null Literal from a Union and return the remaining type.
 * Handles Schema.UndefinedOr, Schema.NullOr, and Schema.NullishOr patterns.
 */
const removeNullishFromUnion = (ast: SchemaAST.Union): SchemaAST.AST => {
  const nonNullishTypes = ast.types.filter(
    (t) =>
      t._tag !== `Undefined` && t._tag !== `Null` && !(t._tag === `Literal` && t.literal === null),
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

const getOptionInnerAst = (ast: SchemaAST.AST): SchemaAST.AST | null => {
  if (!isOptionSchema(ast)) return null
  const declaration = ast as SchemaAST.Declaration & {
    readonly typeParameters?: readonly SchemaAST.AST[]
  }
  return declaration.typeParameters?.[0] ?? null
}

const getEncodedUnion = (ast: SchemaAST.AST): SchemaAST.Union | null => {
  if (ast.encoding === undefined) return null
  const encodedAst = SchemaAST.toEncoded(ast)
  return encodedAst._tag === `Union` ? encodedAst : null
}

const getAnnotatedDefault = (
  ast: SchemaAST.AST,
): { readonly hasDefault: boolean; readonly value: unknown } => {
  if (!ast.annotations || !Object.prototype.hasOwnProperty.call(ast.annotations, `default`)) {
    return { hasDefault: false, value: undefined }
  }

  return {
    hasDefault: true,
    value: (ast.annotations as { readonly default: unknown }).default,
  }
}

/** @internal */
export const EffectSchemaInternals = {
  extractEffectSchemaMetadata,
  extractSchemaTypeInfo,
  extractBaseTypeInfo,
  extractChecksInfo,
  extractUnionInfo,
  buildSchemaFromAST,
  isOptionSchema,
  hasUndefinedMember,
  hasNullMember,
  removeNullishFromUnion,
  getOptionInnerAst,
  getEncodedUnion,
  getAnnotatedDefault,
} as const
