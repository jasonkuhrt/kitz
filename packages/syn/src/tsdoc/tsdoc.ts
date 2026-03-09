/**
 * TSDoc/JSDoc string utilities for code documentation.
 *
 * Provides safe JSDoc generation with automatic escaping, builder API,
 * and structured tag helpers.
 *
 * @module
 */

import { Str } from '@kitz/core'
import * as Md from '../md/_.js'

const splitIntoLines = Str.Text.lines
const joinLines = Str.Text.unlines

// ============================================================================
// Core Formatting
// ============================================================================

/**
 * Escape user-provided content for safe inclusion in JSDoc comments.
 *
 * Escapes characters that could break JSDoc syntax:
 * - `*\/` - Ends the JSDoc comment prematurely
 * - `@tag` at line start - Could be interpreted as JSDoc tags
 *
 * @param content - User-provided text (e.g., GraphQL descriptions)
 * @returns Escaped content safe for JSDoc, or null if input was null/undefined
 *
 * @example
 * ```ts
 * escape('Hello * / World')
 * // 'Hello * / World'
 *
 * escape('@deprecated use new API')
 * // '\\@deprecated use new API'
 * ```
 */
export const escape = (content: string | null | undefined): string | null => {
  if (content === null || content === undefined) return null

  return (
    content
      // Escape */ to prevent closing the JSDoc comment
      .replace(/\*\//g, '* /')
      // Escape @ at line start to prevent unintended JSDoc tags
      // Only escape if followed by common tag names
      .replace(
        /^@(param|returns|deprecated|see|example|link|remarks|throws|since|alpha|beta|public|private|internal)/gm,
        '\\@$1',
      )
  )
}

/**
 * Format content as JSDoc comment block.
 *
 * Takes text content and wraps it in JSDoc syntax with proper indentation.
 * Lines are trimmed and prefixed with JSDoc comment markers.
 * Returns empty string if content is null.
 *
 * @param content - Content to format as JSDoc
 * @returns Formatted JSDoc comment block
 *
 * @example
 * ```ts
 * format('Hello\nWorld')
 * // /**
 * //  * Hello
 * //  * World
 * //  *\/
 *
 * format('Single line')
 * // /**
 * //  * Single line
 * //  *\/
 * ```
 */
export const format = (content: string | null): string => {
  if (content === null) return ``

  const contentLines = splitIntoLines(content)
  const trimmedLines = contentLines.map((line) => line.trim())
  const prefixedLines = trimmedLines.map((line) => (line ? `* ${line}` : `*`))
  const commentContent = joinLines(prefixedLines) || `*`

  return `/**\n${commentContent}\n*/`
}

// ============================================================================
// Type Branding
// ============================================================================

/**
 * Branded type for content marked as safe for JSDoc injection.
 *
 * Use {@link raw} to create values of this type.
 * This prevents accidental injection of unescaped user content.
 */
export interface Raw {
  readonly __jsDocSafe: true
  readonly content: string
}

/**
 * Mark content as safe for JSDoc (already escaped or intentionally raw).
 *
 * Use this for JSDoc tags, links, and other special syntax that should NOT be escaped.
 *
 * @example
 * ```ts
 * // Link will not be escaped
 * const link = raw(`{@link MyType}`)
 * const doc = tag\`Type: ${link}\`
 *
 * // Pre-escaped content
 * const escaped = escape(userInput)
 * const safe = raw(escaped)
 * ```
 */
export const raw = (content: string): Raw => ({
  __jsDocSafe: true as const,
  content,
})

// ============================================================================
// Structured Tag Helpers
// ============================================================================

/**
 * Structured JSDoc tag helpers.
 *
 * These helpers generate properly formatted JSDoc tags with automatic escaping.
 * All helpers return `Raw` (safe for injection) or `null` for graceful handling.
 *
 * @example
 * ```ts
 * tag\`
 *   ${description}
 *   ${tag.deprecated(reason)}
 *   ${tag.see('https://example.com', 'Documentation')}
 * \`
 * ```
 */
export namespace tag {
  /**
   * Generate `@deprecated` tag with escaped reason.
   * Returns null if reason is null/undefined for graceful template handling.
   *
   * @example
   * ```ts
   * tag.deprecated('Use newMethod() instead')
   * // '@deprecated Use newMethod() instead'
   * ```
   */
  export const deprecated = (reason: string | null | undefined): Raw | null => {
    if (!reason) return null
    return raw(`@deprecated ${escape(reason)}`)
  }

  /**
   * Generate `@see` tag with link.
   * Optionally includes display text.
   *
   * @example
   * ```ts
   * tag.see('https://example.com')
   * // '@see {@link https://example.com}'
   *
   * tag.see('https://example.com', 'Documentation')
   * // '@see {@link https://example.com | Documentation}'
   * ```
   */
  export const see = (url: string, text?: string): Raw => {
    return raw(text ? `@see {@link ${url} | ${text}}` : `@see {@link ${url}}`)
  }

  /**
   * Generate inline `{@link}` reference (not a block tag).
   * Use for inline documentation links.
   *
   * @example
   * ```ts
   * tag.link('MyType')
   * // '{@link MyType}'
   *
   * tag.link('MyType', 'the type')
   * // '{@link MyType | the type}'
   * ```
   */
  export const link = (url: string, text?: string): Raw => {
    return raw(text ? `{@link ${url} | ${text}}` : `{@link ${url}}`)
  }

  /**
   * Generate `@example` tag with code block.
   * Automatically wraps code in markdown code fence.
   *
   * @example
   * ```ts
   * tag.example('const x = 1', 'ts')
   * // '@example\n```ts\nconst x = 1\n```'
   * ```
   */
  export const example = (code: string, lang: string = 'ts'): Raw => {
    return raw(`@example\n\`\`\`${lang}\n${code}\n\`\`\``)
  }

  /**
   * Generate `@remarks` tag with escaped content.
   * Returns null if content is null/undefined.
   *
   * @example
   * ```ts
   * tag.remarks('Important note')
   * // '@remarks\nImportant note'
   * ```
   */
  export const remarks = (content: string | null | undefined): Raw | null => {
    if (!content) return null
    return raw(`@remarks\n${escape(content)}`)
  }

  /**
   * Generate `@param` tag with escaped description.
   *
   * @example
   * ```ts
   * tag.param('name', 'The user name')
   * // '@param name - The user name'
   * ```
   */
  export const param = (name: string, description: string): Raw => {
    return raw(`@param ${name} - ${escape(description)}`)
  }

  /**
   * Generate `@returns` tag with escaped description.
   *
   * @example
   * ```ts
   * tag.returns('The result value')
   * // '@returns The result value'
   * ```
   */
  export const returns = (description: string): Raw => {
    return raw(`@returns ${escape(description)}`)
  }
}

// ============================================================================
// Builder Interface
// ============================================================================

/**
 * JSDoc builder interface for imperative JSDoc construction.
 *
 * Provides a fluent API for building JSDoc with conditionals, loops, and tag helpers.
 *
 * @example
 * ```ts
 * const doc = builder()
 *
 * doc\`Main description\`
 * doc\`\`  // blank line
 *
 * if (isDeprecated) {
 *   doc.$deprecated('Use newMethod()')
 * }
 *
 * doc.table({ 'Type': 'string', 'Required': 'Yes' })
 *
 * return doc.build()
 * ```
 */
export interface Builder {
  /**
   * Add a line to the JSDoc. Automatically escapes user content.
   * Use empty template for blank lines: `doc\`\``
   */
  (
    strings: TemplateStringsArray,
    ...values: Array<string | number | Raw | null | undefined>
  ): Builder

  /**
   * Add content with auto-escaping. Skips if null/undefined.
   * Perfect for chaining with optional content.
   * @example
   * ```ts
   * doc
   *   .add(field.description)  // skips if null/undefined
   *   .add('# Info')
   * ```
   */
  add(content: string | null | undefined): Builder

  /**
   * Add raw content without escaping. Skips if null/undefined.
   * Use for pre-escaped content or JSDoc syntax.
   * @example
   * ```ts
   * doc.addRaw(sdlSignature)  // skips if null/undefined
   * ```
   */
  addRaw(content: string | null | undefined): Builder

  /**
   * Add a blank line.
   * @example
   * ```ts
   * doc
   *   .add('First paragraph')
   *   .blank()
   *   .add('Second paragraph')
   * ```
   */
  blank(): Builder

  /**
   * Add a markdown table from key-value pairs.
   * Automatically filters out undefined/null/empty-array values.
   *
   * **Value handling:**
   * - Raw values (from Md.code(), tag.link(), etc.): Used directly, already safe
   * - Plain strings: Automatically escaped for JSDoc safety
   * - Arrays: Items joined with `, ` (each item handled by type)
   * - Empty arrays: Treated as undefined (filtered out)
   *
   * Returns builder for chaining.
   *
   * @example
   * ```ts
   * doc.table({
   *   'Type': Md.code('string'),
   *   'Parent': tag.link('ParentType'),
   *   'Implements': interfaces.map(i => tag.link(i.name)),  // auto-joined
   *   'Description': userDescription  // auto-escaped
   * })
   * ```
   */
  table(rows: Record<string, string | Raw | Array<string | Raw> | undefined | null>): Builder

  /**
   * Add a markdown code block with language syntax highlighting.
   * Skips if content is null/undefined.
   * @example
   * ```ts
   * doc.codeblock('graphql', \`
   *   type User {
   *     id: ID!
   *   }
   * \`)
   * ```
   */
  codeblock(lang: string, content: string | null | undefined): Builder

  /**
   * Add `@deprecated` tag with escaped reason.
   * Returns builder for chaining. Skips if reason is null/undefined.
   */
  $deprecated(reason: string | null | undefined): Builder

  /**
   * Add `@example` tag with code block.
   *
   * **Two modes:**
   * - Template mode (2 params): Returns template function for code content
   * - Direct mode (3 params): Accepts code string directly and returns builder
   *
   * @example
   * ```ts
   * // Template mode
   * doc.$example('Basic usage', 'ts')\`
   *   const result = await api.query()
   * \`
   *
   * // Direct mode
   * const code = 'const x = 1'
   * doc.$example('Basic usage', 'ts', code)
   * ```
   */
  $example(
    label?: string,
    lang?: string,
  ): (strings: TemplateStringsArray, ...values: any[]) => Builder
  $example(label: string | undefined, lang: string, code: string): Builder

  /**
   * Add `@see` tag with link.
   * Returns builder for chaining.
   */
  $see(url: string, text?: string): Builder

  /**
   * Generate inline `{@link}` reference for embedding in templates.
   * Returns Raw (not the builder).
   */
  $link(url: string, text?: string): Raw

  /**
   * Add `@remarks` tag with content from template literal.
   * Returns builder for chaining. Skips if content is empty.
   */
  $remarks(strings: TemplateStringsArray, ...values: any[]): Builder

  /**
   * Build the final JSDoc string with whitespace normalization.
   */
  build(): string
}

/**
 * Create a new JSDoc builder for imperative construction.
 *
 * Perfect for JSDoc generation with conditionals, loops, and complex logic.
 *
 * @example
 * ```ts
 * const doc = builder()
 *
 * doc\`Access to ${typeLink} root methods.\`
 * doc\`\`  // empty line
 *
 * if (showExample) {
 *   doc.$example('Basic usage', 'ts')\`
 *     const result = await api.query()
 *   \`
 * }
 *
 * doc.$deprecated\`Use newMethod() instead\`
 *
 * return doc.build()
 * ```
 */
export const builder = (): Builder => {
  const contentLines: string[] = []

  const addLine = (content: string) => {
    contentLines.push(content)
  }

  // Process template with escaping
  const processTemplate = (
    strings: TemplateStringsArray,
    values: Array<string | number | Raw | null | undefined>,
  ): string => {
    let result = ''
    for (let i = 0; i < strings.length; i++) {
      result += strings[i]
      if (i < values.length) {
        const value = values[i]
        if (value === null || value === undefined) {
          // Skip nullish values
        } else if (typeof value === 'object' && '__jsDocSafe' in value) {
          // Already safe - inject directly
          result += value.content
        } else {
          // Escape user content
          result += escape(String(value)) ?? ''
        }
      }
    }
    return result
  }

  // Main template function
  const builderFn = (
    strings: TemplateStringsArray,
    ...values: Array<string | number | Raw | null | undefined>
  ): Builder => {
    const content = processTemplate(strings, values)
    addLine(content)
    return builderFn
  }

  builderFn.add = (content: string | null | undefined) => {
    if (content !== null && content !== undefined) {
      const escaped = escape(content)
      if (escaped !== null) {
        addLine(escaped)
      }
    }
    return builderFn
  }

  builderFn.addRaw = (content: string | null | undefined) => {
    if (content !== null && content !== undefined) {
      addLine(content)
    }
    return builderFn
  }

  builderFn.blank = () => {
    addLine('')
    return builderFn
  }

  builderFn.table = (
    rows: Record<string, string | Raw | Array<string | Raw> | undefined | null>,
  ) => {
    const entries = Object.entries(rows).filter(
      (entry): entry is [string, string | Raw | Array<string | Raw>] => {
        const value = entry[1]
        // Filter out undefined, null, and empty arrays
        return (
          value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)
        )
      },
    )
    if (entries.length === 0) return builderFn

    addLine(`| | |`)
    addLine(`| - | - |`)
    for (const [key, value] of entries) {
      let valueStr: string

      if (Array.isArray(value)) {
        // Handle array: process each item and join with comma-space
        valueStr = value
          .map((item) => {
            if (typeof item === 'object' && '__jsDocSafe' in item) {
              return item.content
            } else {
              return escape(item) ?? ''
            }
          })
          .join(', ')
      } else if (typeof value === 'object' && '__jsDocSafe' in value) {
        // Handle Raw: use content directly (already safe)
        valueStr = value.content
      } else {
        // Handle plain string: auto-escape for safety
        valueStr = escape(value) ?? ''
      }

      addLine(`| **${key}** | ${valueStr} |`)
    }
    return builderFn
  }

  builderFn.codeblock = (lang: string, content: string | null | undefined) => {
    if (content !== null && content !== undefined && content.trim()) {
      addLine(`\`\`\`${lang}`)
      addLine(content)
      addLine(`\`\`\``)
    }
    return builderFn
  }

  // Attach tag helper methods
  builderFn.$deprecated = (reason: string | null | undefined) => {
    if (reason) {
      addLine(`@deprecated ${escape(reason)}`)
    }
    return builderFn
  }

  builderFn.$example = ((label?: string, lang?: string, code?: string): any => {
    // Direct mode: 3 params with code string
    if (code !== undefined && typeof code === 'string') {
      addLine(label ? `@example ${label}` : `@example`)
      addLine(`\`\`\`${lang ?? 'ts'}`)
      code.split('\n').forEach((line) => addLine(line))
      addLine(`\`\`\``)
      return builderFn
    }

    // Template mode: return template function
    return (strings: TemplateStringsArray, ...values: any[]) => {
      const codeContent = processTemplate(strings as any, values)
      addLine(label ? `@example ${label}` : `@example`)
      addLine(`\`\`\`${lang ?? 'ts'}`)
      codeContent.split('\n').forEach((line) => addLine(line))
      addLine(`\`\`\``)
      return builderFn
    }
  }) as Builder['$example']

  builderFn.$see = (url: string, text?: string) => {
    addLine(text ? `@see {@link ${url} | ${text}}` : `@see {@link ${url}}`)
    return builderFn
  }

  builderFn.$link = (url: string, text?: string) => {
    return raw(text ? `{@link ${url} | ${text}}` : `{@link ${url}}`)
  }

  builderFn.$remarks = (strings: TemplateStringsArray, ...values: any[]) => {
    const content = processTemplate(strings as any, values)
    if (content.trim()) {
      addLine(`@remarks`)
      addLine(content)
    }
    return builderFn
  }

  builderFn.build = () => {
    // Apply whitespace cleanup
    const trimmedLines: string[] = []
    let lastWasEmpty = false

    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i]!.trimStart()
      const isEmpty = line === ''

      // Skip leading empty lines
      if (isEmpty && trimmedLines.length === 0) continue

      // Collapse consecutive empty lines into one
      if (isEmpty && lastWasEmpty) continue

      trimmedLines.push(line)
      lastWasEmpty = isEmpty
    }

    // Remove trailing empty lines
    while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1] === '') {
      trimmedLines.pop()
    }

    return trimmedLines.join('\n')
  }

  return builderFn as Builder
}

// ============================================================================
// Tagged Template
// ============================================================================

/**
 * JSDoc template function type with builder property.
 */
export interface Template {
  /**
   * Tagged template for building JSDoc content with automatic escaping.
   *
   * By default, interpolated values are escaped to prevent JSDoc injection.
   * Use {@link raw} to inject pre-escaped or intentionally raw content.
   *
   * @example
   * ```ts
   * // User content is automatically escaped
   * const doc = tag\`
   *   ${field.description}
   *
   *   @deprecated ${field.deprecationReason}
   * \`
   *
   * // Use raw for links and tags
   * const link = raw(\`{@link User}\`)
   * const doc = tag\`
   *   Field type: ${link}
   *   Description: ${field.description}
   * \`
   * ```
   */
  (
    strings: TemplateStringsArray,
    ...values: Array<string | number | Raw | null | undefined>
  ): string

  /**
   * Create a new JSDoc builder for imperative construction.
   * Perfect for JSDoc generation with conditionals, loops, and complex logic.
   */
  builder: typeof builder

  /**
   * Create a JSDoc generator function from a builder callback.
   * Automatically calls `.build()` and returns the result.
   *
   * @example
   * ```ts
   * export const getFieldDoc = factory<[field: Field, parentType: Type]>((doc, field, parentType) => {
   *   const typeLink = tag.link(field.type.name)
   *
   *   doc\`Selection set for ${typeLink}.\`
   *   doc\`\`
   *   doc.add(field.description)
   *   doc\`\`
   *   doc.table({ 'Type': \`${field.type.name}\` })
   * })
   *
   * // Usage: getFieldDoc(field, parentType) -> string
   * ```
   */
  factory: <$Args extends any[]>(
    fn: (doc: Builder, ...args: $Args) => void,
  ) => (...args: $Args) => string

  /**
   * JSDoc tag helpers for generating properly formatted tags.
   */
  tag: typeof tag
}

/**
 * Tagged template for building JSDoc content with automatic escaping.
 * Also provides `.builder()` for imperative JSDoc construction and `.tag` for tag helpers.
 *
 * @example
 * ```ts
 * // Template mode with auto-escaping
 * const doc = tag\`
 *   Main description here
 *
 *   ${tag.deprecated('Use newMethod()')}
 *   ${tag.see('https://example.com', 'Documentation')}
 * \`
 *
 * // Builder mode for complex logic
 * const doc = tag.builder()
 * doc\`Main description\`
 * if (hasExample) {
 *   doc.$example('Usage', 'ts')\`const x = 1\`
 * }
 * return doc.build()
 * ```
 */
export const template = (() => {
  const templateFn = (
    strings: TemplateStringsArray,
    ...values: Array<string | number | Raw | null | undefined>
  ): string => {
    let result = ''
    for (let i = 0; i < strings.length; i++) {
      result += strings[i]
      if (i < values.length) {
        const value = values[i]
        if (value === null || value === undefined) {
          // Skip nullish values
        } else if (typeof value === 'object' && '__jsDocSafe' in value) {
          // Already safe - inject directly
          result += value.content
        } else {
          // Escape user content
          result += escape(String(value)) ?? ''
        }
      }
    }

    // Clean up: remove leading/trailing whitespace lines and trim each line
    const resultLines = result.split('\n')
    const trimmedLines: string[] = []
    let lastWasEmpty = false

    for (let i = 0; i < resultLines.length; i++) {
      const line = resultLines[i]!.trimStart()
      const isEmpty = line === ''

      // Skip leading empty lines
      if (isEmpty && trimmedLines.length === 0) continue

      // Collapse consecutive empty lines into one
      if (isEmpty && lastWasEmpty) continue

      trimmedLines.push(line)
      lastWasEmpty = isEmpty
    }

    // Remove trailing empty lines
    while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1] === '') {
      trimmedLines.pop()
    }

    return trimmedLines.join('\n')
  }

  // Attach builder and tag namespace as properties
  templateFn.builder = builder
  templateFn.tag = tag
  templateFn.factory = <$Args extends any[]>(fn: (doc: Builder, ...args: $Args) => void) => {
    return (...args: $Args): string => {
      const doc = builder()
      fn(doc, ...args)
      return doc.build()
    }
  }

  return templateFn as Template
})()
