import { Schema as S } from 'effect'
import type * as EAST from 'effect/SchemaAST'
import type { StringOrNever } from './sch.js'
import type { AnyStruct } from './struct.js'
import { getTagOrThrow } from './tagged.js'
import type { AnyTaggedStruct, OmitTag } from './tagged.js'

export type AnyUnion = S.Union<S.Top[]>
export type AnyUnionOfStructs = S.Union<AnyStruct[]>
export type AnyUnionAdt = S.Union<AnyTaggedStruct[]>

// Union argument utilities
export namespace Arg {
  export type Members<$Union extends S.Union<any>> =
    $Union extends S.Union<infer __members__> ? __members__ : never
  export type MembersAsUnion<$Union extends S.Union<any>> = Members<$Union>[number]
}

// ============================================================================
// ADT Detection Types
// ============================================================================

export interface ADTInfo {
  name: string
  members: ADTMember[]
}

export interface ADTMember {
  tag: string
  memberName: string
}

/**
 * Extract all tag values from a union of tagged structs.
 */
export type GetTags<$Union extends AnyUnionAdt> = StringOrNever<
  $Union['members'][number]['fields']['_tag']['Type']
>

/**
 * Extract a specific member by its tag.
 */
export type ExtractMemberByTag<$Union extends S.Union<any>, $Tag extends GetTags<$Union>> =
  Arg.MembersAsUnion<$Union> extends infer __member__
    ? __member__ extends S.TaggedStruct<$Tag, any>
      ? __member__['Type']
      : never
    : never

/**
 * Factory function type for creating union members.
 */
export type FnMake<$Union extends S.Union<any>> = <$Tag extends GetTags<$Union>>(
  tag: $Tag,
  fields: OmitTag<ExtractMemberByTag<$Union, $Tag>>,
) => ExtractMemberByTag<$Union, $Tag>

/**
 * Type-safe collection of tagged struct members from a union schema.
 * Returns a map where keys are inferred tag literals.
 */
export const collectMembersByTag = <$Union extends AnyUnionAdt>(
  union: $Union,
): Map<GetTags<$Union>, Arg.MembersAsUnion<$Union>> => {
  const membersByTag = new Map<EAST.LiteralValue, AnyTaggedStruct>()

  for (const member of union.members) {
    const tag = getTagOrThrow(member)
    membersByTag.set(tag, member)
  }

  return membersByTag as any
}

/**
 * Create a factory function for a discriminated union.
 *
 * @example
 * ```typescript
 * const MyUnion = Schema.Union(
 *   Schema.TaggedStruct('TypeA', { value: Schema.String }),
 *   Schema.TaggedStruct('TypeB', { count: Schema.Number })
 * )
 *
 * const make = Sch.Union.makeMake(MyUnion)
 *
 * // Type-safe member creation
 * const a = make('TypeA', { value: 'hello' }) // TypeA
 * const b = make('TypeB', { count: 42 })      // TypeB
 * ```
 */
export const makeMake = <union extends S.Union<any>>(union: union): FnMake<union> => {
  const membersByTag = collectMembersByTag(union)

  // Return the factory function
  return ((tag: any, fields: any) => {
    const memberSchema = membersByTag.get(tag)
    if (!memberSchema) {
      throw new Error(`Unknown tag: ${tag}`)
    }
    // Use the member's makeUnsafe function with the tag added
    return memberSchema.makeUnsafe({ _tag: tag, ...fields })
  }) as any
}

// ============================================================================
// ADT Detection Functions
// ============================================================================

/**
 * Parse tags to detect ADTs.
 * Returns a Map of ADT names to ADT info.
 *
 * @deprecated Use parse instead which returns single ADT or null
 *
 * @example
 * parseADTs(['CatalogVersioned', 'CatalogUnversioned'])
 * // Map { 'Catalog' => { name: 'Catalog', members: [...] } }
 */
export const parseADTs = (tags: string[]): Map<string, ADTInfo> => {
  const result = new Map<string, ADTInfo>()
  const adt = parse(tags)
  if (adt) {
    result.set(adt.name, adt)
  }
  return result
}

/**
 * Parse tags to detect if they form a single ADT.
 * Returns the ADT info if all tags follow one ADT pattern, null otherwise.
 *
 * @example
 * parse(['CatalogVersioned', 'CatalogUnversioned'])
 * // { name: 'Catalog', members: [...] }
 *
 * parse(['CatalogVersioned', 'User'])
 * // null (not an ADT - mixed patterns)
 */
export const parse = (tags: string[]): ADTInfo | null => {
  if (tags.length < 2) return null // Need at least 2 members for an ADT

  // Parse all tags
  const parsedTags = tags
    .map((tag) => ({
      tag,
      parsed: parseTag(tag),
    }))
    .filter((item) => item.parsed !== null) as Array<{
    tag: string
    parsed: NonNullable<ReturnType<typeof parseTag>>
  }>

  // If not all tags could be parsed, it's not an ADT
  if (parsedTags.length !== tags.length) return null

  // Check if all tags have the same ADT name
  const firstParsed = parsedTags[0]
  if (!firstParsed) return null

  const firstAdtName = firstParsed.parsed.adtName
  const allSameAdt = parsedTags.every((item) => item.parsed.adtName === firstAdtName)

  if (!allSameAdt) return null

  // Build the ADT info
  const members = parsedTags.map((item) => ({
    tag: item.tag,
    memberName: item.parsed.memberName,
  }))

  return {
    name: firstAdtName,
    members,
  }
}

/**
 * Check if a specific tag is an ADT member given all tags in the union.
 *
 * @example
 * isADTMember('CatalogVersioned', ['CatalogVersioned', 'CatalogUnversioned'])
 * // true
 */
export const isADTMember = (tag: string, allTags: string[]): boolean => {
  const adt = parse(allTags)

  if (!adt) return false

  return adt.members.some((m: ADTMember) => m.tag === tag)
}

/**
 * Get ADT info for a specific tag.
 * Returns null if the tag is not an ADT member.
 */
export const getADTInfo = (
  tag: string,
  allTags: string[],
): { adtName: string; memberName: string } | null => {
  const adt = parse(allTags)

  if (!adt) return null

  const member = adt.members.find((m: ADTMember) => m.tag === tag)
  if (member) {
    return {
      adtName: adt.name,
      memberName: member.memberName,
    }
  }

  return null
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a single tag to extract potential ADT structure.
 * This does NOT verify if it's actually part of an ADT.
 *
 * @example
 * parseTag('CatalogVersioned') // { adtName: 'Catalog', memberName: 'Versioned' }
 * parseTag('User') // null
 */
const parseTag = (tag: string): { adtName: string; memberName: string } | null => {
  // Must start with uppercase
  if (!/^[A-Z]/.test(tag)) {
    return null
  }

  // Match pattern: Capital + lowercase letters, then Capital + any letters
  const match = tag.match(/^([A-Z][a-z]+)([A-Z][a-zA-Z]+)$/)

  if (!match) {
    return null
  }

  const [, adtName, memberName] = match

  // Check if we got valid matches
  if (!adtName || !memberName) {
    return null
  }

  // Suffix must have at least one lowercase to be valid camelCase
  if (!/[a-z]/.test(memberName)) {
    return null
  }

  return { adtName, memberName }
}

/**
 * Format an ADT tag from components.
 */
export const formatADTTag = (adtName: string, memberName: string): string => {
  return `${adtName}${memberName}`
}

// ============================================================================
// Type-Level Utilities
// ============================================================================

/**
 * Type-level version of parseTag.
 */
export type ParseTag<$Tag extends string> =
  $Tag extends `${infer __adtName__}${infer __memberName__}`
    ? __adtName__ extends `${infer __first__}${infer __rest__}`
      ? __first__ extends Capitalize<__first__>
        ? __rest__ extends `${Lowercase<__rest__>}${string}`
          ? __memberName__ extends `${infer __first2__}${infer __rest2__}`
            ? __first2__ extends Capitalize<__first2__>
              ? __rest2__ extends
                  | `${string}${Lowercase<string>}${string}`
                  | `${Lowercase<string>}${string}`
                  | Lowercase<string>
                ? { adtName: __adtName__; memberName: __memberName__ }
                : never
              : never
            : never
          : never
        : never
      : never
    : never

/**
 * Convert ADT name to path (PascalCase to kebab-case).
 */
export type ADTNameToPath<$Name extends string> = Lowercase<$Name>

/**
 * Convert member name to path (PascalCase to kebab-case).
 */
export type MemberNameToPath<$Name extends string> = Lowercase<$Name>

/**
 * Extract all tags from a union type.
 */
export type ExtractTags<$T> = $T extends { _tag: infer __tag__ extends string } ? __tag__ : never

/**
 * Count members with a specific ADT prefix in a union.
 */
type CountADTMembers<$ADTName extends string, $Union> = [
  Extract<$Union, { _tag: `${$ADTName}${string}` }>,
] extends [never]
  ? 0
  : [Extract<$Union, { _tag: `${$ADTName}${string}` }>] extends [infer __first__]
    ? [Exclude<Extract<$Union, { _tag: `${$ADTName}${string}` }>, __first__>] extends [never]
      ? 1
      : 2 // 2+ members
    : 0

/**
 * Check if a tag is an ADT member within a schema.
 */
export type IsHasMemberTag<$Tag extends string, $S extends S.Top> =
  $S extends S.Schema<infer __union__>
    ? ParseTag<$Tag> extends { adtName: infer __adt__ extends string }
      ? CountADTMembers<__adt__, __union__> extends 0
        ? false
        : CountADTMembers<__adt__, __union__> extends 1
          ? false
          : true
      : false
    : false

/**
 * Get ADT info from a tag within a schema.
 */
export type GetMemberInfo<$Tag extends string, $S extends S.Top> =
  $S extends S.Schema<infer __union__>
    ? ParseTag<$Tag> extends {
        adtName: infer __adt__ extends string
        memberName: infer __member__ extends string
      }
      ? CountADTMembers<__adt__, __union__> extends 0
        ? never
        : CountADTMembers<__adt__, __union__> extends 1
          ? never
          : { adtName: __adt__; memberName: __member__ }
      : never
    : never
