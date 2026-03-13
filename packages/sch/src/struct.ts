import { Schema as S } from 'effect'
import * as EAST from 'effect/SchemaAST'
import { isLiteral, isObjects } from 'effect/SchemaAST'
import * as AST from './ast.js'

/**
 * The standard tag property name for tagged structs.
 */
export const tagPropertyName = '_tag'

export type TagPropertyName = typeof tagPropertyName

export type TaggedStruct = { [_ in TagPropertyName]: string }

/**
 * Check if a value is a tagged struct.
 */
export const isTagged = (value: unknown): value is TaggedStruct => {
  return typeof value === 'object' && value !== null && tagPropertyName in value
}

/**
 * Delete all properties from an object except the tag property.
 * Mutates the object in place.
 */
export const clearExceptTag = (obj: TaggedStruct): void => {
  for (const prop in obj) {
    if (prop !== tagPropertyName) {
      delete (obj as any)[prop]
    }
  }
}

/**
 * Extract specific fields from a struct schema.
 * Type-safe at input/output but implementation can cheat.
 */
export const extractFields = <
  $Fields extends S.Struct.Fields,
  $Keys extends ReadonlyArray<keyof $Fields>,
>(
  schema: S.Struct<$Fields> | S.TaggedStruct<any, $Fields>,
  keys: $Keys,
): Pick<$Fields, $Keys[number]> => {
  const result = Object.fromEntries(keys.map((key) => [key, schema.fields[key]]))

  return result as Pick<$Fields, $Keys[number]>
}

// Type utilities
export type AnyStruct = S.Struct<any>

export type ExtractFields<$Struct extends S.Struct<any>> =
  $Struct extends S.Struct<infer __fields__> ? __fields__ : never

// Literal field utilities

export type Constructor<$Schema extends AnyStruct, $InputFields> = (
  fields: $InputFields,
) => $Schema['Type']

export type ConstructorUsingOmitLiteral1Algo<$Schema extends AnyStruct> = (
  fields: ConstructorFieldsUsingOmitLiteral1Algo<$Schema>,
) => $Schema['Type']

export const pickLiteral1FieldsAsLiterals = <schema extends AnyStruct>(
  schema: schema,
): { [k in keyof PickLiteral1Fields<schema>]: PickLiteral1Fields<schema>[k]['Type'] } => {
  const picked = {}
  const ast = schema.ast
  if (isObjects(ast)) {
    ast.propertySignatures.forEach((prop) => {
      if (isLiteral(prop.type) && prop.name !== '_tag') {
        // @ts-expect-error - Extract the literal value, not the schema
        picked[prop.name] = prop.type.literal
      }
    })
  }
  return picked as any
}

export const pickLiteral1Fields = <schema extends AnyStruct>(
  schema: schema,
): PickLiteral1Fields<schema> => {
  const picked = {}
  const ast = schema.ast
  if (isObjects(ast)) {
    ast.propertySignatures.forEach((prop) => {
      if (isLiteral(prop.type)) {
        // @ts-expect-error
        picked[prop.name] = schema.fields[prop.name]
      }
    })
  }
  return picked as any
}

export type PickLiteral1Fields<$Schema extends AnyStruct> = {
  [k in keyof ExtractFields<$Schema>]: ExtractFields<$Schema>[k] extends S.Literal<
    infer __literal__ extends string
  >
    ? ExtractFields<$Schema>[k]
    : never
}

export type OmitLiteral1Fields<$Schema extends AnyStruct> = {
  [k in keyof ExtractFields<$Schema>]: ExtractFields<$Schema>[k] extends S.Literal<
    infer __literal__ extends string
  >
    ? never
    : ExtractFields<$Schema>[k]
}

export type GetLiteral1FieldsNames<$Schema extends AnyStruct> = keyof PickLiteral1Fields<$Schema>

export type ConstructorFieldsUsingOmitLiteral1Algo<$Schema extends AnyStruct> =
  $Schema extends S.Struct<infer __fields__>
    ? S.Struct.MakeIn<Omit<__fields__, GetLiteral1FieldsNames<$Schema>>>
    : never

/**
 * Extract the literal value from a specific field in a schema.
 * Returns the exact literal type, not any.
 */
export const getValueAtField = <$Schema extends S.Top, $FieldName extends string>(
  schema: $Schema,
  fieldName: $FieldName,
): GetFieldLiteralType<$Schema, $FieldName> => {
  const ast = schema.ast

  // Resolve any transformations to get to the struct
  // In v4, transformations are in encoding chain, resolve through toEncoded
  let resolved = AST.resolve(ast)
  if (ast.encoding !== undefined) {
    const encoded = EAST.toEncoded(ast)
    resolved = AST.resolve(encoded)
  }

  // Find the field with the given name
  if (isObjects(resolved)) {
    const field = resolved.propertySignatures.find((prop) => prop.name === fieldName)
    if (field && isLiteral(field.type)) {
      return field.type.literal as GetFieldLiteralType<$Schema, $FieldName>
    }
  }

  throw new Error(`Field "${fieldName}" is not a literal or not found`)
}

/**
 * Extract the type of a literal field from a schema.
 */
export type GetFieldLiteralType<$Schema extends S.Top, $FieldName extends string> =
  $Schema extends S.TaggedStruct<any, infer $Fields>
    ? $FieldName extends keyof $Fields
      ? $Fields[$FieldName] extends S.Literal<infer $Value>
        ? $Value
        : never
      : never
    : never

// ============================================================================
// Required Fields Detection
// ============================================================================

/**
 * Get the underlying Objects AST from a schema, handling encoding chains.
 *
 * In v4, Schema.Class schemas have encoding chains. The encoded form
 * (the input shape) is obtained via toEncoded. For config loading,
 * we care about the encoded side (what user provides in file).
 */
const getObjectsAst = (ast: EAST.AST): EAST.Objects | null => {
  if (isObjects(ast)) {
    return ast
  }
  // If there's an encoding chain, check the encoded form
  if (ast.encoding !== undefined) {
    const encoded = EAST.toEncoded(ast)
    if (isObjects(encoded)) {
      return encoded
    }
  }
  return null
}

/**
 * Check if a struct schema has any required fields on the encoded (input) side.
 *
 * A field is considered required if:
 * - It has `isOptional === false` on the property signature
 *
 * This means the user must provide a value for it when decoding.
 * Fields with defaults (via `optionalWith({ default: ... })`) have `isOptional === true`
 * on the encoded side and are therefore not required.
 *
 * @example
 * ```ts
 * // Has required fields (apiKey is required)
 * const Config1 = S.Struct({ apiKey: S.String })
 * hasRequiredFields(Config1) // true
 *
 * // No required fields (all optional with defaults)
 * const Config2 = S.Struct({
 *   port: S.optional(S.Number, { default: () => 3000 })
 * })
 * hasRequiredFields(Config2) // false
 *
 * // Works with Schema.Class too
 * class Config3 extends S.Class<Config3>('Config3')({
 *   apiKey: S.String,
 * }) {}
 * hasRequiredFields(Config3) // true
 * ```
 */
export const hasRequiredFields = (schema: S.Top): boolean => {
  const objectsAst = getObjectsAst(schema.ast)
  if (!objectsAst) {
    // Not a struct-like schema
    return false
  }

  for (const prop of objectsAst.propertySignatures) {
    if (!EAST.isOptional(prop.type)) {
      return true
    }
  }

  return false
}

/**
 * Type-level check if a struct schema has any required fields.
 *
 * Returns `true` if the schema's `Encoded` type has any required properties,
 * `false` otherwise.
 *
 * @example
 * ```ts
 * // true - apiKey is required
 * type A = HasRequiredFields<typeof S.Struct({ apiKey: S.String })>
 *
 * // false - all fields optional
 * type B = HasRequiredFields<typeof S.Struct({
 *   port: S.optional(S.Number, { default: () => 3000 })
 * })>
 * ```
 */
// oxfmt-ignore
export type HasRequiredFields<$Schema extends S.Top> =
  // Check if all keys of Encoded are optional by comparing with Partial
  {} extends $Schema["Encoded"]
    ? false
    : RequiredKeysOf<$Schema["Encoded"]> extends never
      ? false
      : true

/**
 * Extract required keys from a type.
 * A key is required if it's not optional (no `?` modifier).
 */
type RequiredKeysOf<$T> = {
  [K in keyof $T]-?: {} extends Pick<$T, K> ? never : K
}[keyof $T]
