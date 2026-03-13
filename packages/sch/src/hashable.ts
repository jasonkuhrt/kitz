import { Obj } from '@kitz/core'
import { DateTime, Hash, HashMap, HashSet, Schema as S } from 'effect'
import * as AST from 'effect/SchemaAST'
import { copyAnnotations } from './ast.js'
import {
  getArrayElement,
  getMapKeyValue,
  getRecordKeyValue,
  getSetElement,
  getTransformParts,
  hasDirectFields,
  isArraySchema,
  isMapSchema,
  isNonHashableTransform,
  isRecordSchema,
  isSetSchema,
  isStructSchema,
  isTupleSchema,
  isUnionSchema,
} from './predicates.js'

// ============================================================================
// Coercible Type
// ============================================================================

/**
 * Types that can be losslessly coerced to Effect hashable equivalents.
 *
 * This recursive type constrains valid inputs to {@link ensureHashable}.
 * Types not in this union (RegExp, Error, URL, TypedArray, etc.) will
 * cause a compile-time error.
 */
// oxfmt-ignore
export type Coercible =
  | null
  | undefined
  | string
  | number
  | boolean
  | bigint
  | symbol
  | Date                                    // → DateTime
  | Hash.Hash                               // Already hashable
  | readonly Coercible[]                    // arrays
  | ReadonlyMap<Coercible, Coercible>       // → HashMap
  | ReadonlySet<Coercible>                  // → HashSet
  | { readonly [key: string]: Coercible }

// ============================================================================
// Type-Level Transformation
// ============================================================================

/**
 * Recursively transform a type to reflect hashable collection transformations.
 *
 * This type maps input types to their hashable equivalents:
 * - `Map<K, V>` → `HashMap.HashMap<K', V'>` (with recursive key/value processing)
 * - `Set<E>` → `HashSet.HashSet<E'>` (with recursive element processing)
 * - Objects/arrays → unchanged (v4's Equal handles plain objects structurally)
 * - Primitives → unchanged
 *
 * @example
 * ```ts
 * type Input = { id: string, data: Map<string, number> }
 * type Output = EnsureHashableType<Input>
 * // = { id: string, data: HashMap.HashMap<string, number> }
 * ```
 */
// oxfmt-ignore
export type EnsureHashableType<$Type> =
  // Map → HashMap (recurse into key and value)
  $Type extends ReadonlyMap<infer __key__, infer __value__> ? HashMap.HashMap<EnsureHashableType<__key__>, EnsureHashableType<__value__>> :
  // Set → HashSet (recurse into element)
  $Type extends ReadonlySet<infer __element__>              ? HashSet.HashSet<EnsureHashableType<__element__>> :
  // Arrays - recurse into elements (no type wrapper needed)
  $Type extends readonly (infer __element__)[]              ? readonly EnsureHashableType<__element__>[] :
  // Objects/structs - recurse into fields (no type wrapper needed)
  $Type extends Record<string, unknown>                     ? { readonly [k in keyof $Type]: EnsureHashableType<$Type[k]> } :
  // Primitives and other types - unchanged
  $Type

// ============================================================================
// Schema-Level Hashable
// ============================================================================

/**
 * Check if an AST represents a hashable type.
 *
 * In v4, hashable types are:
 * - Declarations with identifier annotation (Schema.Class, TaggedClass)
 * - Declarations with "Data<" description prefix
 */
const isHashableAST = (ast: AST.AST): boolean => {
  if (!AST.isDeclaration(ast)) return false

  // Schema.Class and TaggedClass: have identifier annotation
  const identifier = AST.resolveIdentifier(ast)
  if (identifier !== undefined) return true

  // Schema.Data: has description starting with "Data<"
  const description = AST.resolveDescription(ast)
  if (description !== undefined && description.startsWith('Data<')) return true

  return false
}

/**
 * Detect if a schema produces hashable data (implements Hash/Equal traits).
 *
 * Returns true for:
 * - Schema.Class instances
 * - Union of hashable schemas (all members are hashable)
 *
 * @example
 * ```ts
 * import { Schema } from 'effect'
 * import { Sch } from '@wollybeard/kit'
 *
 * const PlainSchema = Schema.Struct({ id: Schema.String })
 * Sch.Hashable.isSchemaProducingHashableData(PlainSchema) // false
 * ```
 */
export const isSchemaProducingHashableData = (schema: S.Top): boolean => {
  if (AST.isUnion(schema.ast))
    return schema.ast.types.every((memberAST) => isHashableAST(memberAST))
  return isHashableAST(schema.ast)
}

// ============================================================================
// Recursive Schema Processing
// ============================================================================

/**
 * Check if AST is an internal struct transform (Objects with encoding chain).
 *
 * In v4, structs with optionalWith/default fields have encoding chains
 * on their Objects AST nodes.
 */
const isInternalStructTransform = (
  ast: AST.AST,
): ast is AST.Objects & { readonly encoding: AST.Encoding } => {
  if (!AST.isObjects(ast)) return false
  return ast.encoding !== undefined
}

/**
 * Process a struct field recursively.
 *
 * In v4, fields are just schemas (Top). There's no separate
 * PropertySignature wrapper type.
 */
const processField = (field: S.Top, getOrProcess: (s: S.Top) => S.Top): S.Top => {
  return getOrProcess(field)
}

/**
 * Recursively process a schema and its nested fields for deep hashability.
 *
 * In Effect v4, Equal.equals already handles structural comparison for
 * plain objects, arrays, Maps, Sets, and Dates natively. This function's
 * primary remaining purpose is:
 * - Converting Map schemas to HashMap schemas
 * - Converting Set schemas to HashSet schemas
 * - Recursing into nested structures to apply these conversions
 *
 * **Recursive behavior:**
 * - Struct fields → recursively processed
 * - Array elements → recursively processed
 * - Union members → each member recursively processed
 * - {@link S.Map} → converted to {@link S.HashMap} (with recursive key/value processing)
 * - {@link S.Set} → converted to {@link S.HashSet} (with recursive element processing)
 * - {@link S.Record} → value schema recursively processed
 * - {@link S.suspend} → creates new suspend with lazy lookup for recursive schemas
 * - Already hashable (Class, TaggedClass) → returned unchanged
 * - Primitives → returned unchanged
 *
 * @example
 * ```ts
 * import { Schema, Equal } from 'effect'
 * import { Sch } from '@wollybeard/kit'
 *
 * // Nested struct - v4 handles structural equality natively
 * const NestedSchema = Schema.Struct({
 *   id: Schema.String,
 *   address: Schema.Struct({
 *     city: Schema.String,
 *     zip: Schema.String
 *   })
 * })
 *
 * const HashableSchema = Sch.Hashable.ensureHashableSchema(NestedSchema)
 * ```
 *
 * @see {@link isSchemaProducingHashableData} to check without wrapping
 */
export const ensureHashableSchema = <$S extends S.Top>(
  schema: $S,
): S.Codec<EnsureHashableType<$S['Type']>, $S['Encoded'], $S['DecodingServices']> => {
  // Memoization map: AST → processed schema
  const processed = new Map<AST.AST, S.Top>()

  const getOrProcess = (s: S.Top): S.Top => {
    const cached = processed.get(s.ast)
    if (cached !== undefined) return cached
    const result = processSchema(s)
    processed.set(s.ast, result)
    return result
  }

  const processSchema = (schema: S.Top): S.Top => {
    const ast = schema.ast
    const annotations = AST.resolve(ast)

    // S.suspend - create new suspend with lazy lookup for recursive schemas
    // The suspend's function is evaluated during DECODING, not during schema construction.
    // By decode time, the memoization map is fully populated.
    if (AST.isSuspend(ast)) {
      const original = { ast: ast.thunk() } as unknown as S.Top
      const newSuspend = S.suspend(() => getOrProcess(original))
      return copyAnnotations(newSuspend, annotations)
    }

    // S.Map → S.HashMap (produces HashMap with Hash/Equal support)
    if (isMapSchema(schema)) {
      const { key, value } = getMapKeyValue(schema)
      const processedKey = getOrProcess(key)
      const processedValue = getOrProcess(value)
      return S.HashMap(processedKey, processedValue)
    }

    // S.Set → S.HashSet (produces HashSet with Hash/Equal support)
    if (isSetSchema(schema)) {
      const element = getSetElement(schema)
      const processedElement = getOrProcess(element)
      return S.HashSet(processedElement)
    }

    // Already hashable - return unchanged (stop recursion)
    if (isSchemaProducingHashableData(schema)) {
      return schema
    }

    // Non-hashable transform - process the schema recursively
    // In v4, transforms are stored in the encoding chain
    if (isNonHashableTransform(schema)) {
      const { from, to, transformation } = getTransformParts(schema)
      const processedTo = getOrProcess(to)

      // If to schema didn't change, just return original (primitive transforms)
      if (processedTo === to) {
        return schema
      }

      // Rebuild transform with processed to schema using decodeTo
      const rebuilt = S.decodeTo(processedTo, {
        decode: transformation.decode as any,
        encode: transformation.encode as any,
      })(from)
      return copyAnnotations(rebuilt, annotations)
    }

    // S.Record - recurse into value schema
    if (isRecordSchema(schema)) {
      const { key, value } = getRecordKeyValue(schema)
      const processedValue = getOrProcess(value)
      const newRecord = S.Record(key as S.Record.Key, processedValue)
      return copyAnnotations(newRecord, annotations)
    }

    // Internal struct transform (Objects with encoding chain for defaults)
    if (isInternalStructTransform(ast) && !hasDirectFields(schema)) {
      const processedFields = Object.fromEntries(
        ast.propertySignatures.map((prop: AST.PropertySignature) => {
          const fieldSchema = { ast: prop.type } as unknown as S.Top
          const processedSchema = getOrProcess(fieldSchema)
          if (AST.isOptional(prop.type)) {
            return [prop.name as string, S.optionalKey(processedSchema)]
          }
          return [prop.name as string, processedSchema]
        }),
      )

      const newStruct = S.Struct(processedFields as S.Struct.Fields)
      return copyAnnotations(newStruct, annotations)
    }

    // Struct - recurse into fields
    if (isStructSchema(schema)) {
      let processedFields: Record<string, S.Top>

      if (hasDirectFields(schema)) {
        // Direct Struct schema - process each field
        processedFields = Obj.mapValues(schema.fields as Record<string, S.Top>, (field) =>
          processField(field, getOrProcess),
        )
      } else {
        // Schema with Objects AST - extract fields from AST and process
        const objectsAST = ast as AST.Objects
        processedFields = Object.fromEntries(
          objectsAST.propertySignatures.map((prop: AST.PropertySignature) => {
            const fieldSchema = { ast: prop.type } as unknown as S.Top
            const processedSchema = getOrProcess(fieldSchema)
            // Preserve optional status from AST context
            if (AST.isOptional(prop.type)) {
              return [prop.name as string, S.optionalKey(processedSchema)]
            }
            return [prop.name as string, processedSchema]
          }),
        )
      }

      const newStruct = S.Struct(processedFields as S.Struct.Fields)
      return copyAnnotations(newStruct, annotations)
    }

    // Array - recurse into element
    if (isArraySchema(schema)) {
      const processedElement = getOrProcess(getArrayElement(schema))
      const newArray = S.Array(processedElement)
      return copyAnnotations(newArray, annotations)
    }

    // Tuple - recurse into elements, preserving optionality
    if (isTupleSchema(schema)) {
      const arraysAST = ast as AST.Arrays
      const processedElements = arraysAST.elements.map((elementAST: AST.AST) => {
        const elementSchema = { ast: elementAST } as unknown as S.Top
        const processedElementSchema = getOrProcess(elementSchema)
        // Preserve optional status using optionalKey
        return AST.isOptional(elementAST)
          ? S.optionalKey(processedElementSchema)
          : processedElementSchema
      })
      const newTuple = S.Tuple(processedElements)
      return copyAnnotations(newTuple, annotations)
    }

    // Union - recurse into each member
    if (isUnionSchema(schema)) {
      const unionAST = ast as AST.Union
      const processedMembers = unionAST.types.map((memberAST: AST.AST) => {
        const memberSchema = { ast: memberAST } as unknown as S.Top
        return getOrProcess(memberSchema)
      })
      const newUnion = S.Union(processedMembers)
      return copyAnnotations(newUnion, annotations)
    }

    // Primitives and other unsupported types - return unchanged
    return schema
  }

  return getOrProcess(schema) as any
}

// ============================================================================
// Runtime Value Hashable
// ============================================================================

/**
 * Recursively convert a value to use Effect's hashable equivalents.
 *
 * In Effect v4, Hash.hash and Equal.equals already handle plain objects,
 * arrays, Maps, Sets, and Dates structurally. This function is primarily
 * useful for converting:
 * - Map → HashMap
 * - Set → HashSet
 * - Date → DateTime
 *
 * Types not in {@link Coercible} (RegExp, Error, URL, TypedArray, etc.) will
 * cause a compile-time error.
 *
 * @example
 * ```ts
 * import { Hash } from 'effect'
 * import { Sch } from '@wollybeard/kit'
 *
 * const plain = { name: 'test', items: [1, 2, 3] }
 * const hashable = Sch.Hashable.ensureHashable(plain)
 *
 * // Now hashable can be used with Effect's Hash/Equal
 * Hash.hash(hashable) // stable hash value
 *
 * // Date, Map, Set are also supported
 * const dateHashable = Sch.Hashable.ensureHashable(new Date())
 * const mapHashable = Sch.Hashable.ensureHashable(new Map([['a', 1]]))
 * ```
 */
export const ensureHashable = <$T extends Coercible>(data: $T): $T => {
  // Primitives pass through unchanged
  if (data === null || data === undefined) return data
  if (typeof data !== 'object') return data

  // Objects that already implement Hash can be used directly
  if (Hash.isHash(data)) return data

  // Date → DateTime (lossless: same epoch milliseconds)
  if (data instanceof Date) {
    return DateTime.fromDateUnsafe(data) as any
  }

  // Map → HashMap (lossless: preserves all entries) + recurse into keys AND values
  if (data instanceof Map) {
    const entries = Array.from(data.entries()).map(
      ([k, v]) => [ensureHashable(k as Coercible), ensureHashable(v as Coercible)] as const,
    )
    return HashMap.fromIterable(entries) as any
  }

  // Set → HashSet (lossless: preserves all elements) + recurse into elements
  if (data instanceof Set) {
    const elements = Array.from(data).map((v) => ensureHashable(v as Coercible))
    return HashSet.fromIterable(elements) as any
  }

  // Arrays - in v4, plain arrays are already structurally comparable
  // but we still recurse to handle nested Maps/Sets/Dates
  if (Array.isArray(data)) {
    const processedItems = data.map((item) => ensureHashable(item as Coercible))
    return processedItems as unknown as $T
  }

  // Plain objects - in v4, already structurally comparable
  // but we still recurse to handle nested Maps/Sets/Dates
  return Obj.mapValues(data as Record<string, Coercible>, ensureHashable) as $T
}
