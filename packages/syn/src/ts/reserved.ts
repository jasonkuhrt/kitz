/**
 * TypeScript/JavaScript reserved keyword handling for code generation.
 *
 * Provides utilities for escaping reserved keywords, exporting declarations
 * with keyword-safe names, and dual export patterns (const + type).
 *
 * @module
 */

import { Tsdoc as TSDoc } from '../tsdoc/_.js'

// ============================================================================
// Reserved Keyword Lists
// ============================================================================

/**
 * JavaScript reserved keywords that cannot be used as identifiers in any context.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words
 */
export const reservedJavaScriptKeywords = [
  `break`,
  `case`,
  `catch`,
  `class`,
  `const`,
  `continue`,
  `debugger`,
  `default`,
  `delete`,
  `do`,
  `else`,
  `enum`,
  `export`,
  `extends`,
  `false`,
  `finally`,
  `for`,
  `function`,
  `if`,
  `import`,
  `in`,
  `instanceof`,
  `new`,
  `null`,
  `return`,
  `super`,
  `switch`,
  `this`,
  `throw`,
  `true`,
  `try`,
  `typeof`,
  `var`,
  `void`,
  `while`,
  `with`,
  `implements`,
  `interface`,
  `let`,
  `package`,
  `private`,
  `protected`,
  `public`,
  `static`,
  `yield`,
] as const

/**
 * TypeScript type keywords that would shadow built-in types if used as type names.
 */
export const reservedTypeScriptTypeNames = [
  `any`,
  `as`,
  `boolean`,
  `bigint`,
  `never`,
  `number`,
  `object`,
  `string`,
  `symbol`,
  `undefined`,
  `unknown`,
  `void`,
] as const

/**
 * Combined list of reserved names for general identifier checking (type and value contexts).
 * Includes JavaScript keywords, TypeScript type names, and special iterator keyword.
 */
export const reservedNames = [
  ...reservedJavaScriptKeywords,
  ...reservedTypeScriptTypeNames,
  `of`, // Iterator keyword
] as const

// ============================================================================
// Escaping
// ============================================================================

/**
 * Options for escaping reserved keywords.
 */
export interface EscapeOptions {
  /**
   * Prefix to add when escaping reserved keywords.
   * @default '$'
   */
  prefix?: string
}

/**
 * Escape a name if it's a reserved TypeScript/JavaScript keyword.
 *
 * @param name - Name to potentially escape
 * @param options - Escape options
 * @returns Escaped name with prefix if reserved, otherwise original name
 *
 * @example
 * ```ts
 * escapeReserved('interface')
 * // '$interface'
 *
 * escapeReserved('MyType')
 * // 'MyType'
 *
 * escapeReserved('class', { prefix: '_' })
 * // '_class'
 * ```
 */
export const escapeReserved = (name: string, options?: EscapeOptions): string => {
  const prefix = options?.prefix ?? `$`
  if (reservedNames.includes(name as any)) {
    return `${prefix}${name}`
  }
  return name
}

// ============================================================================
// Export Helpers
// ============================================================================

/**
 * Export a declaration, handling reserved keywords by using re-export syntax.
 *
 * For reserved keywords: creates internal declaration with escaped name + re-exports with original name.
 * For normal names: uses direct export.
 *
 * @param isType - Whether this is a type export (true) or value export (false)
 * @returns A function that takes (name, declaration) and returns the export string
 *
 * @example
 * ```ts
 * // Type export with reserved keyword
 * const exportType = exportWithKeywordHandling(true)
 * exportType('interface', 'interface $interface { id: string }')
 * // 'interface $interface { id: string }\nexport { type $interface as interface }'
 *
 * // Value export with normal name
 * const exportValue = exportWithKeywordHandling(false)
 * exportValue('MyClass', 'class MyClass {}')
 * // 'export class MyClass {}'
 * ```
 */
export const exportWithKeywordHandling =
  (isType: boolean = true) =>
  (name: string, declaration: string): string => {
    const isReserved = reservedNames.includes(name as any)

    if (isReserved) {
      const escapedName = escapeReserved(name)
      const kindPrefix = isType ? 'type ' : ''
      // Only export the alias, not the escaped declaration itself
      return `${declaration}\nexport { ${kindPrefix}${escapedName} as ${name} }`
    } else {
      return `export ${declaration}`
    }
  }

/**
 * Export a type with keyword handling.
 * Pre-configured {@link exportWithKeywordHandling} with isType=true.
 *
 * @example
 * ```ts
 * exportTypeWithKeywordHandling('interface', 'interface $interface { id: string }')
 * // 'interface $interface { id: string }\nexport { type $interface as interface }'
 * ```
 */
export const exportTypeWithKeywordHandling = exportWithKeywordHandling(true)

/**
 * Export a value with keyword handling.
 * Pre-configured {@link exportWithKeywordHandling} with isType=false.
 *
 * @example
 * ```ts
 * exportValueWithKeywordHandling('class', 'class $class {}')
 * // 'class $class {}\nexport { $class as class }'
 * ```
 */
export const exportValueWithKeywordHandling = exportWithKeywordHandling(false)

// ============================================================================
// Dual Export Pattern
// ============================================================================

/**
 * Input for dual export pattern (const + type with same name).
 */
export interface DualExportInput {
  /**
   * The exported name (may be reserved keyword)
   */
  name: string

  /**
   * Const declaration details
   */
  const: {
    /**
     * Value expression for the const
     */
    value: string

    /**
     * Optional JSDoc comment content (will be formatted automatically)
     */
    tsDoc?: string | null
  }

  /**
   * Type declaration details
   */
  type: {
    /**
     * Type expression
     */
    type: string

    /**
     * Optional JSDoc comment content (will be formatted automatically)
     */
    tsDoc?: string | null
  }
}

/**
 * Result of dual export containing generated code and name info.
 */
export interface DualExportResult {
  /**
   * The exported name (original, possibly reserved)
   */
  exportedName: string

  /**
   * The internal name (escaped if reserved)
   */
  internalName: string

  /**
   * Generated TypeScript code
   */
  code: string
}

/**
 * Export both a const and type with the same name, handling reserved keywords.
 *
 * This is for the dual export pattern where a value and its inferred type share the same name.
 * For reserved keywords, uses: `const $name = value; type $name = typeof value; export { $name as name }`
 * For safe names, uses: `export const name = value; export type name = typeof value`
 *
 * @param input - The const and type declarations
 * @returns Object with exported/internal names and generated code
 *
 * @example
 * ```ts
 * // With reserved keyword
 * dualExport({
 *   name: 'interface',
 *   const: { value: '{ id: "string" }' },
 *   type: { type: '{ id: string }' }
 * })
 * // {
 * //   exportedName: 'interface',
 * //   internalName: '$interface',
 * //   code: 'const $interface = { id: "string" }\ntype $interface = { id: string }\nexport { $interface as interface }'
 * // }
 *
 * // With safe name
 * dualExport({
 *   name: 'MyType',
 *   const: { value: '{ id: "string" }', tsDoc: 'My type instance' },
 *   type: { type: '{ id: string }', tsDoc: 'My type definition' }
 * })
 * // {
 * //   exportedName: 'MyType',
 * //   internalName: 'MyType',
 * //   code: '/**\n * My type instance\n *\/\nexport const MyType = { id: "string" }\n/**\n * My type definition\n *\/\nexport type MyType = { id: string }'
 * // }
 * ```
 */
export const dualExport = (input: DualExportInput): DualExportResult => {
  const escapedName = escapeReserved(input.name)
  const isReserved = escapedName !== input.name

  const constTsDoc = input.const.tsDoc ? TSDoc.format(input.const.tsDoc) + `\n` : ``
  const typeTsDoc = input.type.tsDoc ? TSDoc.format(input.type.tsDoc) + `\n` : ``

  let code: string

  if (isReserved) {
    // Reserved name - use dual export pattern
    code = [
      `${constTsDoc}const ${escapedName} = ${input.const.value}`,
      `${typeTsDoc}type ${escapedName} = ${input.type.type}`,
      `export { ${escapedName} as ${input.name} }`,
    ].join(`\n`)
  } else {
    // Safe name - use direct exports
    code = [
      `${constTsDoc}export const ${input.name} = ${input.const.value}`,
      `${typeTsDoc}export type ${input.name} = ${input.type.type}`,
    ].join(`\n`)
  }

  return {
    exportedName: input.name,
    internalName: escapedName,
    code,
  }
}
