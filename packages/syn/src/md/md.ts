/**
 * Markdown string utilities for code documentation.
 *
 * Provides utilities for generating markdown content programmatically,
 * with a focus on documentation generation and VitePress compatibility.
 *
 * @module
 */

import { Str } from '@kitz/core'
const splitIntoLines = Str.Text.lines
const joinLines = Str.Text.unlines

// ============================================================================
// Type Branding
// ============================================================================

/**
 * Branded type for markdown content that's already formatted and safe.
 *
 * Use {@link raw} to create values of this type.
 */
export interface Raw {
  readonly __markdownFormatted: true
  readonly content: string
}

/**
 * Mark content as already-formatted markdown (won't be processed further).
 *
 * Use this for pre-formatted markdown syntax that should be injected as-is.
 *
 * @example
 * ```ts
 * const formattedLink = raw('[Example](https://example.com)')
 * const doc = builder()
 * doc`Check out ${formattedLink}`
 * ```
 */
export const raw = (content: string): Raw => ({
  __markdownFormatted: true as const,
  content,
})

// ============================================================================
// Standalone Helper Functions (backward compatible)
// ============================================================================

/**
 * Wrap value in markdown inline code (backticks).
 *
 * @example
 * ```ts
 * code('hello') // '`hello`'
 * code('Array<T>') // '`Array<T>`'
 * ```
 */
export const code = (value: string): string => `\`${value}\``

/**
 * Create a markdown inline link.
 *
 * If text is not provided, the URL is used as both the link text and target.
 *
 * @example
 * ```ts
 * link('https://example.com', 'Example')
 * // '[Example](https://example.com)'
 *
 * link('https://example.com')
 * // '[https://example.com](https://example.com)'
 *
 * // Compose for bold code links:
 * link('/api/foo', `**${code('Foo')}**`)
 * // '[**`Foo`**](/api/foo)'
 * ```
 */
export const link = (url: string, text?: string): string => {
  if (text === undefined) {
    // Single parameter: use URL as both text and URL
    return `[${url}](${url})`
  }
  // Two parameters: URL and text
  return `[${text}](${url})`
}

/**
 * Create a markdown heading.
 */
export const heading = (level: number, text: string): string => {
  return `${'#'.repeat(level)} ${text}`
}

/**
 * Create a code fence with optional language and modifiers.
 */
export const codeFence = (code: string, language = 'typescript', modifiers?: string): string => {
  const fence = modifiers ? `${language} ${modifiers}` : language
  return `\`\`\`${fence}\n${code}\n\`\`\``
}

/**
 * Create a VitePress code group with multiple tabs.
 *
 * @example
 * ```ts
 * codeGroup([
 *   { label: 'npm', code: 'npm install foo', language: 'bash' },
 *   { label: 'pnpm', code: 'pnpm add foo', language: 'bash' }
 * ])
 * ```
 */
export const codeGroup = (
  tabs: Array<{ label: string; code: string; language?: string; modifiers?: string }>,
): string => {
  const blocks = tabs.map((tab) => {
    const lang = tab.language || 'typescript'
    const fence = tab.modifiers
      ? `${lang} ${tab.modifiers} [${tab.label}]`
      : `${lang} [${tab.label}]`
    return `\`\`\`${fence}\n${tab.code}\n\`\`\``
  })

  return `::: code-group\n\n${blocks.join('\n\n')}\n\n:::`
}

/**
 * Create a VitePress custom container (warning, tip, etc.).
 */
export const container = (
  type: 'warning' | 'tip' | 'info' | 'danger',
  title: string,
  content: string,
): string => {
  return `:::${type} ${title}\n${content}\n:::`
}

/**
 * Create a deprecation warning with proper link conversion.
 */
export const deprecation = (message: string): string => {
  return container('warning', 'DEPRECATED', convertJSDocLinks(message))
}

/**
 * Create an unordered list item.
 */
export const listItem = (text: string, level = 0): string => {
  const indent = '  '.repeat(level)
  return `${indent}- ${text}`
}

/**
 * Create a sub-text annotation (smaller font).
 */
export const sub = (text: string): string => {
  return `<sub>${text}</sub>`
}

/**
 * Convert JSDoc {@link ...} tags to markdown links.
 *
 * Patterns:
 * - {@link Identifier} → [`Identifier`](url)
 * - {@link Identifier description} → [description](url)
 *
 * For Effect library references (String.*, Array.*, etc.), links to Effect documentation.
 */
export const convertJSDocLinks = (text: string): string => {
  return text.replace(
    /\{@link\s+([^\s}]+)(?:\s+([^}]+))?\}/g,
    (_, identifier: string, description?: string) => {
      // Detect Effect library references (e.g., String.trim, Array.join)
      let url: string | undefined
      const effectMatch = identifier.match(
        /^(String|Array|Number|Boolean|Object|ReadonlyArray)\.([\w]+)$/,
      )
      if (effectMatch && effectMatch[1] && effectMatch[2]) {
        const module = effectMatch[1]
        const method = effectMatch[2]
        // Link to Effect documentation
        url = `https://effect.website/docs/reference/effect/${module}/#${method.toLowerCase()}`
      }

      if (description) {
        return url ? link(url, description) : `[${description}](${identifier})`
      }
      return url ? link(url, code(identifier)) : code(identifier)
    },
  )
}

/**
 * Demote markdown headings by adding a specified number of levels.
 *
 * This is used to ensure JSDoc descriptions don't break the document hierarchy.
 * For example, if an export is h3, its description headings should be h4+.
 *
 * @param markdown - The markdown content to transform
 * @param levels - Number of heading levels to add (e.g., 2 transforms ## to ####)
 * @returns Transformed markdown with demoted headings
 */
export const demoteHeadings = (markdown: string, levels: number): string => {
  if (!markdown || levels === 0) return markdown

  // Add 'levels' number of # to each heading
  const prefix = '#'.repeat(levels)

  // Replace headings while preserving content and whitespace
  // Matches: start of line, one or more #, space, content
  return markdown.replace(/^(#+)(\s)/gm, `$1${prefix}$2`)
}

/**
 * Join markdown sections with double newlines, filtering out empty sections.
 */
export const sections = (...parts: (string | false | undefined | null)[]): string => {
  return parts.filter(Boolean).join('\n\n')
}

/**
 * Convert string to kebab-case.
 */
export const kebab = (str: string): string => {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Generate a markdown table from key-value pairs.
 *
 * Automatically filters out undefined and null values.
 * Returns empty string if no valid entries remain after filtering.
 *
 * @example
 * ```ts
 * table({
 *   'Name': 'Alice',
 *   'Age': '30',
 *   'City': undefined  // filtered out
 * })
 * // | | |
 * // | - | - |
 * // | **Name** | Alice |
 * // | **Age** | 30 |
 * ```
 */
export const table = (rows: Record<string, string | undefined | null>): string => {
  const entries = Object.entries(rows).filter(([_, value]) => value !== undefined && value !== null)
  if (entries.length === 0) return ''

  const lines: string[] = []
  lines.push(`| | |`)
  lines.push(`| - | - |`)
  for (const [key, value] of entries) {
    lines.push(`| **${key}** | ${value} |`)
  }
  return lines.join('\n')
}

// ============================================================================
// Structured Markdown Helpers Namespace
// ============================================================================

/**
 * Structured markdown helpers.
 *
 * These helpers generate properly formatted markdown elements.
 * All helpers return `Raw` (already formatted) or `null` for graceful handling.
 *
 * @example
 * ```ts
 * md.heading(2, 'API Reference')
 * md.link('Example', 'https://example.com')
 * md.codeFence('const x = 1', 'typescript')
 * ```
 */
export namespace md {
  /**
   * Create a markdown heading.
   * Returns Raw for injection into builder.
   */
  export const heading = (level: number, text: string): Raw => {
    return raw(`${'#'.repeat(level)} ${text}`)
  }

  /**
   * Create an inline code span.
   * Returns Raw for injection.
   */
  export const code = (text: string): Raw => {
    return raw(`\`${text}\``)
  }

  /**
   * Create a markdown link.
   * Returns Raw for injection.
   * If text is not provided, url is used as both text and URL.
   *
   * Compose for bold code links: `link(url, \`**\${code(text)}**\`)`
   */
  export const link = (url: string, text?: string): Raw => {
    if (text === undefined) {
      return raw(`[${url}](${url})`)
    }
    return raw(`[${text}](${url})`)
  }

  /**
   * Create a code fence.
   * Returns null if code is null/undefined.
   */
  export const codeFence = (
    code: string | null | undefined,
    language = 'typescript',
    modifiers?: string,
  ): Raw | null => {
    if (code === null || code === undefined) return null
    const fence = modifiers ? `${language} ${modifiers}` : language
    return raw(`\`\`\`${fence}\n${code}\n\`\`\``)
  }

  /**
   * Create a list item.
   * Returns Raw for injection.
   */
  export const listItem = (text: string, level = 0): Raw => {
    const indent = '  '.repeat(level)
    return raw(`${indent}- ${text}`)
  }

  /**
   * Create a VitePress container.
   * Returns null if content is null/undefined.
   */
  export const container = (
    type: 'warning' | 'tip' | 'info' | 'danger',
    title: string,
    content: string | null | undefined,
  ): Raw | null => {
    if (!content) return null
    return raw(`:::${type} ${title}\n${content}\n:::`)
  }

  /**
   * Create a deprecation warning.
   * Returns null if message is null/undefined.
   */
  export const deprecation = (message: string | null | undefined): Raw | null => {
    if (!message) return null
    return container('warning', 'DEPRECATED', message)
  }
}

// ============================================================================
// Builder Interface
// ============================================================================

/**
 * Markdown builder interface for imperative markdown construction.
 *
 * Provides a fluent API for building markdown with conditionals, loops, and helpers.
 *
 * @example
 * ```ts
 * const doc = builder()
 *
 * doc`# API Reference`
 * doc.blank()
 * doc`Main description here.`
 *
 * if (showTable) {
 *   doc.table({ 'Type': 'string', 'Required': 'Yes' })
 * }
 *
 * doc.codeFence('const x = 1', 'typescript')
 *
 * return doc.build()
 * ```
 */
export interface Builder {
  /**
   * Add a line to the markdown via tagged template.
   * Use empty template for blank lines: `doc\`\``
   */
  (
    strings: TemplateStringsArray,
    ...values: Array<string | number | Raw | null | undefined>
  ): Builder

  /**
   * Add content directly. Skips if null/undefined.
   * Perfect for chaining with optional content.
   *
   * @example
   * ```ts
   * doc
   *   .add(description)  // skips if null/undefined
   *   .add('## Info')
   * ```
   */
  add(content: string | null | undefined): Builder

  /**
   * Add raw formatted markdown without processing. Skips if null/undefined.
   *
   * @example
   * ```ts
   * doc.addRaw(preFormattedMarkdown)
   * ```
   */
  addRaw(content: string | null | undefined): Builder

  /**
   * Add a blank line.
   *
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
   * Add a markdown heading.
   *
   * @example
   * ```ts
   * doc.heading(2, 'API Reference')
   * ```
   */
  heading(level: number, text: string): Builder

  /**
   * Add a markdown link.
   * If text is not provided, url is used as both text and URL.
   *
   * @example
   * ```ts
   * doc.link('https://example.com', 'Example')
   * doc.link('https://example.com')  // text defaults to URL
   * // Compose for bold code: doc`[**\`Foo\`**](/api/foo)`
   * ```
   */
  link(url: string, text?: string): Builder

  /**
   * Add a code fence with optional language.
   * Skips if code is null/undefined.
   *
   * @example
   * ```ts
   * doc.codeFence('const x = 1', 'typescript')
   * ```
   */
  codeFence(code: string | null | undefined, language?: string, modifiers?: string): Builder

  /**
   * Add a VitePress code group with multiple tabs.
   *
   * @example
   * ```ts
   * doc.codeGroup([
   *   { label: 'npm', code: 'npm install foo', language: 'bash' },
   *   { label: 'pnpm', code: 'pnpm add foo', language: 'bash' }
   * ])
   * ```
   */
  codeGroup(
    tabs: Array<{ label: string; code: string; language?: string; modifiers?: string }>,
  ): Builder

  /**
   * Add a list item.
   *
   * @example
   * ```ts
   * doc.listItem('First item')
   * doc.listItem('Nested item', 1)
   * ```
   */
  listItem(text: string, level?: number): Builder

  /**
   * Add a markdown table from key-value pairs.
   * Automatically filters out undefined/null values.
   *
   * @example
   * ```ts
   * doc.table({
   *   'Type': 'string',
   *   'Required': 'Yes'
   * })
   * ```
   */
  table(rows: Record<string, string | Raw | undefined | null>): Builder

  /**
   * Add a VitePress container.
   *
   * @example
   * ```ts
   * doc.container('warning', 'Deprecated', 'Use newMethod() instead')
   * ```
   */
  container(type: 'warning' | 'tip' | 'info' | 'danger', title: string, content: string): Builder

  /**
   * Build the final markdown string with whitespace normalization.
   */
  build(): string
}

/**
 * Create a new markdown builder for imperative construction.
 *
 * Perfect for markdown generation with conditionals, loops, and complex logic.
 *
 * @example
 * ```ts
 * const doc = builder()
 *
 * doc`# ${title}`
 * doc.blank()
 * doc`Main description`
 *
 * if (showExample) {
 *   doc.codeFence('const x = 1', 'ts')
 * }
 *
 * return doc.build()
 * ```
 */
export const builder = (): Builder => {
  const contentLines: string[] = []

  const addLine = (content: string) => {
    contentLines.push(content)
  }

  // Process template with Raw handling
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
        } else if (typeof value === 'object' && '__markdownFormatted' in value) {
          // Already formatted - inject directly
          result += value.content
        } else {
          // Plain value - convert to string
          result += String(value)
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
      addLine(content)
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

  builderFn.heading = (level: number, text: string) => {
    addLine(`${'#'.repeat(level)} ${text}`)
    return builderFn
  }

  builderFn.link = (url: string, text?: string) => {
    if (text === undefined) {
      addLine(`[${url}](${url})`)
    } else {
      addLine(`[${text}](${url})`)
    }
    return builderFn
  }

  builderFn.codeFence = (
    code: string | null | undefined,
    language = 'typescript',
    modifiers?: string,
  ) => {
    if (code !== null && code !== undefined && code.trim()) {
      const fence = modifiers ? `${language} ${modifiers}` : language
      addLine(`\`\`\`${fence}`)
      addLine(code)
      addLine(`\`\`\``)
    }
    return builderFn
  }

  builderFn.codeGroup = (
    tabs: Array<{ label: string; code: string; language?: string; modifiers?: string }>,
  ) => {
    const blocks = tabs.map((tab) => {
      const lang = tab.language || 'typescript'
      const fence = tab.modifiers
        ? `${lang} ${tab.modifiers} [${tab.label}]`
        : `${lang} [${tab.label}]`
      return `\`\`\`${fence}\n${tab.code}\n\`\`\``
    })

    addLine(`::: code-group`)
    addLine('')
    blocks.forEach((block) => addLine(block))
    addLine('')
    addLine(`:::`)
    return builderFn
  }

  builderFn.listItem = (text: string, level = 0) => {
    const indent = '  '.repeat(level)
    addLine(`${indent}- ${text}`)
    return builderFn
  }

  builderFn.table = (rows: Record<string, string | Raw | undefined | null>) => {
    const entries = Object.entries(rows).filter((entry): entry is [string, string | Raw] => {
      const value = entry[1]
      return value !== undefined && value !== null
    })
    if (entries.length === 0) return builderFn

    addLine(`| | |`)
    addLine(`| - | - |`)
    for (const [key, value] of entries) {
      const valueStr =
        typeof value === 'object' && '__markdownFormatted' in value ? value.content : String(value)
      addLine(`| **${key}** | ${valueStr} |`)
    }
    return builderFn
  }

  builderFn.container = (
    type: 'warning' | 'tip' | 'info' | 'danger',
    title: string,
    content: string,
  ) => {
    addLine(`:::${type} ${title}`)
    addLine(content)
    addLine(`:::`)
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
 * Markdown template function type with builder property.
 */
export interface Template {
  /**
   * Tagged template for building markdown content.
   *
   * @example
   * ```ts
   * const doc = template`
   *   # ${title}
   *
   *   ${description}
   *
   *   ${md.link('Example', 'https://example.com')}
   * `
   * ```
   */
  (
    strings: TemplateStringsArray,
    ...values: Array<string | number | Raw | null | undefined>
  ): string

  /**
   * Create a new markdown builder for imperative construction.
   */
  builder: typeof builder

  /**
   * Create a markdown generator function from a builder callback.
   * Automatically calls `.build()` and returns the result.
   *
   * @example
   * ```ts
   * export const getDoc = factory<[title: string, items: string[]]>((doc, title, items) => {
   *   doc.heading(1, title)
   *   doc.blank()
   *   items.forEach(item => doc.listItem(item))
   * })
   *
   * // Usage: getDoc('My Title', ['item1', 'item2']) -> string
   * ```
   */
  factory: <$Args extends any[]>(
    fn: (doc: Builder, ...args: $Args) => void,
  ) => (...args: $Args) => string

  /**
   * Markdown element helpers for generating formatted elements.
   */
  md: typeof md
}

/**
 * Tagged template for building markdown content.
 * Also provides `.builder()` for imperative construction and `.md` for element helpers.
 *
 * @example
 * ```ts
 * // Template mode
 * const doc = template`
 *   # API Reference
 *
 *   ${description}
 *
 *   ${template.md.link('Docs', 'https://example.com')}
 * `
 *
 * // Builder mode for complex logic
 * const doc = template.builder()
 * doc.heading(1, 'API Reference')
 * doc.blank()
 * if (hasDescription) {
 *   doc.add(description)
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
        } else if (typeof value === 'object' && '__markdownFormatted' in value) {
          // Already formatted - inject directly
          result += value.content
        } else {
          // Plain value - convert to string
          result += String(value)
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

  // Attach builder and md namespace as properties
  templateFn.builder = builder
  templateFn.md = md
  templateFn.factory = <$Args extends any[]>(fn: (doc: Builder, ...args: $Args) => void) => {
    return (...args: $Args): string => {
      const doc = builder()
      fn(doc, ...args)
      return doc.build()
    }
  }

  return templateFn as Template
})()
