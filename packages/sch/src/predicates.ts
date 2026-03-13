/**
 * Schema type predicates with branded types for type-safe AST access.
 *
 * These predicates narrow `S.Top` to specific schema categories,
 * allowing type-safe access to AST properties without manual casting.
 *
 * In Effect v4, AST has changed significantly:
 * - `TypeLiteral` → `Objects`
 * - `TupleType` → `Arrays`
 * - `Transformation` AST node is gone; encoding is stored in `encoding` property
 * - `PropertySignatureDeclaration/Transformation` are gone; optionality is in `Context`
 */
import { Schema as S } from 'effect'
import * as AST from 'effect/SchemaAST'

// ============================================================================
// Branded Schema Types
// ============================================================================

/**
 * A schema with an Objects AST (structs, records).
 */
export type ObjectsSchema = S.Top & { readonly ast: AST.Objects }

/**
 * A schema with an Arrays AST (arrays, tuples).
 */
export type ArraysSchema = S.Top & { readonly ast: AST.Arrays }

/**
 * A schema with an encoding chain (transformation).
 */
export type EncodedSchema = S.Top & { readonly ast: AST.AST & { readonly encoding: AST.Encoding } }

/**
 * A schema with a Union AST.
 */
export type UnionSchema = S.Top & { readonly ast: AST.Union }

/**
 * A Map schema (Declaration with encoding from Arrays).
 */
export type MapSchema = S.Top & {
  readonly ast: AST.Declaration
}

/**
 * A Set schema (Declaration with encoding from Arrays).
 */
export type SetSchema = S.Top & {
  readonly ast: AST.Declaration
}

/**
 * A Record schema (Objects with indexSignatures).
 */
export type RecordSchema = ObjectsSchema & {
  readonly ast: AST.Objects & {
    readonly indexSignatures: readonly [AST.IndexSignature, ...AST.IndexSignature[]]
  }
}

/**
 * A variable-length Array schema (Arrays with rest elements).
 */
export type ArraySchema = ArraysSchema & {
  readonly ast: AST.Arrays & {
    readonly rest: readonly [AST.AST, ...AST.AST[]]
  }
}

// ============================================================================
// Basic AST Predicates
// ============================================================================

/**
 * Check if a schema has an Objects AST (structs, records).
 */
export const isObjectsSchema = (schema: S.Top): schema is ObjectsSchema => AST.isObjects(schema.ast)

/**
 * Check if a schema has an Arrays AST (arrays, tuples).
 */
export const isArraysSchema = (schema: S.Top): schema is ArraysSchema => AST.isArrays(schema.ast)

/**
 * Check if a schema has an encoding chain (transformation).
 */
export const isEncodedSchema = (schema: S.Top): schema is EncodedSchema =>
  schema.ast.encoding !== undefined

/**
 * Check if a schema has a Union AST.
 */
export const isUnionSchema = (schema: S.Top): schema is UnionSchema => AST.isUnion(schema.ast)

// ============================================================================
// Collection Predicates
// ============================================================================

/**
 * Check if schema is a collection type (Map or Set) by description prefix.
 * Internal helper for isMapSchema and isSetSchema.
 *
 * In v4, Map/Set schemas are Declarations with encoding chains.
 * The description annotation identifies them.
 */
const isCollectionByPrefix = (
  schema: S.Top,
  prefix: 'Map<' | 'Set<' | 'HashMap<' | 'HashSet<',
): boolean => {
  if (!AST.isDeclaration(schema.ast)) return false
  const description = AST.resolveDescription(schema.ast)
  return description !== undefined && description.startsWith(prefix)
}

/**
 * Check if schema is an S.Map schema.
 *
 * Detection: Declaration with "Map<" description prefix.
 */
export const isMapSchema = (schema: S.Top): schema is MapSchema =>
  isCollectionByPrefix(schema, 'Map<')

/**
 * Check if schema is an S.Set schema.
 *
 * Detection: Declaration with "Set<" description prefix.
 */
export const isSetSchema = (schema: S.Top): schema is SetSchema =>
  isCollectionByPrefix(schema, 'Set<')

/**
 * Check if schema is an S.HashMap schema.
 */
export const isHashMapSchema = (schema: S.Top): boolean => isCollectionByPrefix(schema, 'HashMap<')

/**
 * Check if schema is an S.HashSet schema.
 */
export const isHashSetSchema = (schema: S.Top): boolean => isCollectionByPrefix(schema, 'HashSet<')

/**
 * Check if schema is an S.Record schema.
 *
 * Detection: Objects with indexSignatures and no propertySignatures.
 */
export const isRecordSchema = (schema: S.Top): schema is RecordSchema => {
  if (!AST.isObjects(schema.ast)) return false
  return schema.ast.indexSignatures.length > 0 && schema.ast.propertySignatures.length === 0
}

// ============================================================================
// Struct/Array Predicates
// ============================================================================

/**
 * Check if a schema has direct `.fields` property (original Struct schema).
 */
export const hasDirectFields = (schema: S.Top): schema is S.Struct<S.Struct.Fields> =>
  'fields' in schema && typeof schema.fields === 'object' && schema.fields !== null

/**
 * Check if a schema is a Struct.
 *
 * Detects both:
 * - Direct Schema.Struct (has `.fields` property)
 * - Schema with Objects AST
 */
export const isStructSchema = (schema: S.Top): schema is ObjectsSchema =>
  hasDirectFields(schema) || AST.isObjects(schema.ast)

/**
 * Check if schema is a variable-length array (Arrays with rest element).
 */
export const isArraySchema = (schema: S.Top): schema is ArraySchema =>
  AST.isArrays(schema.ast) && schema.ast.rest.length > 0

/**
 * Check if schema is a fixed-length tuple (Arrays without rest element).
 */
export const isTupleOnlySchema = (schema: S.Top): schema is ArraysSchema =>
  AST.isArrays(schema.ast) && schema.ast.rest.length === 0

/**
 * Check if schema is a tuple (Arrays AST).
 */
export const isTupleSchema = (schema: S.Top): schema is ArraysSchema => AST.isArrays(schema.ast)

// ============================================================================
// Transform Predicates
// ============================================================================

/**
 * Check if schema has an encoding transformation.
 *
 * In v4, transformations are stored in `encoding` property on AST nodes.
 * This replaces the old `isTransformation` check.
 */
export const hasEncodingTransform = (schema: S.Top): boolean => schema.ast.encoding !== undefined

/**
 * Check if schema is a non-hashable user-defined transform.
 *
 * In v4, this means a schema whose AST has an encoding chain
 * where the final encoded form is an Objects or Arrays node,
 * and the schema is NOT a Declaration (which would be Data/Class/Map/Set).
 *
 * Excludes:
 * - S.Class: Declaration
 * - S.Map/S.Set: Declaration
 * - S.HashMap/S.HashSet: Declaration
 */
export const isNonHashableTransform = (schema: S.Top): schema is EncodedSchema => {
  const ast = schema.ast
  if (ast.encoding === undefined) return false
  if (AST.isDeclaration(ast)) return false
  // The encoded form is the other end of the encoding chain
  const encodedAST = AST.toEncoded(ast)
  return AST.isObjects(encodedAST) || AST.isArrays(encodedAST)
}

// ============================================================================
// PropertySignature Predicates (v4)
// ============================================================================

/**
 * Check if a struct field value represents an optional key.
 *
 * In v4, optionality is determined by the AST's context property.
 */
export const isOptionalField = (field: S.Top): boolean => AST.isOptional(field.ast)

/**
 * Check if a struct field is a PropertySignature wrapper (like optionalKey, optional, etc).
 *
 * In v4, there's no separate PropertySignature type. Fields are just schemas
 * with context metadata. We check for the presence of optionality context.
 */
export const isPropertySignature = (field: unknown): boolean => {
  if (typeof field !== 'object' || field === null) return false
  if (!('ast' in field)) return false
  const ast = (field as S.Top).ast
  return ast.context !== undefined && ast.context.isOptional
}

/**
 * Check if a PropertySignature AST is a simple Declaration (no transformation).
 *
 * In v4, there's no PropertySignatureDeclaration. Optionality is in Context.
 * A "simple" optional field has no encoding chain.
 */
export const isPropertySignatureDeclaration = (ast: AST.AST): boolean =>
  ast.context?.isOptional === true && ast.encoding === undefined

/**
 * Detect if an optional field has a nullable option.
 *
 * In v4, nullable creates a Union that includes null/undefined.
 */
export const hasNullableOption = (ast: AST.AST): boolean => {
  if (!AST.isUnion(ast)) return false
  return ast.types.some((t) => AST.isNull(t))
}

// ============================================================================
// Getters (type-safe with narrowed schemas)
// ============================================================================

/**
 * Extract element schema from an Array schema.
 */
export const getArrayElement = (schema: ArraySchema): S.Top => {
  const restElement = schema.ast.rest[0]
  // In v4, rest elements are just AST nodes directly
  return { ast: restElement } as unknown as S.Top
}

/**
 * Extract key and value schemas from a Record schema.
 */
export const getRecordKeyValue = (schema: RecordSchema): { key: S.Top; value: S.Top } => {
  const indexSig = schema.ast.indexSignatures[0]
  return {
    key: { ast: indexSig.parameter } as unknown as S.Top,
    value: { ast: indexSig.type } as unknown as S.Top,
  }
}

/**
 * Extract key and value schemas from a Map schema.
 *
 * In v4, Map schemas are Declarations. The type parameters hold
 * the key and value schemas.
 */
export const getMapKeyValue = (schema: MapSchema): { key: S.Top; value: S.Top } => {
  const typeParams = schema.ast.typeParameters
  return {
    key: { ast: typeParams[0] } as unknown as S.Top,
    value: { ast: typeParams[1] } as unknown as S.Top,
  }
}

/**
 * Extract element schema from a Set schema.
 *
 * In v4, Set schemas are Declarations. The type parameter holds
 * the element schema.
 */
export const getSetElement = (schema: SetSchema): S.Top => {
  const typeParams = schema.ast.typeParameters
  return { ast: typeParams[0] } as unknown as S.Top
}

/**
 * Extract from/to schemas and transformation functions from a schema with encoding.
 *
 * In v4, the encoding chain holds Link objects with `to` and `transformation`.
 */
export const getTransformParts = (
  schema: EncodedSchema,
): {
  from: S.Top
  to: S.Top
  transformation: {
    decode: (input: unknown, options: unknown, ast: unknown) => unknown
    encode: (input: unknown, options: unknown, ast: unknown) => unknown
  }
} => {
  const encoding = schema.ast.encoding
  const link = encoding[0]
  return {
    from: { ast: link.to } as unknown as S.Top,
    to: { ast: schema.ast } as unknown as S.Top,
    transformation: link.transformation as any,
  }
}
