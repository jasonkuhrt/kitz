import { Block } from '../nodes/block.js'
import { Leaf } from '../nodes/leaf.js'
import type { TableParameters } from '../nodes/table.js'
import { Table } from '../nodes/table.js'
import type { BlockBuilder, BlockMethod, BlockMethodArgs } from './block.js'
import { resolveBlockMethodArgs } from './block.js'
import type { NodeImplementor } from './helpers.js'
import { toInternalBuilder } from './helpers.js'

type Childish = BlockBuilder | Block | string | null
type NonNullChildish = Exclude<Childish, null>

/**
 * Add a table to the current container.
 * Tables automatically calculate column widths and align content.
 *
 * @category CLI/Text Rendering
 *
 * @example
 * ```typescript
 * // Table from array of rows
 * .table([
 *   ['Name', 'Age', 'City'],
 *   ['Alice', '30', 'NYC'],
 *   ['Bob', '25', 'LA']
 * ])
 *
 * // Table with builder for headers
 * .table(($) => $
 *   .headers(['Name', 'Age'])
 *   .row('Alice', '30')
 *   .row('Bob', '25')
 * )
 *
 * // Table with custom column separator
 * .table({ gap: { cross: ' | ' } }, ($) => $
 *   .headers(['Col1', 'Col2'])
 *   .row('A', 'B')
 * )
 * ```
 */
export interface TableMethod<Chain> {
  (rows: (Childish[] | null)[]): Chain
  (builder: NodeImplementor<TableBuilder>): Chain
  (parameters: TableParameters, builder: NodeImplementor<TableBuilder>): Chain
}

export type TableMethodArgs =
  | [(Childish[] | null)[]]
  | [TableParameters, NodeImplementor<TableBuilder>]
  | [NodeImplementor<TableBuilder>]

export const resolveTableMethodArgs = (
  args: TableMethodArgs,
): { parameters: TableParameters | null; child: null | Table } => {
  const childrenish = args.length === 1 ? args[0] : args[1]
  const parameters = args.length === 1 ? null : args[0]
  const child =
    typeof childrenish === `function`
      ? (toInternalBuilder(childrenish(createTableBuilder()))?._.node ?? null)
      : new Table(resolveChildrenish(childrenish))

  return { parameters, child }
}

const resolveChildrenish = (childrenish: (Childish[] | null)[]): Block[][] => {
  const resolved = childrenish
    .filter((_): _ is NonNullChildish[] => _ !== null)
    .map((cells) =>
      cells
        .filter((cell): cell is NonNullChildish => cell !== null)
        .map((cell) =>
          typeof cell === `string`
            ? new Block(new Leaf(cell))
            : cell instanceof Block
              ? cell
              : toInternalBuilder(cell)._.node,
        ),
    )

  return resolved
}

/**
 * Table builder interface for creating aligned column layouts.
 * Tables automatically calculate column widths based on content.
 *
 * @category CLI/Text Rendering
 */
export interface TableBuilder {
  /**
   * Set table parameters (separators, etc.).
   *
   * @param parameters - Table configuration {@link TableParameters}
   * @returns Builder for chaining
   */
  set(parameters: TableParameters): TableBuilder

  /**
   * Add a single row with cells.
   * Null cells are filtered out.
   *
   * @param cells - Cell content (strings, blocks, or null)
   * @returns Builder for chaining
   *
   * @example
   * ```typescript
   * .table(($) => $
   *   .row('Alice', '30', 'NYC')
   *   .row('Bob', '25', 'LA')
   * )
   * ```
   */
  row(...cells: Childish[]): TableBuilder

  /**
   * Add multiple rows.
   * Can be called with individual row arguments or a single array of rows.
   * Null rows are filtered out.
   *
   * @param rows - Rows to add
   * @returns Builder for chaining
   *
   * @example
   * ```typescript
   * // Multiple arguments
   * .rows(['Alice', '30'], ['Bob', '25'])
   *
   * // Single array
   * .rows([['Alice', '30'], ['Bob', '25']])
   *
   * // With null filtering
   * .rows(['A', 'B'], null, ['C', 'D'])
   * ```
   */
  rows(...rows: (Childish[] | null)[]): TableBuilder
  rows(rows: (Childish[] | null)[]): TableBuilder

  /**
   * Set header row for the table.
   * Headers are typically rendered with different styling.
   *
   * @param headers - Header cell content
   * @returns Builder for chaining
   *
   * @example
   * ```typescript
   * .table(($) => $
   *   .headers(['Name', 'Age', 'City'])
   *   .row('Alice', '30', 'NYC')
   * )
   * ```
   */
  headers(headers: (string | Block)[]): TableBuilder

  /**
   * Add a single header cell with full block control.
   * Allows applying borders, padding, etc. to individual headers.
   *
   * @returns Builder for chaining
   *
   * @example
   * ```typescript
   * .table(($) => $
   *   .header(new Tex.Block({ border: { edges: { bottom: '~' } } }, 'Name'))
   *   .header('Age')
   *   .row('Alice', '30')
   * )
   * ```
   */
  header: BlockMethod<TableBuilder>
}

export const createTableBuilder = (): TableBuilder => {
  const parentNode = new Table()
  const $: TableBuilder = {
    set: (parameters) => {
      parentNode.setParameters(parameters)
      return $
    },
    row: (...cells) => {
      const cellsNormalized = cells
        .filter((cell): cell is NonNullChildish => cell !== null)
        .map((cell) =>
          typeof cell === `string`
            ? new Block(new Leaf(cell))
            : cell instanceof Block
              ? cell
              : toInternalBuilder(cell)._.node,
        )
      if (cellsNormalized.length > 0) {
        parentNode.rows.push(cellsNormalized)
      }
      return $
    },
    rows: (...args) => {
      const rows =
        args.length === 1 && Array.isArray(args[0]?.[0])
          ? (args[0] as (Childish[] | null)[])
          : (args as (Childish[] | null)[])

      const rowsNormalized = resolveChildrenish(rows)

      if (rowsNormalized.length > 0) {
        parentNode.rows.push(...rowsNormalized)
      }
      return $
    },
    headers: (headers) => {
      parentNode.headers = headers.map((_) => (_ instanceof Block ? _ : new Block(new Leaf(_))))
      return $
    },
    header: (...args: BlockMethodArgs) => {
      const input = resolveBlockMethodArgs(args)
      if (input.child) {
        if (input.parameters) {
          input.child.setParameters(input.parameters)
        }
        parentNode.headers.push(input.child)
      }
      return $
    },
  }
  // Define Internal Methods
  toInternalBuilder($)._ = {
    node: parentNode,
  }
  return $
}
