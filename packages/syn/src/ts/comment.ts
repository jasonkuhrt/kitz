/**
 * Comment section formatters for TypeScript code.
 *
 * Provides utilities for creating decorative comment sections, borders, and titles
 * to organize generated code into readable sections.
 *
 * @module
 */

import { Str } from '@kitz/core'
const Text = Str.Text

// ============================================================================
// Constants
// ============================================================================

/**
 * Thick border for major section dividers.
 * Length: 98 characters (standard terminal width minus comment prefix)
 */
export const borderThick = `==================================================================================================`

/**
 * Thin border for minor section dividers.
 * Length: 98 characters (standard terminal width minus comment prefix)
 */
export const borderThin = `--------------------------------------------------------------------------------------------------`

// ============================================================================
// Text Alignment
// ============================================================================

/**
 * Center text within a target string's width.
 *
 * @param target - Target string to match width of
 * @param value - Text to center
 * @returns Centered text with leading spaces
 *
 * @example
 * ```ts
 * centerTo(borderThin, 'Types')
 * // '                                              Types                                             '
 * ```
 */
export const centerTo = (target: string, value: string) => {
  const indentSize = Math.max(0, Math.round(target.length / 2) - Math.round(value.length / 2))
  return Text.padLeft(value, indentSize)
}

// ============================================================================
// Section Formatters
// ============================================================================

/**
 * Create a major section title with thick borders and spacing.
 *
 * Perfect for dividing code into large logical sections.
 *
 * @param title - Main section title
 * @param subTitle - Optional subtitle
 * @returns Formatted section comment block
 *
 * @example
 * ```ts
 * title1('Types', 'Core Data Structures')
 * // //
 * // //
 * // //
 * // //
 * // //
 * // //
 * // ==================================================================================
 * // Types
 * // Core Data Structures
 * // ==================================================================================
 * // //
 * // //
 * // //
 * // //
 * // //
 * // //
 * ```
 */
export const title1 = (title: string, subTitle?: string) => {
  const subTitle_ = subTitle ? `\n// ${centerTo(borderThick, subTitle)}` : ``
  const titleDecorated = `
    //
    //
    //
    //
    //
    //
    // ${borderThick}
    // ${centerTo(borderThick, title)}${subTitle_}
    // ${borderThick}
    //
    //
    //
    //
    //
    //
  `
  return titleDecorated
}

/**
 * Create a medium section title with centered text and thin border.
 *
 * Useful for subsections within a major section.
 *
 * @param title - Section title
 * @param subTitle - Optional subtitle
 * @returns Formatted section comment block
 *
 * @example
 * ```ts
 * title2('Helper Functions', 'Internal utilities')
 * // // Helper Functions
 * // // Internal utilities
 * // // --------------------------------------------------------------------------------------------------
 * // //
 * ```
 */
export const title2 = (title: string, subTitle?: string) => {
  const subTitle_ = subTitle ? `\n// ${centerTo(borderThick, subTitle)}` : ``
  const titleDecorated = `
    // ${centerTo(borderThick, title)}${subTitle_}
    // ${borderThin}
    //
  `
  return titleDecorated
}

/**
 * Create a small inline section marker.
 *
 * Perfect for marking smaller logical groups within a function or section.
 *
 * @param title - Section title
 * @returns Formatted inline comment
 *
 * @example
 * ```ts
 * title3('Validation')
 * // '// ----------------------------------------| Validation |'
 * ```
 */
export const title3 = (title: string) => {
  return `// ----------------------------------------| ${title} |`
}

/**
 * Create a custom section title with configurable style.
 *
 * @param title - Section title
 * @param options - Formatting options
 * @returns Formatted section comment block
 *
 * @example
 * ```ts
 * commentSection('API Endpoints', {
 *   border: 'thick',
 *   spacing: 'large',
 *   centered: true
 * })
 * ```
 */
export const commentSection = (
  title: string,
  options?: {
    /**
     * Border style
     * @default 'thin'
     */
    border?: 'thick' | 'thin' | 'none'

    /**
     * Spacing around the title
     * @default 'medium'
     */
    spacing?: 'large' | 'medium' | 'small' | 'none'

    /**
     * Whether to center the title
     * @default false
     */
    centered?: boolean

    /**
     * Optional subtitle
     */
    subTitle?: string
  },
): string => {
  const border = options?.border ?? 'thin'
  const spacing = options?.spacing ?? 'medium'
  const centered = options?.centered ?? false
  const subTitle = options?.subTitle

  const borderLine = border === 'thick' ? borderThick : border === 'thin' ? borderThin : ''
  const titleLine = centered ? centerTo(borderLine || borderThin, title) : title
  const subTitleLine = subTitle
    ? `\n// ${centered ? centerTo(borderLine || borderThin, subTitle) : subTitle}`
    : ``

  const spacingLines = {
    large: 6,
    medium: 2,
    small: 1,
    none: 0,
  }[spacing]

  const emptyLines = Array.from({ length: spacingLines }, () => `//`).join(`\n`)

  if (border === 'none') {
    return `${emptyLines}\n// ${titleLine}${subTitleLine}\n${emptyLines}`
  }

  return `
${emptyLines}
// ${borderLine}
// ${titleLine}${subTitleLine}
// ${borderLine}
${emptyLines}
`.trim()
}
