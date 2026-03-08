/**
 * TypeScript code generation utilities.
 *
 * Provides functions for generating TypeScript syntax elements like
 * types, interfaces, imports, exports, and object literals.
 *
 * Features universal composability - most functions accept string | TermObject.
 *
 * @module
 */

import { Tsdoc as TSDoc } from '../tsdoc/_.js'
import * as Reserved from './reserved.js'
import type { DirectiveField, TermObject, TermObjectLike } from './term-object.js'
import * as TermObjectModule from './term-object.js'

// ============================================================================
// Literals
// ============================================================================

/**
 * Quote a string value for TypeScript code.
 *
 * @example
 * ```ts
 * string('hello')
 * // '"hello"'
 * ```
 */
export const string = (str: string): string => `"${str}"`

/**
 * Generate an array literal.
 *
 * @example
 * ```ts
 * arrayLiteral(['a', 'b', 'c'])
 * // '[a, b, c]'
 *
 * arrayLiteral([])
 * // '[]'
 * ```
 */
export const arrayLiteral = (items: string[]): string => `[${items.join(`, `)}]`

/**
 * @deprecated Use {@link arrayLiteral} instead.
 * Kept for backwards compatibility.
 */
export const list = arrayLiteral

/**
 * Generate an array type (Array<T> syntax).
 *
 * @example
 * ```ts
 * arrayType('string')
 * // 'Array<string>'
 *
 * arrayType('User')
 * // 'Array<User>'
 *
 * // Nested arrays
 * arrayType(arrayType('string'))
 * // 'Array<Array<string>>'
 * ```
 */
export const arrayType = (elementType: string): string => `Array<${elementType}>`

/**
 * Wrap content in curly braces.
 *
 * @example
 * ```ts
 * block('a: string')
 * // '{\na: string\n}'
 * ```
 */
export const block = (content: string): string => `{\n${content}\n}`

// ============================================================================
// Objects
// ============================================================================

/**
 * Generate a TypeScript object literal or type.
 *
 * Supports multiple input formats for maximum flexibility:
 * - Plain object: `{ name: 'string', age: 'number' }`
 * - Tuple array: `[['name', 'string'], ['age', 'number']]`
 * - Directive object with $spread, $fields, $literal
 * - Nested objects for composition
 *
 * @example
 * ```ts
 * // From plain object
 * object({ id: 'string', name: 'string' })
 * // '{\nid: string,\nname: string\n}'
 *
 * // From tuples
 * object([['id', 'string'], ['name', 'string']])
 * // '{\nid: string,\nname: string\n}'
 *
 * // With spread
 * object({
 *   $spread: ['BaseType'],
 *   $fields: { id: 'string' }
 * })
 * // '{\n...BaseType,\nid: string\n}'
 *
 * // Nested composition
 * object({
 *   user: object({ id: 'string', name: 'string' }),
 *   meta: object({ created: 'Date' })
 * })
 * ```
 */
export const object = (input: TermObjectLike): string => TermObjectModule.termObject(input)

/**
 * Create a directive field with metadata (TSDoc, optional, readonly).
 *
 * @example
 * ```ts
 * object({
 *   id: objectField$({
 *     value: 'string',
 *     tsDoc: 'User ID',
 *     optional: false
 *   })
 * })
 * ```
 */
export const objectField$ = (input: {
  tsDoc?: null | string
  optional?: boolean
  value: string | TermObject
}): DirectiveField => {
  return TermObjectModule.objectField$(input as any) as any
}

/**
 * Generate a boolean literal.
 *
 * @example
 * ```ts
 * boolean(true)
 * // 'true'
 *
 * boolean(false)
 * // 'false'
 * ```
 */
export const boolean = (value: boolean): string => (value ? `true` : `false`)

/**
 * Generate a number literal.
 *
 * @example
 * ```ts
 * number(42)
 * // '42'
 *
 * number(3.14)
 * // '3.14'
 * ```
 */
export const number = (value: number): string => String(value)

/**
 * Generate a null literal.
 *
 * @example
 * ```ts
 * nullLiteral()
 * // 'null'
 * ```
 */
export const nullLiteral = (): string => `null`

/**
 * Generate an undefined literal.
 *
 * @example
 * ```ts
 * undefinedLiteral()
 * // 'undefined'
 * ```
 */
export const undefinedLiteral = (): string => `undefined`

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Generate a type alias.
 *
 * @param name - Type name
 * @param type - Type expression
 * @returns Type alias declaration
 *
 * @example
 * ```ts
 * typeAlias('UserId', 'string')
 * // 'type UserId = string'
 *
 * typeAlias('Point', '{ x: number; y: number }')
 * // 'type Point = { x: number; y: number }'
 * ```
 */
export const typeAlias = (name: string, type: string): string => {
  return `type ${name} = ${type}`
}

/**
 * Options for generating a type alias with metadata.
 */
export interface TypeAliasOptions {
  /**
   * Type name
   */
  name: string

  /**
   * Type expression (string or TermObject for object types)
   */
  type: string | TermObject

  /**
   * Optional JSDoc comment content (will be formatted automatically)
   */
  tsDoc?: string | null

  /**
   * Optional type parameters (e.g., `['T', 'U extends string']`)
   */
  parameters?: string[] | string | null

  /**
   * Whether to export the type (default: true)
   */
  export?: boolean
}

/**
 * Generate a type alias with optional JSDoc and type parameters.
 *
 * Accepts TermObject for type parameter to enable composition.
 *
 * @example
 * ```ts
 * typeAliasWithOptions({
 *   name: 'Result',
 *   type: 'T | Error',
 *   parameters: ['T'],
 *   tsDoc: 'A result that may be successful or an error',
 *   export: true
 * })
 * // /**
 * //  * A result that may be successful or an error
 * //  *\/
 * // export type Result<T> = T | Error
 *
 * // With TermObject
 * typeAliasWithOptions({
 *   name: 'User',
 *   type: object({ id: 'string', name: 'string' }),
 *   export: true
 * })
 * ```
 */
export const typeAliasWithOptions = (options: TypeAliasOptions): string => {
  const { name, type, tsDoc = null, parameters = null, export: shouldExport = true } = options

  const tsDocFormatted = tsDoc ? TSDoc.format(tsDoc) + `\n` : ``
  const exportKeyword = shouldExport ? `export ` : ``
  const params = parameters
    ? typeof parameters === 'string'
      ? parameters
      : parameters.length > 0
        ? `<${parameters.join(`, `)}>`
        : ``
    : ``
  const type_ = typeof type === 'string' ? type : TermObjectModule.termObject(type)

  const escapedName = Reserved.escapeReserved(name)
  const isReserved = escapedName !== name

  if (isReserved) {
    // Reserved keyword - use re-export pattern
    return `${tsDocFormatted}type ${escapedName}${params} = ${type_}\nexport { type ${escapedName} as ${name} }`
  }

  return `${tsDocFormatted}${exportKeyword}type ${escapedName}${params} = ${type_}`
}

/**
 * Alias for {@link typeAliasWithOptions} with `$` suffix to indicate it returns Raw-compatible string.
 *
 * @example
 * ```ts
 * const userType = typeAlias$({
 *   name: 'User',
 *   type: object({ id: 'string' }),
 *   export: true
 * })
 * ```
 */
export const typeAlias$ = typeAliasWithOptions

/**
 * Options for generating an interface.
 */
export interface InterfaceOptions {
  /**
   * Interface name
   */
  name: string

  /**
   * Interface body (fields) - accepts string, TermObject, or tuples
   */
  block?: string | TermObject | [string, string | DirectiveField][]

  /**
   * Optional JSDoc comment content (will be formatted automatically)
   */
  tsDoc?: string | null

  /**
   * Optional type parameters (e.g., `['T', 'U extends string']`)
   */
  parameters?: string[] | string | null

  /**
   * Optional extends clause (e.g., `['Base', 'Mixin']`)
   */
  extends?: string[] | string | null

  /**
   * Whether to export the interface (default: true)
   */
  export?: boolean
}

/**
 * Generate an interface declaration.
 *
 * Accepts TermObject or plain objects for the block parameter to enable composition.
 *
 * @example
 * ```ts
 * interfaceDecl({
 *   name: 'User',
 *   block: 'id: string\nname: string',
 *   tsDoc: 'Represents a user',
 *   export: true
 * })
 * // /**
 * //  * Represents a user
 * //  *\/
 * // export interface User {
 * //   id: string
 * //   name: string
 * // }
 *
 * // With plain object
 * interfaceDecl({
 *   name: 'User',
 *   block: { id: 'string', name: 'string' },
 *   export: true
 * })
 *
 * // With tuples
 * interfaceDecl({
 *   name: 'Point',
 *   block: [['x', 'number'], ['y', 'number']]
 * })
 * ```
 */
export const interfaceDecl = (options: InterfaceOptions): string => {
  const {
    name,
    block: blockContent,
    tsDoc = null,
    parameters = null,
    extends: extendsClause = null,
    export: shouldExport = true,
  } = options

  const tsDocFormatted = tsDoc ? TSDoc.format(tsDoc) + `\n` : ``
  const typeParams = parameters
    ? typeof parameters === 'string'
      ? parameters
      : parameters.length > 0
        ? `<${parameters.join(`, `)}>`
        : ``
    : ``
  const extendsStr = extendsClause
    ? typeof extendsClause === 'string'
      ? ` extends ${extendsClause}`
      : extendsClause.length > 0
        ? ` extends ${extendsClause.join(`, `)}`
        : ``
    : ``

  let blockFormatted: string
  if (!blockContent) {
    blockFormatted = `{}`
  } else if (typeof blockContent === 'string') {
    blockFormatted = block(blockContent)
  } else if (Array.isArray(blockContent)) {
    blockFormatted = TermObjectModule.termObject(Object.fromEntries(blockContent))
  } else {
    blockFormatted = TermObjectModule.termObject(blockContent)
  }

  const escapedName = Reserved.escapeReserved(name)
  const isReserved = escapedName !== name

  const interfaceDeclaration = `interface ${escapedName}${typeParams}${extendsStr} ${blockFormatted}`

  if (!shouldExport) {
    return tsDocFormatted + interfaceDeclaration
  }

  if (isReserved) {
    // Reserved keyword - use re-export pattern
    return `${tsDocFormatted}${interfaceDeclaration}\nexport { type ${escapedName} as ${name} }`
  }

  return `${tsDocFormatted}export ${interfaceDeclaration}`
}

/**
 * Alias for {@link interfaceDecl} with `$` suffix to indicate it returns Raw-compatible string.
 *
 * @example
 * ```ts
 * const userInterface = interface$({
 *   name: 'User',
 *   block: { id: 'string' },
 *   export: true
 * })
 * ```
 */
export const interface$ = interfaceDecl

/**
 * Generate a union type alias.
 *
 * @example
 * ```ts
 * union('Status', ['Active', 'Inactive', 'Pending'])
 * // 'type Status =\n| Active\n| Inactive\n| Pending'
 * ```
 */
export const union = (name: string, types: string[]): string =>
  `type ${name} =\n| ${types.filter(Boolean).join(`\n| `)}`

/**
 * Generate union items without the type wrapper.
 *
 * @example
 * ```ts
 * unionItems(['string', 'number', null])
 * // 'string\n| number'
 * ```
 */
export const unionItems = (types: (string | null)[]): string =>
  types.filter((t) => t !== null).join(`\n| `)

/**
 * Generate a tuple type.
 *
 * @example
 * ```ts
 * tuple(['string', 'number', 'boolean'])
 * // '[string, number, boolean]'
 * ```
 */
export const tuple = (types: string[]): string => `[${types.join(`, `)}]`

/**
 * Make a type nullable.
 *
 * @example
 * ```ts
 * nullable('string')
 * // 'string | null'
 * ```
 */
export const nullable = (type: string): string => `${type} | null`

/**
 * Create an intersection type.
 *
 * @example
 * ```ts
 * intersection('Base', 'Mixin')
 * // 'Base & Mixin'
 * ```
 */
export const intersection = (a: string, b: string): string => `${a} & ${b}`

/**
 * Generate a conditional type.
 *
 * @example
 * ```ts
 * conditional('T', 'string', 'number', 'boolean')
 * // 'T extends string ? number : boolean'
 * ```
 */
export const conditional = (
  check: string,
  extends_: string,
  trueType: string,
  falseType: string,
): string => `${check} extends ${extends_} ? ${trueType} : ${falseType}`

/**
 * Generate a mapped type.
 *
 * @example
 * ```ts
 * mapped('K', 'keyof T', 'T[K]')
 * // '{ [K in keyof T]: T[K] }'
 * ```
 */
export const mapped = (key: string, constraint: string, value: string): string =>
  `{ [${key} in ${constraint}]: ${value} }`

/**
 * Generate a template literal type.
 *
 * @example
 * ```ts
 * templateLiteral(['Hello ', '${T}', '!'])
 * // '`Hello ${T}!`'
 * ```
 */
export const templateLiteral = (parts: string[]): string => `\`${parts.join(``)}\``

// ============================================================================
// Type Operators
// ============================================================================

/**
 * Generate a typeof operator.
 *
 * @example
 * ```ts
 * typeOf('value')
 * // 'typeof value'
 * ```
 */
export const typeOf = (expression: string): string => `typeof ${expression}`

/**
 * Generate a keyof operator.
 *
 * @example
 * ```ts
 * keyOf('User')
 * // 'keyof User'
 * ```
 */
export const keyOf = (type: string): string => `keyof ${type}`

/**
 * Generate an indexed access type.
 *
 * @example
 * ```ts
 * indexedAccess('User', 'id')
 * // 'User["id"]'
 * ```
 */
export const indexedAccess = (type: string, key: string): string => `${type}["${key}"]`

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generate a Partial utility type.
 *
 * @example
 * ```ts
 * partial('User')
 * // 'Partial<User>'
 * ```
 */
export const partial = (type: string): string => `Partial<${type}>`

/**
 * Generate a Required utility type.
 *
 * @example
 * ```ts
 * required('User')
 * // 'Required<User>'
 * ```
 */
export const required = (type: string): string => `Required<${type}>`

/**
 * Generate a Readonly utility type.
 *
 * @example
 * ```ts
 * readonly('User')
 * // 'Readonly<User>'
 * ```
 */
export const readonly = (type: string): string => `Readonly<${type}>`

/**
 * Generate a Pick utility type.
 *
 * @example
 * ```ts
 * pick('User', ['id', 'name'])
 * // 'Pick<User, "id" | "name">'
 * ```
 */
export const pick = (type: string, keys: string[]): string =>
  `Pick<${type}, ${keys.map((k) => `"${k}"`).join(` | `)}>`

/**
 * Generate an Omit utility type.
 *
 * @example
 * ```ts
 * omit('User', ['password'])
 * // 'Omit<User, "password">'
 * ```
 */
export const omit = (type: string, keys: string[]): string =>
  `Omit<${type}, ${keys.map((k) => `"${k}"`).join(` | `)}>`

/**
 * Generate a Record utility type.
 *
 * @example
 * ```ts
 * record('string', 'number')
 * // 'Record<string, number>'
 * ```
 */
export const record = (keyType: string, valueType: string): string =>
  `Record<${keyType}, ${valueType}>`

// ============================================================================
// Exports
// ============================================================================

/**
 * Generate an export declaration.
 *
 * @example
 * ```ts
 * exportDecl('const foo = 1')
 * // 'export const foo = 1'
 * ```
 */
export const exportDecl = (declaration: string): string => {
  return `export ${declaration}`
}

/**
 * Re-export all exports from a module.
 *
 * @example
 * ```ts
 * reexportAll({ from: './path' })
 * // 'export * from './path''
 *
 * reexportAll({ from: './path', type: true })
 * // 'export type * from './path''
 * ```
 */
export const reexportAll = (input: { from: string; type?: boolean }): string => {
  const typePrefix = input.type ? 'type ' : ''
  return `export ${typePrefix}* from '${input.from}'`
}

/**
 * Re-export all exports as a namespace.
 *
 * @example
 * ```ts
 * reexportNamespace({ as: 'Name', from: './path' })
 * // 'export * as Name from './path''
 *
 * reexportNamespace({ as: 'Name', from: './path', type: true })
 * // 'export type * as Name from './path''
 * ```
 */
export const reexportNamespace = (input: { as: string; from: string; type?: boolean }): string => {
  const typePrefix = input.type ? 'type ' : ''
  return `export ${typePrefix}* as ${input.as} from '${input.from}'`
}

/**
 * Re-export named exports from a module.
 * Supports simple names, arrays, and aliased names.
 *
 * @example
 * ```ts
 * // export { Name } from './path'
 * reexportNamed({ names: 'Name', from: './path' })
 *
 * // export { a, b, c } from './path'
 * reexportNamed({ names: ['a', 'b', 'c'], from: './path' })
 *
 * // export { oldName as newName } from './path'
 * reexportNamed({ names: { oldName: 'newName' }, from: './path' })
 *
 * // export type { Name } from './path'
 * reexportNamed({ names: 'Name', from: './path', type: true })
 * ```
 */
export const reexportNamed = (input: {
  names: string | string[] | Record<string, string>
  from: string
  type?: boolean
}): string => {
  const typePrefix = input.type ? 'type ' : ''

  let namesStr: string
  if (typeof input.names === 'string') {
    namesStr = input.names
  } else if (Array.isArray(input.names)) {
    namesStr = input.names.join(', ')
  } else {
    // Object format: { oldName: 'newName' }
    namesStr = Object.entries(input.names)
      .map(([oldName, newName]) => `${oldName} as ${newName}`)
      .join(', ')
  }

  return `export ${typePrefix}{ ${namesStr} } from '${input.from}'`
}

// ============================================================================
// Namespaces
// ============================================================================

/**
 * Generate a namespace declaration.
 *
 * @param name - Namespace name
 * @param content - Namespace content
 * @param options - Options
 * @param options.escapeReserved - Whether to escape reserved keywords (default: true)
 * @param options.export - Whether to export the namespace (default: false)
 *
 * @example
 * ```ts
 * namespace('Utils', 'export const foo = 1')
 * // 'namespace Utils {\nexport const foo = 1\n}'
 *
 * namespace('interface', 'export const foo = 1', { escapeReserved: true })
 * // 'namespace $interface {\nexport const foo = 1\n}'
 *
 * namespace('Utils', 'export const foo = 1', { export: true })
 * // 'export namespace Utils {\nexport const foo = 1\n}'
 * ```
 */
export const namespace = (
  name: string,
  content: string,
  options?: { escapeReserved?: boolean; export?: boolean },
): string => {
  const shouldEscape = options?.escapeReserved ?? true
  const name_ = shouldEscape ? Reserved.escapeReserved(name) : name
  const exportPrefix = options?.export ? `export ` : ``
  return `${exportPrefix}namespace ${name_} {\n${content}\n}`
}

// ============================================================================
// Expressions
// ============================================================================

/**
 * Generate a property access expression.
 *
 * @example
 * ```ts
 * propertyAccess('Math', 'PI')
 * // 'Math.PI'
 * ```
 */
export const propertyAccess = (object: string, property: string): string => `${object}.${property}`

// ============================================================================
// Variable Declarations
// ============================================================================

/**
 * Generate a const declaration.
 *
 * Accepts TermObject for value parameter to enable composition.
 *
 * @example
 * ```ts
 * constDecl('foo', '1')
 * // 'const foo = 1'
 *
 * constDecl('user', object({ id: '"123"', name: '"Alice"' }))
 * // 'const user = {\n  id: "123",\n  name: "Alice"\n}'
 * ```
 */
export const constDecl = (name: string, value: string | TermObject): string => {
  const value_ = typeof value === 'string' ? value : TermObjectModule.termObject(value)
  return `const ${name} = ${value_}`
}

/**
 * Generate a typed const declaration.
 *
 * Accepts TermObject for value parameter to enable composition.
 *
 * @example
 * ```ts
 * constDeclTyped('foo', 'number', '1')
 * // 'const foo: number = 1'
 *
 * constDeclTyped('config', 'Config', object({ timeout: '5000' }))
 * // 'const config: Config = {\n  timeout: 5000\n}'
 * ```
 */
export const constDeclTyped = (name: string, type: string, value: string | TermObject): string => {
  const value_ = typeof value === 'string' ? value : TermObjectModule.termObject(value)
  return `const ${name}: ${type} = ${value_}`
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Options for generating a function declaration.
 */
export interface FunctionDeclOptions {
  /**
   * Function name
   */
  name: string

  /**
   * Parameters as strings (e.g., ['a: number', 'b: string'])
   */
  params?: string[]

  /**
   * Return type
   */
  returnType?: string | null

  /**
   * Function body
   */
  body?: string | null

  /**
   * Whether the function is async
   */
  async?: boolean

  /**
   * Whether to export the function
   */
  export?: boolean

  /**
   * Optional JSDoc comment
   */
  tsDoc?: string | null
}

/**
 * Generate a function declaration.
 *
 * @example
 * ```ts
 * functionDecl({
 *   name: 'add',
 *   params: ['a: number', 'b: number'],
 *   returnType: 'number',
 *   body: 'return a + b'
 * })
 * // 'function add(a: number, b: number): number {\nreturn a + b\n}'
 * ```
 */
export const functionDecl = (options: FunctionDeclOptions): string => {
  const {
    name,
    params = [],
    returnType = null,
    body = null,
    async: isAsync = false,
    export: shouldExport = false,
    tsDoc = null,
  } = options

  const tsDocFormatted = tsDoc ? TSDoc.format(tsDoc) + `\n` : ``
  const exportKeyword = shouldExport ? `export ` : ``
  const asyncKeyword = isAsync ? `async ` : ``
  const returnTypeStr = returnType ? `: ${returnType}` : ``
  const paramsStr = params.join(`, `)
  const bodyStr = body ? ` {\n${body}\n}` : ` {}`

  return `${tsDocFormatted}${exportKeyword}${asyncKeyword}function ${name}(${paramsStr})${returnTypeStr}${bodyStr}`
}

/**
 * Generate an arrow function expression.
 *
 * @example
 * ```ts
 * arrowFunction(['x'], 'x * 2')
 * // '(x) => x * 2'
 *
 * arrowFunction(['a: number', 'b: number'], 'return a + b', 'number')
 * // '(a: number, b: number): number => return a + b'
 * ```
 */
export const arrowFunction = (params: string[], body: string, returnType?: string): string => {
  const paramsStr =
    params.length === 1 && params[0] && !params[0].includes(`:`)
      ? params[0]
      : `(${params.join(`, `)})`
  const returnTypeStr = returnType ? `: ${returnType}` : ``
  return `${paramsStr}${returnTypeStr} => ${body}`
}

// ============================================================================
// Classes
// ============================================================================

/**
 * Options for generating a class declaration.
 */
export interface ClassDeclOptions {
  /**
   * Class name
   */
  name: string

  /**
   * Class body
   */
  body?: string | null

  /**
   * Extends clause
   */
  extends?: string | null

  /**
   * Implements clause
   */
  implements?: string[] | null

  /**
   * Type parameters
   */
  parameters?: string[] | null

  /**
   * Whether to export the class
   */
  export?: boolean

  /**
   * Whether the class is abstract
   */
  abstract?: boolean

  /**
   * Optional JSDoc comment
   */
  tsDoc?: string | null
}

/**
 * Generate a class declaration.
 *
 * @example
 * ```ts
 * classDecl({
 *   name: 'User',
 *   body: 'constructor(public id: string) {}'
 * })
 * // 'class User {\nconstructor(public id: string) {}\n}'
 * ```
 */
export const classDecl = (options: ClassDeclOptions): string => {
  const {
    name,
    body = null,
    extends: extendsClause = null,
    implements: implementsClause = null,
    parameters = null,
    export: shouldExport = false,
    abstract: isAbstract = false,
    tsDoc = null,
  } = options

  const tsDocFormatted = tsDoc ? TSDoc.format(tsDoc) + `\n` : ``
  const exportKeyword = shouldExport ? `export ` : ``
  const abstractKeyword = isAbstract ? `abstract ` : ``
  const typeParams = parameters && parameters.length > 0 ? `<${parameters.join(`, `)}>` : ``
  const extendsStr = extendsClause ? ` extends ${extendsClause}` : ``
  const implementsStr =
    implementsClause && implementsClause.length > 0
      ? ` implements ${implementsClause.join(`, `)}`
      : ``
  const bodyStr = body ? ` {\n${body}\n}` : ` {}`

  return `${tsDocFormatted}${exportKeyword}${abstractKeyword}class ${name}${typeParams}${extendsStr}${implementsStr}${bodyStr}`
}

// ============================================================================
// Control Flow & Expressions
// ============================================================================

/**
 * Generate an if statement.
 *
 * @example
 * ```ts
 * ifStatement('x > 0', 'return true', 'return false')
 * // 'if (x > 0) {\nreturn true\n} else {\nreturn false\n}'
 * ```
 */
export const ifStatement = (condition: string, thenBlock: string, elseBlock?: string): string => {
  const elseStr = elseBlock ? ` else {\n${elseBlock}\n}` : ``
  return `if (${condition}) {\n${thenBlock}\n}${elseStr}`
}

/**
 * Generate a ternary expression.
 *
 * @example
 * ```ts
 * ternary('x > 0', 'positive', 'negative')
 * // 'x > 0 ? positive : negative'
 * ```
 */
export const ternary = (condition: string, trueValue: string, falseValue: string): string =>
  `${condition} ? ${trueValue} : ${falseValue}`

/**
 * Generate a function call.
 *
 * @example
 * ```ts
 * call('add', ['1', '2'])
 * // 'add(1, 2)'
 * ```
 */
export const call = (fn: string, args: string[]): string => `${fn}(${args.join(`, `)})`

/**
 * Generate a method call.
 *
 * @example
 * ```ts
 * methodCall('console', 'log', ['"hello"'])
 * // 'console.log("hello")'
 * ```
 */
export const methodCall = (object: string, method: string, args: string[]): string =>
  `${object}.${method}(${args.join(`, `)})`

// ============================================================================
// Object Members
// ============================================================================

/**
 * Options for generating a field/property in an interface or type.
 */
export interface FieldOptions {
  /**
   * Optional JSDoc comment content (will be formatted automatically)
   */
  tsDoc?: string | null

  /**
   * Whether the field is optional (adds `?`)
   */
  optional?: boolean

  /**
   * Whether the field is readonly (adds `readonly `)
   */
  readonly?: boolean
}

/**
 * Generate a field/property for an interface or object type.
 *
 * Accepts TermObject for type parameter to enable composition.
 *
 * @param name - Field name
 * @param type - Field type (string or TermObject for nested objects)
 * @param options - Optional modifiers and documentation
 * @returns Formatted field declaration
 *
 * @example
 * ```ts
 * field('id', 'string')
 * // 'id: string'
 *
 * field('name', 'string', { optional: true })
 * // 'name?: string'
 *
 * field('data', 'Data', { readonly: true })
 * // 'readonly data: Data'
 *
 * field('user', object({ id: 'string', name: 'string' }))
 * // 'user: {\n  id: string,\n  name: string\n}'
 *
 * field('value', 'number', {
 *   readonly: true,
 *   optional: true,
 *   tsDoc: 'The current value'
 * })
 * // /**
 * //  * The current value
 * //  *\/
 * // readonly value?: number
 * ```
 */
export const field = (name: string, type: string | TermObject, options?: FieldOptions): string => {
  const tsDocFormatted = options?.tsDoc ? TSDoc.format(options.tsDoc) + `\n` : ``
  const readonlyModifier = options?.readonly ? `readonly ` : ``
  const optionalModifier = options?.optional ? `?` : ``
  const type_ = typeof type === 'string' ? type : TermObjectModule.termObject(type)
  return `${tsDocFormatted}${readonlyModifier}${name}${optionalModifier}: ${type_}`
}

/**
 * Join field declarations with newlines.
 *
 * @example
 * ```ts
 * fields(['a: string', 'b: number'])
 * // 'a: string\nb: number'
 * ```
 */
export const fields = (fieldDecls: string[]): string => fieldDecls.join(`\n`)

/**
 * @deprecated Use {@link block} directly instead.
 * This function is just an alias for block() and is kept for backwards compatibility.
 *
 * @example
 * ```ts
 * objectFromFields('a: string\nb: number')
 * // '{\na: string\nb: number\n}'
 * ```
 */
export const objectFromFields = block

// ============================================================================
// Imports
// ============================================================================

/**
 * Import all exports as a namespace.
 *
 * @example
 * ```ts
 * importAll({ as: 'Name', from: './path' })
 * // 'import * as Name from './path''
 *
 * importAll({ as: 'Name', from: './path', type: true })
 * // 'import type * as Name from './path''
 * ```
 */
export const importAll = (input: { as: string; from: string; type?: boolean }): string => {
  const typePrefix = input.type ? 'type ' : ''
  return `import ${typePrefix}* as ${input.as} from '${input.from}'`
}

/**
 * Import named exports from a module.
 * Supports simple names, arrays, and aliased names.
 *
 * @example
 * ```ts
 * // import { Name } from './path'
 * importNamed({ names: 'Name', from: './path' })
 *
 * // import { a, b, c } from './path'
 * importNamed({ names: ['a', 'b', 'c'], from: './path' })
 *
 * // import { oldName as newName } from './path'
 * importNamed({ names: { oldName: 'newName' }, from: './path' })
 *
 * // import type { Name } from './path'
 * importNamed({ names: 'Name', from: './path', type: true })
 * ```
 */
export const importNamed = (input: {
  names: string | string[] | Record<string, string>
  from: string
  type?: boolean
}): string => {
  const typePrefix = input.type ? 'type ' : ''

  let namesStr: string
  if (typeof input.names === 'string') {
    namesStr = input.names
  } else if (Array.isArray(input.names)) {
    namesStr = input.names.join(', ')
  } else {
    // Object format: { oldName: 'newName' }
    namesStr = Object.entries(input.names)
      .map(([oldName, newName]) => `${oldName} as ${newName}`)
      .join(', ')
  }

  return `import ${typePrefix}{ ${namesStr} } from '${input.from}'`
}

// ============================================================================
// Builder Pattern
// ============================================================================

/**
 * Builder for creating union type declarations with a fluent API.
 */
class UnionBuilder {
  private constructor(
    private name: string,
    private variants: string[] = [],
  ) {}

  /**
   * Add a variant to the union.
   */
  variant(type: string): this {
    this.variants.push(type)
    return this
  }

  /**
   * Build the union type declaration.
   */
  build(): string {
    return union(this.name, this.variants)
  }

  /**
   * Create a new union builder.
   */
  static create(name: string): UnionBuilder {
    return new UnionBuilder(name)
  }
}

/**
 * Builder for creating object type declarations with a fluent API.
 */
class ObjectBuilder {
  private constructor(private fields_: string[] = []) {}

  /**
   * Add a field to the object.
   */
  field(name: string, type: string, options?: FieldOptions): this {
    this.fields_.push(field(name, type, options))
    return this
  }

  /**
   * Build the object type as a string of fields.
   */
  buildFields(): string {
    return fields(this.fields_)
  }

  /**
   * Build the object type wrapped in braces.
   */
  build(): string {
    return objectFromFields(this.buildFields())
  }

  /**
   * Create a new object builder.
   */
  static create(): ObjectBuilder {
    return new ObjectBuilder()
  }
}

/**
 * Builder for creating interface declarations with a fluent API.
 */
class InterfaceBuilder {
  private constructor(
    private name: string,
    private fields_: string[] = [],
    private options: Partial<InterfaceOptions> = {},
  ) {}

  /**
   * Add a field to the interface.
   */
  field(name: string, type: string, options?: FieldOptions): this {
    this.fields_.push(field(name, type, options))
    return this
  }

  /**
   * Set the extends clause.
   */
  extends(...types: string[]): this {
    this.options.extends = types
    return this
  }

  /**
   * Set type parameters.
   */
  parameters(...params: string[]): this {
    this.options.parameters = params
    return this
  }

  /**
   * Set JSDoc comment.
   */
  tsDoc(doc: string): this {
    this.options.tsDoc = doc
    return this
  }

  /**
   * Set export modifier.
   */
  export(shouldExport = true): this {
    this.options.export = shouldExport
    return this
  }

  /**
   * Build the interface declaration.
   */
  build(): string {
    return interfaceDecl({
      name: this.name,
      block: fields(this.fields_),
      ...this.options,
    })
  }

  /**
   * Create a new interface builder.
   */
  static create(name: string): InterfaceBuilder {
    return new InterfaceBuilder(name)
  }
}

/**
 * Type builder namespace providing fluent APIs for complex type construction.
 *
 * @example
 * ```ts
 * // Union type
 * Type.union('Status')
 *   .variant('Active')
 *   .variant('Inactive')
 *   .build()
 * // 'type Status =\n| Active\n| Inactive'
 *
 * // Object type
 * Type.object()
 *   .field('id', 'string')
 *   .field('name', 'string', { optional: true })
 *   .build()
 * // '{\nid: string\nname?: string\n}'
 *
 * // Interface
 * Type.interface('User')
 *   .field('id', 'string')
 *   .field('name', 'string')
 *   .export()
 *   .build()
 * // 'export interface User {\nid: string\nname: string\n}'
 * ```
 */
export const Type = {
  /**
   * Create a union type builder.
   */
  union: (name: string) => UnionBuilder.create(name),

  /**
   * Create an object type builder.
   */
  object: () => ObjectBuilder.create(),

  /**
   * Create an interface declaration builder.
   */
  interface: (name: string) => InterfaceBuilder.create(name),
} as const
