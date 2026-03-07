/**
 * Term object system for generating TypeScript object literals with directives.
 *
 * Provides a flexible DSL for building complex TypeScript objects with:
 * - Spread syntax (`$spread`)
 * - Field grouping (`$fields`)
 * - Literal injection (`$literal`)
 * - TSDoc comments on individual fields
 * - Optional fields
 *
 * @module
 */

import { Obj, Str } from '@kitz/core'
import { Tsdoc as TSDoc } from '../tsdoc/_.js'
import * as TS from './ts.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Directives for controlling object generation.
 */
export interface DirectiveTermObject {
  /**
   * Spread other objects into this one.
   * Generates: `...spread1, ...spread2`
   */
  $spread?: string[]

  /**
   * Nested fields object or directive.
   */
  $fields?: TermObject | DirectiveTermObject

  /**
   * Literal code to inject directly (for comments, complex expressions, etc.).
   * Not processed or escaped.
   */
  $literal?: string
}

/**
 * Primitive values that can appear as field values.
 */
export type TermPrimitive = null | string | number | boolean

/**
 * Directive for an individual object field with metadata.
 */
export interface DirectiveField {
  /**
   * Optional TSDoc comment for this field.
   */
  $TS_DOC?: string | null

  /**
   * Whether the field is optional (adds `?`).
   */
  $OPTIONAL?: boolean

  /**
   * The actual field value.
   */
  $VALUE: FieldValueNonDirective
}

/**
 * Field values that can appear in a directive field.
 */
export type FieldValueNonDirective = TermPrimitive | TermObjectLike

/**
 * Any valid field value (primitive, object, or directive).
 */
export type FieldValue = DirectiveField | FieldValueNonDirective

/**
 * A field as a tuple [key, value].
 */
export type TermFieldTuple = readonly [string, FieldValue]

/**
 * An object mapping field names to values.
 */
export interface TermObject {
  [key: string]: FieldValue
}

/**
 * Generic object type with constrained values.
 */
export type TermObjectOf<$T> = {
  [key: string]: $T
}

/**
 * Flexible term object representations.
 */
export type TermObjectLike = TermObject | DirectiveTermObject | TermFieldTuple[]

/**
 * Directive-like object with optional fields constraint.
 */
export type DirectiveTermObjectLike<
  $Fields extends null | TermObject | DirectiveTermObject = null,
> = {
  $spread?: string[]
  $literal?: string
} & ($Fields extends null ? { $fields?: TermObject | DirectiveTermObject } : { $fields: $Fields })

// ============================================================================
// Type Guards
// ============================================================================

const isDirectiveTermObject = (value: unknown): value is DirectiveTermObject => {
  if (typeof value !== `object` || value === null) return false
  return Object.keys(value).some(
    (key) => key === `$spread` || key === `$fields` || key === `$fieldsMerge`,
  )
}

const isFieldPrimitive = (value: unknown): value is TermPrimitive => {
  return Str.is(value) || typeof value === `number` || typeof value === `boolean` || value === null
}

const DirectiveFieldKeys = {
  $TS_DOC: `$TS_DOC`,
  $VALUE: `$VALUE`,
}

const isDirectiveField = (value: unknown): value is DirectiveField => {
  if (typeof value !== `object` || value === null) return false
  return DirectiveFieldKeys.$VALUE in value
}

const isFieldTuples = (value: unknown): value is TermFieldTuple[] => {
  return Array.isArray(value) && value.every(([key, _]) => Str.is(key))
}

// ============================================================================
// Field Builder
// ============================================================================

/**
 * Create a directive field with metadata.
 *
 * @param input - Field configuration
 * @returns Directive field object
 *
 * @example
 * ```ts
 * objectField$({
 *   value: 'string',
 *   optional: true,
 *   tsDoc: 'User ID'
 * })
 * // { $VALUE: 'string', $OPTIONAL: true, $TS_DOC: 'User ID' }
 * ```
 */
export const objectField$ = (input: {
  tsDoc?: null | string
  optional?: boolean
  value: FieldValueNonDirective
}): DirectiveField => {
  return {
    $TS_DOC: input.tsDoc ?? null,
    $OPTIONAL: input.optional ?? false,
    $VALUE: input.value,
  }
}

// ============================================================================
// Rendering
// ============================================================================

/**
 * Render a directive term object to TypeScript code.
 *
 * @param objectWith - Object with directives
 * @returns TypeScript object literal code
 *
 * @example
 * ```ts
 * directiveTermObject({
 *   $spread: ['BaseType'],
 *   $fields: { id: 'string' }
 * })
 * // '{\n...BaseType,\nid: string\n}'
 * ```
 */
export const directiveTermObject = (objectWith: DirectiveTermObject): string => {
  const spreads = (objectWith.$spread ?? []).map((spread) => `...${spread},`)
  return TS.block(
    spreads.join(`\n`) +
      `\n` +
      termObjectFields(objectWith.$fields ?? {}) +
      (objectWith.$literal ? `\n${objectWith.$literal}` : ``),
  )
}

/**
 * Render any term object-like value to TypeScript code.
 *
 * @param object - Term object, directive object, or field tuples
 * @returns TypeScript object literal code
 *
 * @example
 * ```ts
 * // From object
 * termObject({ name: 'string', age: 'number' })
 * // '{\nname: string,\nage: number\n}'
 *
 * // From tuples
 * termObject([['name', 'string'], ['age', 'number']])
 * // '{\nname: string,\nage: number\n}'
 * ```
 */
export const termObject = (object: TermObjectLike): string => {
  if (Array.isArray(object)) {
    if (object.length === 0) return `{}`
    return termObject(Object.fromEntries(object))
  }
  if (isDirectiveTermObject(object)) return directiveTermObject(object)
  const fields = termObjectFields(object)
  if (fields === ``) return `{}`
  return TS.block(fields)
}

/**
 * Render object fields to TypeScript field declarations.
 *
 * @param object - Term object or directive object
 * @returns Comma-separated field declarations
 *
 * @example
 * ```ts
 * termObjectFields({ name: 'string', age: 'number' })
 * // 'name: string,\nage: number'
 * ```
 */
export const termObjectFields = (object: TermObject | DirectiveTermObject): string =>
  Obj.entries(object)
    .map(([key, value]: [string, any]): [string, DirectiveField] => {
      if (value === null) return [key, { $VALUE: null, $OPTIONAL: false, $TS_DOC: null }]
      if (isDirectiveTermObject(value)) {
        return [key, { $VALUE: directiveTermObject(value), $OPTIONAL: false, $TS_DOC: null }]
      }
      if (isDirectiveField(value)) {
        return [key, value]
      }
      // oxfmt-ignore
      if (Str.is(value) || typeof value === `number` || typeof value === `boolean`) return [key, {$VALUE: String(value), $OPTIONAL: false, $TS_DOC: null}]
      return [key, { $VALUE: termObject(value as any), $OPTIONAL: false, $TS_DOC: null }]
    })
    .map(([key, field]: [string, DirectiveField]) => {
      return fromDirectiveField(key, field)
    })
    .join(`,\n`)

const termObjectField = (field: FieldValueNonDirective): string => {
  if (isFieldTuples(field)) return termObjectField(Object.fromEntries(field))
  if (isFieldPrimitive(field)) return String(field)
  return termObject(field)
}

/**
 * Render a directive field to a TypeScript field declaration.
 *
 * @param key - Field name
 * @param field - Directive field
 * @returns TypeScript field declaration with optional TSDoc and optional marker
 *
 * @example
 * ```ts
 * fromDirectiveField('name', {
 *   $VALUE: 'string',
 *   $OPTIONAL: true,
 *   $TS_DOC: 'User name'
 * })
 * // '/**\n * User name\n *\/\nname?: string'
 * ```
 */
export const fromDirectiveField = (key: string, field: DirectiveField): string => {
  const tsDoc = field.$TS_DOC ? TSDoc.format(field.$TS_DOC) + `\n` : ``
  const optional = field.$OPTIONAL ? `?` : ``
  const value = termObjectField(field.$VALUE)
  return `${tsDoc}${key}${optional}: ${value}`
}

/**
 * Render an array as a TypeScript array literal.
 *
 * @param value - Array of string values
 * @returns TypeScript array literal
 *
 * @example
 * ```ts
 * termList(['"a"', '"b"', '"c"'])
 * // '["a", "b", "c"]'
 * ```
 */
export const termList = (value: string[]) => `[${value.join(`, `)}]`

/**
 * Render a field from a tuple.
 *
 * @param tuple - [name, value, optional tsDoc]
 * @returns TypeScript field declaration
 *
 * @example
 * ```ts
 * termFieldFromTuple(['name', 'string', 'User name'])
 * // '/**\n * User name\n *\/\nname: string,'
 * ```
 */
export const termFieldFromTuple = (
  tuple: readonly [k: string, v: string | null, tsDoc?: string | null],
) => termField(tuple[0], tuple[1], { tsDoc: tuple[2] ?? null })

/**
 * Render a TypeScript object field.
 *
 * @param key - Field name
 * @param value - Field value
 * @param options - Field options (tsDoc, comma)
 * @returns TypeScript field declaration
 *
 * @example
 * ```ts
 * termField('name', 'string', { tsDoc: 'User name', comma: true })
 * // '/**\n * User name\n *\/\nname: string,'
 *
 * termField('age', '', { comma: false })
 * // '' (empty string when value is empty)
 * ```
 */
export const termField = (
  key: string,
  value: string | undefined | null,
  options?: { tsDoc?: string | null; comma?: boolean },
) => {
  if (value === undefined || value === ``) return ``
  return `${options?.tsDoc ? `${options.tsDoc}\n` : ``}${key}: ${String(value)}${(options?.comma ?? true) ? `,` : ``}`
}
