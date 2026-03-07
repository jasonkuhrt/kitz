import { Obj } from '@kitz/core'
import { Data, DateTime, Hash, HashMap, HashSet, Option, Schema as S } from 'effect'
import { PropertySignatureTransformation } from 'effect/Schema'
import * as AST from 'effect/SchemaAST'
import { copyAnnotations } from './ast.js'
import {
  getArrayElement,
  getMapKeyValue,
  getRecordKeyValue,
  getSetElement,
  getTransformParts,
  hasDirectFields,
  hasNullableOption,
  isArraySchema,
  isMapSchema,
  isNonHashableTransform,
  isPropertySignature,
  isPropertySignatureDeclaration,
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
  | readonly Coercible[]                    // → Data.array
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
 * - Objects/arrays → unchanged (Effect's S.Data doesn't change type signature)
 * - Primitives → unchanged
 *
 * Note: While S.Data wraps structs/arrays at RUNTIME for Hash/Equal support,
 * it doesn't change the TYPE signature. Only Map→HashMap and Set→HashSet
 * produce different types.
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
 * A hashable AST is a Transformation with a Declaration target that has
 * either an identifier (Class) or "Data<" description prefix.
 */
type HashableAST = AST.Transformation & { readonly to: AST.Declaration }

/**
 * Check if an AST represents a hashable type (Transformation → Declaration with identifier or Data<...>).
 *
 * Detection strategy:
 * - **Schema.Class**: Has `IdentifierAnnotationId` (e.g., "Person")
 * - **Schema.Data**: Has `DescriptionAnnotationId` starting with "Data<" (e.g., "Data<{ readonly a: string }>")
 *
 * The "Data<" prefix is stable because it's part of Effect's public-facing error messages and
 * JSON serialization output. A change would require a major Effect version bump.
 */
const isHashableAST = (ast: AST.AST): ast is HashableAST => {
  // Only Transformations can produce Data or Class instances
  if (!AST.isTransformation(ast)) return false
  // Only Declarations can be Data or Class schemas
  if (!AST.isDeclaration(ast.to)) return false
  // Schema.Class and TaggedClass: have identifier annotation (non-empty string)
  if (Option.isSome(AST.getIdentifierAnnotation(ast.to))) {
    return true
  }
  // Schema.Data: has description annotation starting with "Data<"
  // This prefix is stable - it's part of Effect's public error message format
  const description = AST.getDescriptionAnnotation(ast.to)
  if (Option.isSome(description) && description.value.startsWith('Data<')) {
    return true
  }
  return false
}

/**
 * Detect if a schema produces hashable data (implements Hash/Equal traits).
 *
 * Returns true for:
 * - Schema.Class instances
 * - Schema.Data-wrapped schemas
 * - Union of hashable schemas (all members are hashable)
 *
 * @example
 * ```ts
 * import { Schema } from 'effect'
 * import { Sch } from '@wollybeard/kit'
 *
 * const DataSchema = Schema.Data(Schema.Struct({ id: Schema.String }))
 * Sch.Hashable.isSchemaProducingHashableData(DataSchema) // true
 *
 * const PlainSchema = Schema.Struct({ id: Schema.String })
 * Sch.Hashable.isSchemaProducingHashableData(PlainSchema) // false
 * ```
 */
export const isSchemaProducingHashableData = (schema: S.Schema.Any): boolean => {
  if (AST.isUnion(schema.ast))
    return schema.ast.types.every((memberAST) => isHashableAST(memberAST))
  return isHashableAST(schema.ast)
}

// ============================================================================
// Recursive Schema Processing
// ============================================================================

/**
 * Check if AST is an internal struct transform (struct with optionalWith fields).
 *
 * When a struct has optionalWith fields with defaults/nullable, Effect represents
 * it as a Transformation with TypeLiteralTransformation (not FinalTransformation).
 * This is different from user transforms (S.transform) which use FinalTransformation.
 *
 * When we extract such a struct from a PropertySignatureTransformation via S.make(),
 * we get a schema whose AST is this Transformation - NOT a plain TypeLiteral.
 * So isStructSchema() returns false and we need this separate check.
 */
const isInternalStructTransform = (
  ast: AST.AST,
): ast is AST.Transformation & {
  from: AST.TypeLiteral
  transformation: AST.TypeLiteralTransformation & {
    propertySignatureTransformations: readonly AST.PropertySignatureTransformation[]
  }
} => {
  if (!AST.isTransformation(ast)) return false
  if (!AST.isTypeLiteralTransformation(ast.transformation)) return false
  return AST.isTypeLiteral(ast.from)
}

/**
 * Process a struct field (either a Schema or PropertySignature) recursively.
 */
const processField = (
  field: S.Struct.Field,
  getOrProcess: (s: S.Schema.Any) => S.Schema.Any,
): S.Struct.Field => {
  // Plain schema - recurse directly
  if (!isPropertySignature(field)) {
    return getOrProcess(field as S.Schema.Any)
  }

  // PropertySignature - use .from to get inner schema directly (preserves .fields and correct AST)
  const innerSchema = (field as any).from as S.Schema.Any
  const processedInner = getOrProcess(innerSchema)

  // If inner didn't change, return original PropertySignature
  if (processedInner.ast === innerSchema.ast) return field

  // Reconstruct PropertySignature with processed inner schema
  return reconstructPropertySignature(field, processedInner)
}

/**
 * Wrap a default value with appropriate Data wrapper (struct for objects, array for arrays).
 * Checks if the value already implements Hash to avoid double-wrapping.
 */
const wrapDefaultValue = (originalDefault: () => unknown): (() => unknown) => {
  return () => {
    const value = originalDefault()
    // Already hashable - return unchanged to avoid double-wrapping
    if (value !== null && typeof value === 'object' && Hash.isHash(value)) {
      return value
    }
    if (Array.isArray(value)) {
      return Data.array(value)
    }
    if (typeof value === 'object' && value !== null) {
      return Data.struct(value as Record<string, unknown>)
    }
    // Primitives can't be wrapped - return as-is
    return value
  }
}

/**
 * Reconstruct a PropertySignature with a new inner schema.
 * Preserves optional, default, readonly, and annotations.
 */
const reconstructPropertySignature = (
  original: S.PropertySignature.All,
  processedInner: S.Schema.Any,
): S.PropertySignature.All => {
  const psAST = original.ast

  // PropertySignatureDeclaration - simple optional fields
  if (isPropertySignatureDeclaration(psAST)) {
    // Reconstruct based on optional/default status
    if (psAST.isOptional) {
      if (psAST.defaultValue !== undefined) {
        // optionalWith with default - wrap the default value to return Data
        const wrappedDefault = wrapDefaultValue(psAST.defaultValue)
        const result = S.optionalWith(processedInner, { default: wrappedDefault })
        return Obj.isEmpty(psAST.annotations)
          ? result
          : result.annotations(psAST.annotations as any)
      } else {
        // Simple optional
        const result = S.optional(processedInner)
        return Obj.isEmpty(psAST.annotations)
          ? result
          : result.annotations(psAST.annotations as any)
      }
    }
    // Required field but wrapped in PropertySignature - shouldn't happen often
    return S.propertySignature(processedInner).annotations(psAST.annotations as any)
  }

  // PropertySignatureTransformation - handle optionalWith options
  const trans = psAST as PropertySignatureTransformation

  // Build options object preserving detected options
  const options: {
    default?: () => unknown
    nullable?: boolean
  } = {}

  if (trans.to.defaultValue !== undefined) {
    options.default = wrapDefaultValue(trans.to.defaultValue)
  }

  if (hasNullableOption(trans)) {
    options.nullable = true
  }

  const annotations = trans.to.annotations
  const copyPSAnnotations = (ps: S.PropertySignature.All): S.PropertySignature.All =>
    annotations && !Obj.isEmpty(annotations) ? ps.annotations(annotations as any) : ps

  // If we have any options to preserve, reconstruct with them
  if (!Obj.isEmpty(options)) {
    return copyPSAnnotations(S.optionalWith(processedInner, options as any))
  }

  // Fallback: use simple optional (inner was processed, options not detected)
  return copyPSAnnotations(S.optional(processedInner))
}

/**
 * Reconstruct a PropertySignature from a PropertySignatureTransformation AST.
 *
 * This is used when processing internal struct transforms - structs with optionalWith
 * fields that were extracted via S.make() from an AST. The AST contains
 * PropertySignatureTransformation nodes with default/nullable info we need to preserve.
 *
 * @param processedSchema - The inner schema after recursive processing
 * @param transform - The PropertySignatureTransformation AST node
 * @returns A Struct.Field preserving defaults and nullable options
 */
const reconstructFieldFromTransform = (
  processedSchema: S.Schema.Any,
  transform: PropertySignatureTransformation,
): S.Struct.Field => {
  const options: { default?: () => unknown; nullable?: boolean } = {}
  // Cast to access internal AST structure
  const trans = transform as any

  // Extract default from the `to` side (decoded side)
  if (trans.to.defaultValue !== undefined) {
    options.default = wrapDefaultValue(trans.to.defaultValue)
  }

  // Check for nullable (Union with null in `from.type`)
  if (AST.isUnion(trans.from.type)) {
    const hasNull = trans.from.type.types.some(
      (t: AST.AST) => AST.isLiteral(t) && t.literal === null,
    )
    if (hasNull) options.nullable = true
  }

  if (!Obj.isEmpty(options)) {
    const result = S.optionalWith(processedSchema, options as any)
    return trans.to.annotations && !Obj.isEmpty(trans.to.annotations)
      ? result.annotations(trans.to.annotations as any)
      : result
  }

  // Fallback to simple optional
  return S.optional(processedSchema)
}

/**
 * Recursively wrap a schema and its nested fields with {@link S.Data} for deep hashability.
 *
 * Unlike a shallow wrapper, this function traverses the schema tree and wraps
 * nested struct fields, ensuring {@link Equal.equals} works at ALL nesting levels.
 *
 * **Recursive behavior:**
 * - Struct fields that are themselves structs → recursively processed, then wrapped
 * - Array elements that are structs → recursively processed, then wrapped
 * - Union members → each member recursively processed
 * - {@link S.Map} → converted to {@link S.HashMap} (with recursive key/value processing)
 * - {@link S.Set} → converted to {@link S.HashSet} (with recursive element processing)
 * - {@link S.Record} → value schema recursively processed, then wrapped
 * - {@link S.transform} → output schema recursively processed for deep hashability
 * - {@link S.suspend} → creates new suspend with lazy lookup for recursive schemas
 * - Already hashable (Class, Data, TaggedClass) → returned unchanged
 * - Primitives → returned unchanged (can't wrap with Data)
 *
 * **Use cases:**
 * - Ensure decoded values work as {@link HashMap} keys or {@link HashSet} elements
 * - Enable deep {@link Equal.equals} comparison on nested structures
 * - Prepare complex schemas for caching/deduplication systems
 *
 * **Constraints:**
 * - Only structs/arrays can be wrapped ({@link S.Data} constraint)
 * - Primitives and already-hashable schemas pass through unchanged
 *
 * @example
 * ```ts
 * import { Schema, Equal } from 'effect'
 * import { Sch } from '@wollybeard/kit'
 *
 * // Nested struct - both levels become hashable
 * const NestedSchema = Schema.Struct({
 *   id: Schema.String,
 *   address: Schema.Struct({
 *     city: Schema.String,
 *     zip: Schema.String
 *   })
 * })
 *
 * const HashableSchema = Sch.Hashable.ensureHashableSchema(NestedSchema)
 * const decode = Schema.decodeSync(HashableSchema)
 *
 * const a = decode({ id: '1', address: { city: 'NYC', zip: '10001' } })
 * const b = decode({ id: '1', address: { city: 'NYC', zip: '10001' } })
 *
 * Equal.equals(a, b)         // true - top level
 * Equal.equals(a.address, b.address) // true - nested level too!
 * ```
 *
 * @see {@link isSchemaProducingHashableData} to check without wrapping
 */
export const ensureHashableSchema = <$S extends S.Schema.Any>(
  schema: $S,
): S.Schema<EnsureHashableType<S.Schema.Type<$S>>, S.Schema.Encoded<$S>, S.Schema.Context<$S>> => {
  // Memoization map: AST → processed schema
  // Keyed by AST (not Schema) because S.make() creates new Schema objects for the same AST.
  // This ensures suspend closures can find cached results when evaluated during decoding.
  const processed = new Map<AST.AST, S.Schema.Any>()

  // Map AST → original schema with .fields for PropertySignature access
  // This allows us to recover field defaults when processing internal struct transforms
  const originalSchemas = new Map<AST.AST, S.Struct<S.Struct.Fields>>()

  // Collect all struct schemas with .fields before processing
  const collectOriginalSchemas = (s: S.Schema.Any): void => {
    if (hasDirectFields(s)) {
      originalSchemas.set(s.ast, s as S.Struct<S.Struct.Fields>)
      // Recurse into nested structs from PropertySignatures
      for (const field of Object.values(s.fields)) {
        if (isPropertySignature(field)) {
          // PropertySignature.from IS the original inner schema with .fields
          const innerSchema = (field as any).from as S.Schema.Any
          collectOriginalSchemas(innerSchema)
        } else {
          collectOriginalSchemas(field as S.Schema.Any)
        }
      }
    }
  }

  collectOriginalSchemas(schema)

  const getOrProcess = (s: S.Schema.Any): S.Schema.Any => {
    const cached = processed.get(s.ast)
    if (cached !== undefined) return cached
    const result = processSchema(s)
    processed.set(s.ast, result)
    return result
  }

  const processSchema = (schema: S.Schema.Any): S.Schema.Any => {
    const ast = schema.ast
    const annotations = ast.annotations

    // S.suspend - create new suspend with lazy lookup for recursive schemas
    // The suspend's function is evaluated during DECODING, not during schema construction.
    // By decode time, the memoization map is fully populated.
    if (AST.isSuspend(ast)) {
      const original = S.make(ast.f())
      const newSuspend = S.suspend(() => getOrProcess(original))
      return copyAnnotations(newSuspend, annotations)
    }

    // S.Map → S.HashMap (produces HashMap with Hash/Equal support)
    if (isMapSchema(schema)) {
      const { key, value } = getMapKeyValue(schema)
      const processedKey = getOrProcess(key)
      const processedValue = getOrProcess(value)
      return S.HashMap({ key: processedKey, value: processedValue })
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

    // Non-hashable transform - process `to` schema recursively, rebuild transform
    // This handles S.transform(from, struct, { decode, encode }) cases
    if (isNonHashableTransform(schema)) {
      const { from, to, transformation } = getTransformParts(schema)
      const processedTo = getOrProcess(to)

      // If to schema didn't change, just return original (primitive transforms)
      if (processedTo === to) {
        return schema
      }

      // Rebuild transform with processed to schema
      const rebuilt = S.transformOrFail(from, processedTo, {
        decode: transformation.decode as any,
        encode: transformation.encode as any,
        strict: false,
      })
      return copyAnnotations(rebuilt, annotations)
    }

    // S.Record - recurse into value schema, then wrap
    // Note: Key schema not processed - Record keys are typically primitives (strings)
    // that don't need hashability wrapping. If complex key types are needed,
    // consider using S.HashMap instead.
    // Must check before Struct since both are TypeLiteral
    if (isRecordSchema(schema)) {
      const { key, value } = getRecordKeyValue(schema)
      const processedValue = getOrProcess(value)
      const newRecord = S.Record({ key, value: processedValue })
      return S.Data(copyAnnotations(newRecord, annotations))
    }

    // Internal struct transform (struct with optionalWith fields, created via S.make())
    // These have TypeLiteralTransformation - we need to look up the original schema
    // to access the PropertySignatures with their defaults.
    // Must check BEFORE isStructSchema since these have Transformation AST, not TypeLiteral.
    // IMPORTANT: Only use this for S.make() schemas that lack .fields - top-level structs with
    // .fields should use the isStructSchema path which uses processField for better handling.
    if (isInternalStructTransform(ast) && !hasDirectFields(schema)) {
      // Try to find the original schema with .fields
      const originalSchema = originalSchemas.get(ast)

      if (originalSchema) {
        // Use the original schema's .fields to process with full PropertySignature info
        const processedFields = Obj.mapValues(originalSchema.fields, (field) =>
          processField(field, getOrProcess),
        )
        const newStruct = S.Struct(processedFields as S.Struct.Fields)
        return S.Data(copyAnnotations(newStruct, annotations))
      }

      // Fallback: process from AST (this loses defaults but shouldn't happen normally)
      const fromLiteral = ast.from
      const processedFields = Object.fromEntries(
        fromLiteral.propertySignatures.map((prop) => {
          const fieldSchema = S.make(prop.type)
          const processedSchema = getOrProcess(fieldSchema)
          if (prop.isOptional) {
            return [prop.name as string, S.optional(processedSchema)]
          }
          return [prop.name as string, processedSchema]
        }),
      )

      const newStruct = S.Struct(processedFields as S.Struct.Fields)
      return S.Data(copyAnnotations(newStruct, annotations))
    }

    // Struct - recurse into fields, then wrap
    if (isStructSchema(schema)) {
      let processedFields: Record<string, S.Struct.Field>

      if (hasDirectFields(schema)) {
        // Direct Struct schema - use processField to handle PropertySignatures
        processedFields = Obj.mapValues(schema.fields, (field) => processField(field, getOrProcess))
      } else {
        // Schema from S.make() - extract fields from AST and process
        const typeLiteral = ast as AST.TypeLiteral
        processedFields = Object.fromEntries(
          typeLiteral.propertySignatures.map((prop) => {
            const fieldSchema = S.make(prop.type)
            const processedSchema = getOrProcess(fieldSchema)
            // Preserve optional status from AST
            if (prop.isOptional) {
              return [prop.name as string, S.optional(processedSchema)]
            }
            return [prop.name as string, processedSchema]
          }),
        )
      }

      const newStruct = S.Struct(processedFields as S.Struct.Fields)
      return S.Data(copyAnnotations(newStruct, annotations))
    }

    // Array - recurse into element, then wrap
    if (isArraySchema(schema)) {
      const processedElement = getOrProcess(getArrayElement(schema))
      const newArray = S.Array(processedElement)
      return S.Data(copyAnnotations(newArray, annotations))
    }

    // Tuple - recurse into elements, preserving optionality, then wrap
    if (isTupleSchema(schema)) {
      const tupleAST = schema.ast
      const processedElements = tupleAST.elements.map((element) => {
        const elementSchema = S.make(element.type)
        const processedElementSchema = getOrProcess(elementSchema)
        // Preserve optional status using S.optionalElement
        return element.isOptional
          ? S.optionalElement(processedElementSchema)
          : processedElementSchema
      })
      const newTuple = S.Tuple(...processedElements)
      return S.Data(copyAnnotations(newTuple, annotations))
    }

    // Union - recurse into each member
    if (isUnionSchema(schema)) {
      const unionAST = schema.ast
      const processedMembers = unionAST.types.map((memberAST) => {
        const memberSchema = S.make(memberAST)
        return getOrProcess(memberSchema)
      })
      const newUnion = S.Union(...processedMembers)
      return copyAnnotations(newUnion, annotations)
    }

    // Primitives and other unsupported types - return unchanged
    // S.Data only works with structs/arrays, so we can't wrap primitives
    return schema
  }

  return getOrProcess(schema) as any
}

// ============================================================================
// Runtime Value Hashable
// ============================================================================

/**
 * Recursively convert a value to use Effect's Data types for stable hashing.
 *
 * Transforms:
 * - Primitives → pass through unchanged
 * - Objects already implementing Hash → pass through unchanged
 * - Date → DateTime (lossless: same epoch milliseconds)
 * - Map → HashMap (lossless: preserves all entries, recurses into keys and values)
 * - Set → HashSet (lossless: preserves all elements, recurses into elements)
 * - Arrays → Data.array (with recursive processing of elements)
 * - Plain objects → Data.struct (with recursive processing of values)
 *
 * Types not in {@link Hashable} (RegExp, Error, URL, TypedArray, etc.) will
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
    return DateTime.unsafeMake(data) as any
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

  // Arrays need recursive processing of all elements
  if (Array.isArray(data)) {
    const processedItems = data.map((item) => ensureHashable(item as Coercible))
    return Data.array(processedItems) as $T
  }

  // Plain objects need recursive processing of all values
  return Data.struct(Obj.mapValues(data as Record<string, Coercible>, ensureHashable)) as $T
}
