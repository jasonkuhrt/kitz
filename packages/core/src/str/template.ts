import { Optic } from '#optic'

/**
 * Interpolate variables into a template string using ${variable} syntax.
 * @category Template
 * @param template - Template string containing ${variable} placeholders
 * @returns Function that takes args object and returns interpolated string
 * @example
 * ```typescript
 * const greeting = interpolate('Hello ${name}, you are ${age} years old')
 * greeting({ name: 'John', age: 25 }) // 'Hello John, you are 25 years old'
 *
 * const template = interpolate('${greeting} ${name}!')
 * template({ greeting: 'Hi', name: 'Alice' }) // 'Hi Alice!'
 * ```
 */
export const interpolate = (template: string) => (args: TemplateArgs) => {
  const get = Optic.getOn(args)
  return template.replace(templateVariablePattern, (_, parameterName: string) => {
    return String(get(`.${parameterName}`))
  })
}

/**
 * Regular expression pattern to match template variables in ${variable} format.
 * Captures the variable name inside the braces.
 * @category Template
 */
export const templateVariablePattern = /\${([^}]+)}/g

/**
 * Arguments object for template interpolation.
 * Maps variable names to their JSON-serializable values.
 * @category Template
 */
export type TemplateArgs = Record<string, unknown>
