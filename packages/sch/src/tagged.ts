import { Schema as S } from 'effect'
import type * as EAST from 'effect/SchemaAST'
import { isLiteral, isObjects } from 'effect/SchemaAST'
import * as AST from './ast.js'
import type { AnySchema, StringOrNever } from './sch.js'
import type { ExtractFields } from './struct.js'

export type Tag = string
export type AnyTaggedStruct = S.TaggedStruct<EAST.LiteralValue, any>
export type Any = S.TaggedStruct<any, any>

/**
 * Omit the _tag field from a type.
 */
export type OmitTag<$T> = Omit<$T, '_tag'>

export type Filter<
  $TaggedStruct extends AnyTaggedStruct,
  $PickedKeys extends keyof ExtractFields<$TaggedStruct>,
> =
  $TaggedStruct extends S.TaggedStruct<infer __tag__, infer __structFields__>
    ? S.TaggedStruct<__tag__, Pick<__structFields__, $PickedKeys>>
    : never

export type ArgTag<$Schema extends AnySchema> =
  $Schema extends S.TaggedStruct<infer __tag__ extends EAST.LiteralValue, any> ? __tag__ : never

export type ArgTagString<$Schema extends AnySchema> = StringOrNever<ArgTag<$Schema>>

export type ArgFields<$Schema extends Any> =
  $Schema extends S.TaggedStruct<any, infer __fields__> ? __fields__ : never

/**
 * Extract the tag value from a tagged struct schema.
 * Handles transformations and other wrappers.
 */
export const getTagOrThrow = <schema extends AnySchema>(schema: schema): ArgTagString<schema> => {
  // Resolve non-structural wrappers
  let resolved = AST.resolve(schema.ast)

  // In v4, transformations are in encoding chain
  if (schema.ast.encoding !== undefined) {
    const toEncodedAst = schema.ast.encoding[0]?.to
    if (toEncodedAst) {
      resolved = AST.resolve(toEncodedAst)
    }
  }

  // Check if we reached an Objects (struct)
  if (!isObjects(resolved)) {
    throw new Error(
      `Expected to reach an Objects (struct) after traversing non-structural schemas, but got: ${resolved._tag}`,
    )
  }

  // Direct access: _tag is always first in TaggedStruct
  const tagProperty = resolved.propertySignatures[0]

  if (!tagProperty || tagProperty.name !== '_tag') {
    throw new Error('Expected _tag as first property in TaggedStruct')
  }

  // The _tag property's type should be a Literal
  const tagType = tagProperty.type

  if (!isLiteral(tagType)) {
    throw new Error('Expected Literal type for _tag property')
  }

  // Ensure the literal is a string
  if (typeof tagType.literal !== 'string') {
    throw new Error(
      `Expected tag to be a string literal, but got ${typeof tagType.literal}: ${tagType.literal}`,
    )
  }

  return tagType.literal as any
}

// Type utilities for extracting from unions

/**
 * Extract a specific tagged struct from a union by tag name.
 * Returns never if not found.
 * NOTE: Cannot extract actual schemas from suspended types, only direct schemas.
 */
export type ExtractByTag<$TagName extends Tag, $Union extends S.Top> =
  $Union extends S.Union<infer $Members extends readonly S.Top[]>
    ? ExtractTaggedStructFromArray<$TagName, $Members>
    : $Union extends S.TaggedStruct<infer __tag__, any>
      ? $TagName extends __tag__
        ? $Union
        : never
      : never

// Helper to extract from array of schemas
type ExtractTaggedStructFromArray<
  $TagName extends Tag,
  $Schemas extends readonly S.Top[],
> = $Schemas extends readonly [infer $First extends S.Top, ...infer $Rest extends readonly S.Top[]]
  ? $First extends S.TaggedStruct<infer __tag__, any>
    ? $TagName extends __tag__
      ? $First
      : ExtractTaggedStructFromArray<$TagName, $Rest>
    : ExtractTaggedStructFromArray<$TagName, $Rest>
  : never

/**
 * Predicate to check if a union contains a specific tag.
 * Can check suspended types by looking at their decoded type's _tag.
 */
export type DoesTaggedUnionContainTag<$TagName extends string, $Union extends S.Top> =
  $Union extends S.Union<infer $Members extends readonly S.Top[]>
    ? ContainsTagInArray<$TagName, $Members>
    : $Union extends S.TaggedStruct<infer __tag__, any>
      ? $TagName extends __tag__
        ? true
        : false
      : $Union extends S.suspend<infer $Schema>
        ? $Schema['Type'] extends { readonly _tag: infer __tag__ }
          ? $TagName extends __tag__
            ? true
            : false
          : false
        : false

// Helper to check if array contains tag
type ContainsTagInArray<
  $TagName extends string,
  $Schemas extends readonly S.Top[],
> = $Schemas extends readonly [infer $First extends S.Top, ...infer $Rest extends readonly S.Top[]]
  ? $First extends S.TaggedStruct<infer __tag__, any>
    ? $TagName extends __tag__
      ? true
      : ContainsTagInArray<$TagName, $Rest>
    : $First extends S.suspend<infer $Schema>
      ? $Schema['Type'] extends { readonly _tag: infer __tag__ }
        ? $TagName extends __tag__
          ? true
          : ContainsTagInArray<$TagName, $Rest>
        : ContainsTagInArray<$TagName, $Rest>
      : ContainsTagInArray<$TagName, $Rest>
  : false
