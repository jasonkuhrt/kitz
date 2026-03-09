/**
 * Schema type predicates with branded types for type-safe AST access.
 *
 * These predicates narrow `S.Schema.Any` to specific schema categories,
 * allowing type-safe access to AST properties without manual casting.
 */
import { Option, Schema as S } from 'effect'
import {
  PropertySignatureDeclaration,
  PropertySignatureTransformation,
  PropertySignatureTypeId,
} from 'effect/Schema'
import * as AST from 'effect/SchemaAST'

// ============================================================================
// Branded Schema Types
// ============================================================================

/**
 * A schema with a TypeLiteral AST (structs, records).
 */
export type TypeLiteralSchema = S.Schema.Any & { readonly ast: AST.TypeLiteral }

/**
 * A schema with a TupleType AST (arrays, tuples).
 */
export type TupleSchema = S.Schema.Any & { readonly ast: AST.TupleType }

/**
 * A schema with a Transformation AST.
 */
export type TransformSchema = S.Schema.Any & { readonly ast: AST.Transformation }

/**
 * A schema with a Union AST.
 */
export type UnionSchema = S.Schema.Any & { readonly ast: AST.Union }

/**
 * A Map schema (Transformation with specific structure).
 */
export type MapSchema = TransformSchema & {
  readonly ast: AST.Transformation & {
    readonly from: AST.TupleType
    readonly to: AST.Declaration
  }
}

/**
 * A Set schema (Transformation with specific structure).
 */
export type SetSchema = TransformSchema & {
  readonly ast: AST.Transformation & {
    readonly from: AST.TupleType
    readonly to: AST.Declaration
  }
}

/**
 * A Record schema (TypeLiteral with indexSignatures).
 */
export type RecordSchema = TypeLiteralSchema & {
  readonly ast: AST.TypeLiteral & {
    readonly indexSignatures: readonly [AST.IndexSignature, ...AST.IndexSignature[]]
  }
}

/**
 * A variable-length Array schema (TupleType with rest elements).
 */
export type ArraySchema = TupleSchema & {
  readonly ast: AST.TupleType & {
    readonly rest: readonly [AST.Type, ...AST.Type[]]
  }
}

// ============================================================================
// Basic AST Predicates
// ============================================================================

/**
 * Check if a schema has a TypeLiteral AST (structs, records).
 */
export const isTypeLiteralSchema = (schema: S.Schema.Any): schema is TypeLiteralSchema =>
  AST.isTypeLiteral(schema.ast)

/**
 * Check if a schema has a TupleType AST (arrays, tuples).
 */
export const isTupleSchema = (schema: S.Schema.Any): schema is TupleSchema =>
  AST.isTupleType(schema.ast)

/**
 * Check if a schema has a Transformation AST.
 */
export const isTransformSchema = (schema: S.Schema.Any): schema is TransformSchema =>
  AST.isTransformation(schema.ast)

/**
 * Check if a schema has a Union AST.
 */
export const isUnionSchema = (schema: S.Schema.Any): schema is UnionSchema =>
  AST.isUnion(schema.ast)

// ============================================================================
// Collection Predicates
// ============================================================================

/**
 * Check if schema is a collection type (Map or Set) by description prefix.
 * Internal helper for isMapSchema and isSetSchema.
 */
const isCollectionByPrefix = (schema: S.Schema.Any, prefix: 'Map<' | 'Set<'): boolean => {
  if (!AST.isTransformation(schema.ast)) return false
  if (!AST.isDeclaration(schema.ast.to)) return false

  const description = AST.getDescriptionAnnotation(schema.ast.to)
  return Option.isSome(description) && description.value.startsWith(prefix)
}

/**
 * Check if schema is an S.Map schema.
 *
 * Detection: Transformation → Declaration with "Map<" description prefix.
 */
export const isMapSchema = (schema: S.Schema.Any): schema is MapSchema =>
  isCollectionByPrefix(schema, 'Map<')

/**
 * Check if schema is an S.Set schema.
 *
 * Detection: Transformation → Declaration with "Set<" description prefix.
 */
export const isSetSchema = (schema: S.Schema.Any): schema is SetSchema =>
  isCollectionByPrefix(schema, 'Set<')

/**
 * Check if schema is an S.Record schema.
 *
 * Detection: TypeLiteral with indexSignatures and no propertySignatures.
 */
export const isRecordSchema = (schema: S.Schema.Any): schema is RecordSchema => {
  if (!AST.isTypeLiteral(schema.ast)) return false
  return schema.ast.indexSignatures.length > 0 && schema.ast.propertySignatures.length === 0
}

// ============================================================================
// Struct/Array Predicates
// ============================================================================

/**
 * Check if a schema has direct `.fields` property (original Struct schema).
 */
export const hasDirectFields = (schema: S.Schema.Any): schema is S.Struct<S.Struct.Fields> =>
  'fields' in schema && typeof schema.fields === 'object' && schema.fields !== null

/**
 * Check if a schema is a Struct.
 *
 * Detects both:
 * - Direct Schema.Struct (has `.fields` property)
 * - Schema from S.make() with TypeLiteral AST
 */
export const isStructSchema = (schema: S.Schema.Any): schema is TypeLiteralSchema =>
  hasDirectFields(schema) || AST.isTypeLiteral(schema.ast)

/**
 * Check if schema is a variable-length array (TupleType with rest element).
 */
export const isArraySchema = (schema: S.Schema.Any): schema is ArraySchema =>
  AST.isTupleType(schema.ast) && schema.ast.rest.length > 0

/**
 * Check if schema is a fixed-length tuple (TupleType without rest element).
 */
export const isTupleOnlySchema = (schema: S.Schema.Any): schema is TupleSchema =>
  AST.isTupleType(schema.ast) && schema.ast.rest.length === 0

// ============================================================================
// Transform Predicates
// ============================================================================

/**
 * Check if schema is a non-hashable user-defined transform.
 *
 * Key distinction:
 * - User transforms (S.transform): use FinalTransformation
 * - Internal transforms (optionalWith, struct with defaults): use TypeLiteralTransformation
 *
 * Excludes:
 * - S.Data: `to` is a Declaration
 * - S.Class: `to` is a Declaration with identifier
 * - S.Map/S.Set: already handled by specific checks
 */
export const isNonHashableTransform = (schema: S.Schema.Any): schema is TransformSchema => {
  if (!AST.isTransformation(schema.ast)) return false
  if (!AST.isFinalTransformation(schema.ast.transformation)) return false
  if (AST.isDeclaration(schema.ast.to)) return false
  return AST.isTypeLiteral(schema.ast.to) || AST.isTupleType(schema.ast.to)
}

// ============================================================================
// PropertySignature Predicates
// ============================================================================

/**
 * Check if a struct field is a PropertySignature (S.optional, S.optionalWith, etc.).
 *
 * PropertySignatures wrap schemas with additional metadata like optionality,
 * default values, and transformations between encoded/decoded forms.
 */
export const isPropertySignature = (field: unknown): field is S.PropertySignature.All =>
  typeof field === 'object' && field !== null && PropertySignatureTypeId in field

/**
 * Check if a PropertySignature AST is a simple Declaration (no transformation).
 *
 * Declaration: Simple optional with no default/transformation (S.optional)
 * Transformation: Has encode/decode logic (S.optionalWith, withDefault, etc.)
 */
export const isPropertySignatureDeclaration = (
  ast: S.PropertySignature.AST,
): ast is PropertySignatureDeclaration => ast._tag === 'PropertySignatureDeclaration'

/**
 * Check if a PropertySignature AST is a Transformation (has encode/decode).
 */
export const isPropertySignatureTransformation = (
  ast: S.PropertySignature.AST,
): ast is PropertySignatureTransformation => ast._tag === 'PropertySignatureTransformation'

/**
 * Detect if a PropertySignatureTransformation has nullable option.
 *
 * Nullable creates a Union in `from.type` that includes a null Literal.
 * This is how `S.optionalWith(schema, { nullable: true })` is represented in the AST.
 */
export const hasNullableOption = (trans: PropertySignatureTransformation): boolean => {
  const fromType = trans.from.type
  if (!AST.isUnion(fromType)) return false
  return fromType.types.some((t) => AST.isLiteral(t) && t.literal === null)
}

// ============================================================================
// Getters (type-safe with narrowed schemas)
// ============================================================================

/**
 * Extract element schema from an Array schema.
 */
export const getArrayElement = (schema: ArraySchema): S.Schema.Any => {
  const restElement = schema.ast.rest[0]
  return S.make(restElement.type)
}

/**
 * Extract key and value schemas from a Record schema.
 */
export const getRecordKeyValue = (
  schema: RecordSchema,
): { key: S.Schema.Any; value: S.Schema.Any } => {
  const indexSig = schema.ast.indexSignatures[0]
  return {
    key: S.make(indexSig.parameter),
    value: S.make(indexSig.type),
  }
}

/**
 * Extract key and value schemas from a Map schema.
 */
export const getMapKeyValue = (schema: MapSchema): { key: S.Schema.Any; value: S.Schema.Any } => {
  const fromAST = schema.ast.from
  // S.Map structure: Array<[Key, Value]> - rest[0] is the [Key, Value] tuple
  const tupleElement = fromAST.rest[0]!.type as AST.TupleType
  return {
    key: S.make(tupleElement.elements[0]!.type),
    value: S.make(tupleElement.elements[1]!.type),
  }
}

/**
 * Extract element schema from a Set schema.
 */
export const getSetElement = (schema: SetSchema): S.Schema.Any => {
  const fromAST = schema.ast.from
  // S.Set structure: Array<Element> - rest[0] is the element type
  return S.make(fromAST.rest[0]!.type)
}

/**
 * Extract from/to schemas and transformation functions from a transform schema.
 */
export const getTransformParts = (
  schema: TransformSchema,
): {
  from: S.Schema.Any
  to: S.Schema.Any
  transformation: {
    decode: (input: unknown, options: unknown, ast: unknown) => unknown
    encode: (input: unknown, options: unknown, ast: unknown) => unknown
  }
} => ({
  from: S.make(schema.ast.from),
  to: S.make(schema.ast.to),
  transformation: schema.ast.transformation as any,
})
