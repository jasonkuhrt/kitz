import { Obj } from '@kitz/core'
import { Schema as S } from 'effect'
import type * as EAST from 'effect/SchemaAST'
import { isLiteral, isSuspend, isTransformation, isTypeLiteral } from 'effect/SchemaAST'

/**
 * Resolves an AST node to its underlying type, handling transformations and suspensions.
 *
 * @param ast - The AST node to resolve
 * @returns The resolved AST node
 */
export const resolve = (ast: EAST.AST): EAST.AST => {
  if (isTransformation(ast)) {
    return resolve(ast.from)
  }
  if (isSuspend(ast)) {
    return resolve(ast.f())
  }
  return ast
}

/**
 * Extract the tag value from a TypeLiteral AST with _tag field.
 */
export const extractTag = (ast: EAST.TypeLiteral): string | null => {
  const tagProp = ast.propertySignatures.find((p: any) => p.name === '_tag' && isLiteral(p.type))

  if (!tagProp || !isLiteral(tagProp.type)) {
    return null
  }

  const literal = (tagProp.type as any).literal
  return typeof literal === 'string' ? literal : null
}

/**
 * Extracts the schema for a specific field from a struct schema.
 *
 * Handles:
 * - TypeLiteral (standard structs)
 * - Transformation (which might wrap a struct)
 * - Suspend types (lazy schema references)
 *
 * @param schema - The struct schema to extract from
 * @param fieldName - The name of the field to extract
 * @returns The field's schema, or undefined if not found
 */
export const getFieldSchema = (
  schema: S.Schema<any, any, any>,
  fieldName: string,
): S.Schema<any, any> | undefined => {
  const ast = schema.ast

  // Handle TypeLiteral (structs)
  if (isTypeLiteral(ast)) {
    const prop = ast.propertySignatures.find((p: any) => p.name === fieldName)
    if (prop) {
      const fieldAst = resolve(prop.type)
      return S.make(fieldAst)
    }
  }

  // Handle Transformation (might wrap a struct)
  if (isTransformation(ast)) {
    return getFieldSchema(S.make(ast.from), fieldName)
  }

  return undefined
}

/**
 * Extracts all property keys from a TypeLiteral (struct).
 *
 * @param ast - The TypeLiteral AST node
 * @returns Array of property names as strings
 */
export const extractPropertyKeys = (ast: EAST.TypeLiteral): string[] => {
  return ast.propertySignatures
    .map((p) => p.name as string)
    .filter((name) => typeof name === 'string')
}

/**
 * Gets a property signature from a TypeLiteral by name.
 *
 * @param ast - The TypeLiteral AST node
 * @param propertyName - The name of the property to find
 * @returns The property signature, or undefined if not found
 */
export const getPropertySignature = (
  ast: EAST.TypeLiteral,
  propertyName: string | symbol,
): EAST.PropertySignature | undefined => {
  return ast.propertySignatures.find((p) => p.name === propertyName)
}

/**
 * Checks if a property exists in a TypeLiteral.
 *
 * @param ast - The TypeLiteral AST node
 * @param propertyName - The name of the property to check
 * @returns True if the property exists, false otherwise
 */
export const hasProperty = (ast: EAST.TypeLiteral, propertyName: string | symbol): boolean => {
  return getPropertySignature(ast, propertyName) !== undefined
}

/**
 * Extracts the type AST of a specific property from a TypeLiteral.
 * Automatically resolves Suspend types.
 *
 * @param ast - The TypeLiteral AST node
 * @param propertyName - The name of the property
 * @returns The property's type AST, or undefined if not found
 */
export const getResolvedPropertyType = (
  ast: EAST.TypeLiteral,
  propertyName: string | symbol,
): EAST.AST | undefined => {
  const prop = getPropertySignature(ast, propertyName)
  if (!prop) return undefined
  return resolve(prop.type)
}

/**
 * Collect all tagged members from a union AST into a map keyed by tag.
 */
export const collectTaggedMembers = (ast: EAST.Union): Map<string, EAST.TypeLiteral> => {
  const membersByTag = new Map<string, EAST.TypeLiteral>()

  for (const member of ast.types) {
    if (isTypeLiteral(member)) {
      const tag = extractTag(member)
      if (tag) {
        membersByTag.set(tag, member)
      }
    }
  }

  return membersByTag
}

/**
 * Extracts all tags from a union.
 */
export const extractTagsFromUnion = (ast: EAST.Union): string[] => {
  const tags: string[] = []

  for (const member of ast.types) {
    if (isTypeLiteral(member)) {
      const tag = extractTag(member)
      if (tag) {
        tags.push(tag)
      }
    }
  }

  return tags
}

/**
 * Copy annotations from source AST to target schema if any exist.
 *
 * Returns the original schema unchanged if annotations object is empty,
 * avoiding unnecessary wrapping.
 */
export const copyAnnotations = (
  schema: S.Schema.Any,
  annotations: EAST.Annotations,
): S.Schema.Any => (Obj.isEmpty(annotations) ? schema : schema.annotations(annotations as any))
