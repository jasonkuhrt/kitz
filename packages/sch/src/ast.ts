import { Obj } from '@kitz/core'
import { Schema as S } from 'effect'
import type * as EAST from 'effect/SchemaAST'
import { isLiteral, isObjects, isSuspend, isUnion } from 'effect/SchemaAST'

/**
 * Resolves an AST node to its underlying type, handling encoding chains and suspensions.
 *
 * In v4, Transformation nodes are gone. Encoding is stored in `encoding` property.
 * To get the "from" (encoded) side, follow the encoding chain.
 *
 * @param ast - The AST node to resolve
 * @returns The resolved AST node
 */
export const resolve = (ast: EAST.AST): EAST.AST => {
  if (ast.encoding !== undefined) {
    // Follow the encoding chain to get the encoded (from) form
    return resolve(ast.encoding[ast.encoding.length - 1]!.to)
  }
  if (isSuspend(ast)) {
    return resolve(ast.thunk())
  }
  return ast
}

/**
 * Extract the tag value from an Objects AST with _tag field.
 */
export const extractTag = (ast: EAST.Objects): string | null => {
  const tagProp = ast.propertySignatures.find((p) => p.name === '_tag' && isLiteral(p.type))

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
 * - Objects (standard structs)
 * - Schemas with encoding (which might wrap a struct)
 * - Suspend types (lazy schema references)
 *
 * @param schema - The struct schema to extract from
 * @param fieldName - The name of the field to extract
 * @returns The field's schema, or undefined if not found
 */
export const getFieldSchema = (schema: S.Top, fieldName: string): S.Top | undefined => {
  const ast = schema.ast

  // Handle Objects (structs)
  if (isObjects(ast)) {
    const prop = ast.propertySignatures.find((p) => p.name === fieldName)
    if (prop) {
      const fieldAst = resolve(prop.type)
      return { ast: fieldAst } as unknown as S.Top
    }
  }

  // Handle schemas with encoding (might wrap a struct)
  if (ast.encoding !== undefined) {
    const encodedAST = ast.encoding[ast.encoding.length - 1]!.to
    return getFieldSchema({ ast: encodedAST } as unknown as S.Top, fieldName)
  }

  return undefined
}

/**
 * Extracts all property keys from an Objects (struct).
 *
 * @param ast - The Objects AST node
 * @returns Array of property names as strings
 */
export const extractPropertyKeys = (ast: EAST.Objects): string[] => {
  return ast.propertySignatures
    .map((p) => p.name as string)
    .filter((name) => typeof name === 'string')
}

/**
 * Gets a property signature from an Objects by name.
 *
 * @param ast - The Objects AST node
 * @param propertyName - The name of the property to find
 * @returns The property signature, or undefined if not found
 */
export const getPropertySignature = (
  ast: EAST.Objects,
  propertyName: string | symbol,
): EAST.PropertySignature | undefined => {
  return ast.propertySignatures.find((p) => p.name === propertyName)
}

/**
 * Checks if a property exists in an Objects.
 *
 * @param ast - The Objects AST node
 * @param propertyName - The name of the property to check
 * @returns True if the property exists, false otherwise
 */
export const hasProperty = (ast: EAST.Objects, propertyName: string | symbol): boolean => {
  return getPropertySignature(ast, propertyName) !== undefined
}

/**
 * Extracts the type AST of a specific property from an Objects.
 * Automatically resolves Suspend types.
 *
 * @param ast - The Objects AST node
 * @param propertyName - The name of the property
 * @returns The property's type AST, or undefined if not found
 */
export const getResolvedPropertyType = (
  ast: EAST.Objects,
  propertyName: string | symbol,
): EAST.AST | undefined => {
  const prop = getPropertySignature(ast, propertyName)
  if (!prop) return undefined
  return resolve(prop.type)
}

/**
 * Collect all tagged members from a union AST into a map keyed by tag.
 */
export const collectTaggedMembers = (ast: EAST.Union): Map<string, EAST.Objects> => {
  const membersByTag = new Map<string, EAST.Objects>()

  for (const member of ast.types) {
    if (isObjects(member)) {
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
    if (isObjects(member)) {
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
 * Returns the original schema unchanged if annotations are undefined or empty,
 * avoiding unnecessary wrapping.
 */
export const copyAnnotations = (
  schema: S.Top,
  annotations: S.Annotations.Annotations | undefined,
): S.Top => {
  if (annotations === undefined) return schema
  if (Obj.isEmpty(annotations)) return schema
  return schema.annotate(annotations as any)
}
