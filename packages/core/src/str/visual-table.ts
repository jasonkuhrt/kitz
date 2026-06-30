import { Arr } from '#arr'
import { CoreFn as Fn } from '#fn/core'
import { unlines } from './text.js'
import { span, width } from './visual.js'

/**
 * Visual-aware table operations for multi-column text layout.
 *
 * Tables are row-major 2D arrays where `table[row][col]` accesses individual cells.
 * All operations use visual width (ANSI-aware) for alignment and measurement.
 *
 * @category Text Formatting
 *
 * @example
 * ```typescript
 * import { Str } from '@wollybeard/kit'
 *
 * // Create table from row data
 * const table = [
 *   ['Name', 'Age'],
 *   ['Alice', '30']
 * ]
 *
 * // Render with visual alignment
 * Str.Visual.Table.render(table)
 * // "Name   Age"
 * // "Alice  30"
 *
 * // With ANSI codes
 * const colored = [['\x1b[31mRed\x1b[0m', 'Normal']]
 * Str.Visual.Table.render(colored, { separator: ' | ' })
 * // "Red | Normal"  (correctly aligned despite ANSI)
 * ```
 */

/**
 * Individual table cell containing text.
 *
 * @category Text Formatting
 */
export type Cell = string

/**
 * Row of cells in a table.
 *
 * @category Text Formatting
 */
export type Row = Cell[]

/**
 * Row-major 2D table of text cells.
 *
 * Access pattern: `table[rowIndex][columnIndex]`
 * Can be jagged (rows with different lengths).
 *
 * @category Text Formatting
 */
export type Table = Row[]

/**
 * Options for rendering tables into formatted text.
 *
 * @category Text Formatting
 */
export interface RenderOptions {
  /**
   * String to place between columns.
   * @default '   ' (three spaces)
   */
  separator?: string

  /**
   * How to align content within columns.
   * @default 'left'
   */
  align?: 'left' | 'right'

  /**
   * Explicit column widths. If omitted, auto-calculated from content.
   * Useful for forcing specific column sizes.
   */
  columnWidths?: number[]
}

/**
 * Render table rows into a formatted multi-line string.
 *
 * Each column is aligned to its maximum visual width (or explicit width if provided).
 * Missing cells in jagged arrays are treated as empty strings.
 *
 * @category Text Formatting
 * @param table - The table to render
 * @param options - Formatting options
 * @returns Multi-line string with aligned columns
 *
 * @example
 * ```typescript
 * const table = [
 *   ['Name', 'Age', 'City'],
 *   ['Alice', '30', 'NYC'],
 *   ['Bob', '25', 'LA']
 * ]
 *
 * Str.Visual.Table.render(table)
 * // "Name   Age  City"
 * // "Alice  30   NYC"
 * // "Bob    25   LA"
 *
 * Str.Visual.Table.render(table, { separator: ' | ', align: 'right' })
 * // " Name | Age | City"
 * // "Alice |  30 |  NYC"
 * // "  Bob |  25 |   LA"
 * ```
 */
export const render = (table: Table, options?: RenderOptions): string => {
  const separator = options?.separator ?? `   `
  const align = options?.align ?? `left`
  const colWidths = options?.columnWidths ?? columnWidths(table)

  const renderedRows = table.map((row) => {
    return row
      .map((cell, colIndex) => {
        const cellWidth = colWidths[colIndex] ?? 0
        return span(cell ?? ``, cellWidth, align)
      })
      .join(separator)
  })

  return unlines(renderedRows)
}

/**
 * Curried version of {@link render} with table first.
 * @category Text Formatting
 */
export const renderOn = Fn.curry(render)

/**
 * Curried version of {@link render} with options first.
 * @category Text Formatting
 */
export const renderWith = Fn.flipCurried(renderOn)

/**
 * Render columns of text as aligned output.
 *
 * Takes column-oriented data where each column can have multiple lines.
 * Columns with different heights are padded with empty strings.
 * Transposes the column data to row-oriented format before rendering.
 *
 * @category Text Formatting
 * @param columns - Array of columns, each column is an array of cell values
 * @param options - Formatting options
 * @returns Multi-line string with aligned columns
 *
 * @example
 * ```typescript
 * // Column-oriented data
 * const columns = [
 *   ['Name', 'Alice', 'Bob'],    // Column 1
 *   ['Age', '30', '25']           // Column 2
 * ]
 *
 * Str.Visual.Table.renderColumns(columns)
 * // "Name   Age"
 * // "Alice  30"
 * // "Bob    25"
 *
 * // Handles jagged arrays
 * const jagged = [
 *   ['A', 'B'],
 *   ['X', 'Y', 'Z']
 * ]
 * Str.Visual.Table.renderColumns(jagged)
 * // "A  X"
 * // "B  Y"
 * // "   Z"
 * ```
 */
export const renderColumns = (columns: string[][], options?: RenderOptions): string => {
  // Transpose column-oriented data to row-oriented
  const table = Arr.transpose(columns)
  return render(table, options)
}

/**
 * Curried version of {@link renderColumns} with columns first.
 * @category Text Formatting
 */
export const renderColumnsOn = Fn.curry(renderColumns)

/**
 * Curried version of {@link renderColumns} with options first.
 * @category Text Formatting
 */
export const renderColumnsWith = Fn.flipCurried(renderColumnsOn)

/**
 * Calculate the visual width of each column.
 *
 * Returns an array where each element is the maximum visual width
 * of cells in that column.
 *
 * @category Text Formatting
 * @param table - The table to measure
 * @returns Array of column widths
 *
 * @example
 * ```typescript
 * const table = [
 *   ['hi', 'world'],
 *   ['hello', 'x']
 * ]
 *
 * Str.Visual.Table.columnWidths(table)
 * // [5, 5]  (max of 'hi'/'hello', max of 'world'/'x')
 * ```
 */
export const columnWidths = (table: Table): number[] => {
  if (table.length === 0) return []

  const maxCols = Math.max(...table.map((row) => row.length))
  const widths: number[] = []

  for (let colIndex = 0; colIndex < maxCols; colIndex++) {
    let maxWidth = 0
    for (const row of table) {
      const cell = row[colIndex] ?? ``
      maxWidth = Math.max(maxWidth, width(cell))
    }
    widths.push(maxWidth)
  }

  return widths
}

/**
 * Get the dimensions of a table.
 *
 * @category Text Formatting
 * @param table - The table to measure
 * @returns Object with row and column counts
 *
 * @example
 * ```typescript
 * const table = [['a', 'b'], ['c']]
 * Str.Visual.Table.dimensions(table)
 * // { rows: 2, columns: 2 }
 * ```
 */
export const dimensions = (table: Table): { rows: number; columns: number } => {
  return {
    rows: table.length,
    columns: table.length === 0 ? 0 : Math.max(...table.map((row) => row.length)),
  }
}

/**
 * Normalize a jagged table to be rectangular.
 *
 * Fills missing cells with empty strings so all rows have the same length.
 *
 * @category Text Formatting
 * @param table - The table to normalize
 * @returns Rectangular table
 *
 * @example
 * ```typescript
 * const jagged = [['a', 'b'], ['c']]
 * Str.Visual.Table.normalize(jagged)
 * // [['a', 'b'], ['c', '']]
 * ```
 */
export const normalize = (table: Table): Table => {
  const dims = dimensions(table)
  return table.map((row) => {
    const normalized = [...row]
    while (normalized.length < dims.columns) {
      normalized.push(``)
    }
    return normalized
  })
}
