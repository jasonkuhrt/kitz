import { Arr, Num, Str } from '@kitz/core'
import type { Block } from './block.js'
import { type GapParameters, parseGap } from './gap.js'
import { MAX_COLUMN_WIDTH, type RenderContext } from './helpers.js'
import { Node } from './node.js'

/**
 * Table layout and separator configuration.
 *
 * @category CLI/Text Rendering
 */
export interface TableParameters extends GapParameters {}

export class Table extends Node {
  rows: Block[][]
  headers: Block[]
  parameters: TableParameters
  constructor(rows?: Block[][]) {
    super()
    this.rows = rows ?? []
    this.headers = []
    this.parameters = {}
  }
  setParameters(parameters: TableParameters) {
    this.parameters = parameters
    return this
  }
  render(context: RenderContext) {
    // Parse gap input, defaulting to box-drawing characters
    const gap =
      this.parameters.gap !== undefined
        ? parseGap(this.parameters.gap)
        : { main: `─`, cross: ` │ `, intersection: `─┼─` }

    // Row gap: if it's a non-empty string, repeat across width; otherwise just newline
    // When intersection is set and we have column widths, build segment by segment
    const rowGap = (width: number, columnWidths?: number[]) => {
      if (gap.main === ``) {
        return Str.Char.newline
      }
      // If intersection is set and we have column information, render with intersections
      if (gap.intersection && columnWidths && columnWidths.length > 1) {
        const segments = columnWidths.map((w) => gap.main.repeat(w))
        return `${Str.Char.newline}${segments.join(gap.intersection)}${Str.Char.newline}`
      }
      // Default: just repeat main across full width
      return `${Str.Char.newline}${gap.main.repeat(width)}${Str.Char.newline}`
    }

    const numColumns = Math.max(this.headers.length, ...this.rows.map((r) => r.length))

    // Helper to render cells with a given maxWidth
    const renderCells = (maxWidth: number) => {
      const rows = this.rows.map((row) => {
        return row.map((cell, index) => {
          return cell.render({
            maxWidth,
            height: context.height,
            index: {
              total: row.length,
              isFirst: index === 0,
              isLast: index === row.length - 1,
              position: index,
            },
          }).value
        })
      })
      const headers = this.headers.map((cell) => cell.render({ ...context, maxWidth }).value)
      return { rows, headers }
    }

    // Phase 1: Measure intrinsic widths (render with column readability cap)
    const { rows: intrinsicRows, headers: intrinsicHeaders } = renderCells(MAX_COLUMN_WIDTH)
    const intrinsicRowsAndHeaders =
      intrinsicHeaders.length > 0 ? [intrinsicHeaders, ...intrinsicRows] : intrinsicRows
    const intrinsicWidths = Arr.transpose(intrinsicRowsAndHeaders).map((col) =>
      Math.max(...col.flatMap(Str.Text.lines).map((_) => Str.Visual.width(_))),
    )

    // Phase 2: Calculate available width and distribute budget
    const separatorWidth = Str.Visual.width(gap.cross)
    const numSeparators = numColumns > 0 ? numColumns - 1 : 0
    const totalSeparatorWidth = separatorWidth * numSeparators
    const availableWidth = (context.maxWidth ?? MAX_COLUMN_WIDTH) - totalSeparatorWidth

    const columnWidths = Num.Allocation.capped(intrinsicWidths, availableWidth, { round: 'floor' })

    // Phase 3: Re-render with budgets if needed
    const totalIntrinsic = intrinsicWidths.reduce((a, b) => a + b, 0)
    let rows: string[][]
    let headers: string[]

    if (totalIntrinsic <= availableWidth) {
      // Use intrinsic renders
      rows = intrinsicRows
      headers = intrinsicHeaders
    } else {
      // Re-render each cell with its allocated budget
      rows = this.rows.map((row) => {
        return row.map((cell, index) => {
          return cell.render({
            maxWidth: columnWidths[index] ?? MAX_COLUMN_WIDTH,
            height: context.height,
            index: {
              total: row.length,
              isFirst: index === 0,
              isLast: index === row.length - 1,
              position: index,
            },
          }).value
        })
      })
      headers = this.headers.map(
        (cell, index) =>
          cell.render({ ...context, maxWidth: columnWidths[index] ?? MAX_COLUMN_WIDTH }).value,
      )
    }

    const rowsAndHeaders = headers.length > 0 ? [headers, ...rows] : rows
    const maxWidthOfEachColumn = Arr.transpose(rowsAndHeaders).map((col) =>
      Math.max(...col.flatMap(Str.Text.lines).map((_) => Str.Visual.width(_))),
    )
    const rowsWithCellWidthsNormalized = rowsAndHeaders.map((row) => {
      const maxNumberOfLinesAmongColumns = Math.max(
        ...row.map(Str.Text.lines).map((lines) => lines.length),
      )
      const row_ = row.map((col) => {
        const numberOfLines = Str.Text.lines(col).length
        if (numberOfLines < maxNumberOfLinesAmongColumns) {
          return col + Str.Char.newline.repeat(maxNumberOfLinesAmongColumns - numberOfLines)
        }
        return col
      })
      const row__ = row_.map((col, i) =>
        Str.Text.mapLines(col, (line) =>
          Str.Visual.pad(line, maxWidthOfEachColumn[i] ?? 0, `right`),
        ),
      )
      return row__
    })
    const rowsWithCellsJoined = rowsWithCellWidthsNormalized.map((r) =>
      Str.Visual.Table.render(Arr.transpose(r.map(Str.Text.lines)), {
        separator: gap.cross,
        align: `left`,
      }),
    )
    const width = Math.max(
      ...rowsWithCellsJoined.flatMap(Str.Text.lines).map((_) => Str.Visual.width(_)),
    )
    const value = rowsWithCellsJoined.join(rowGap(width, maxWidthOfEachColumn))

    return {
      shape: {
        intrinsicWidth: 0,
        intrinsicHeight: 0,
        desiredWidth: 0,
      },
      value: value,
    }
  }
}
