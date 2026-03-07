import { Fn } from '#fn'
import { removeSurroundingSpaceRegular } from './replace.js'
import { unlines } from './text.js'
import { Tpl } from './tpl/_.js'

/**
 * Default render function for string builders.
 * Joins lines with newline characters.
 * @category Builder
 * @see {@link unlines}
 */
export const defaultRender = unlines

/**
 * String builder interface for constructing multi-line strings.
 * Supports both function call syntax and template literal syntax.
 * @category Builder
 */
export interface Builder {
  /**
   * Add lines to the builder.
   * @param linesInput - Lines to add (null values are filtered out)
   * @returns The builder instance for chaining
   */
  (...linesInput: LinesInput): Builder
  /**
   * Add content using template literal syntax.
   * @param strings - Template string array
   * @param values - Interpolated values
   * @returns The builder instance for chaining
   */
  (strings: TemplateStringsArray, ...values: string[]): Builder
  /**
   * The internal state containing accumulated lines.
   */
  state: State
  /**
   * Render the accumulated lines into a single string.
   * @returns The rendered string
   */
  render: () => string
  /**
   * Alias for render() to support string coercion.
   * @returns The rendered string
   */
  toString(): string
}

/**
 * Input type for lines - allows null values which are filtered out.
 * @category Builder
 */
export type LinesInput = (Line | null)[]

/**
 * Array of line strings.
 * @category Builder
 */
export type Lines = Line[]

/**
 * A single line of text.
 * @category Builder
 */
export type Line = string

/**
 * Internal state of the string builder.
 * @category Builder
 */
export interface State {
  /**
   * Accumulated lines.
   */
  lines: Lines
}

/**
 * Create a new string builder for constructing multi-line strings.
 * @category Builder
 * @example
 * ```typescript
 * const b = Builder()
 * b('Line 1')
 * b('Line 2', 'Line 3')
 * b`Template line`
 * console.log(b.render()) // "Line 1\nLine 2\nLine 3\nTemplate line"
 * ```
 *
 * @returns A new builder instance
 */
export const Builder = (options?: {
  /**
   * During render, the character to join with.
   * @defaultValue '\n'
   */
  join?: string
}): Builder => {
  const state: State = {
    lines: [],
  }

  const builder = ((...args: unknown[]) => {
    if (Tpl.isCallInput(args)) {
      // Usage as template string
      state.lines.push(removeSurroundingSpaceRegular(Tpl.render(args)))
    } else {
      // Usage as function

      const linesInput = args as LinesInput
      const isEmptyInput = linesInput.length === 0

      if (isEmptyInput) {
        state.lines.push(``)
      } else {
        const lines = linesInput.filter((line) => line !== null).map(removeSurroundingSpaceRegular)
        state.lines.push(...lines)
      }
    }

    return builder
  }) as Builder

  builder.state = state

  builder.render = options?.join
    ? () => {
        return state.lines.join(options.join)
      }
    : Fn.bind(defaultRender, state.lines)

  builder.toString = builder.render

  return builder
}
