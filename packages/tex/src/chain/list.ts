import { Block } from '../nodes/block.js'
import { Leaf } from '../nodes/leaf.js'
import type { ListParameters } from '../nodes/list.js'
import { List } from '../nodes/list.js'
import type { BuilderInternal, NodeImplementor } from './helpers.js'
import { toInternalBuilder } from './helpers.js'

type Childish = string | Block | null
type Childrenish = Childish[] | null
type NonNullChild = Exclude<Childish, null>

/**
 * Add a list to the current container.
 * Lists render items with optional bullets/numbering.
 *
 * @category CLI/Text Rendering
 *
 * @example
 * ```typescript
 * // Simple list from array
 * .list(['Item 1', 'Item 2', 'Item 3'])
 *
 * // List with custom bullets
 * .list({ bullet: { graphic: '-' } }, ['First', 'Second'])
 *
 * // List with numbered bullets
 * .list({ bullet: { graphic: (i) => `${i + 1}.` } }, ['A', 'B', 'C'])
 *
 * // List with builder
 * .list(($) => $
 *   .item('First item')
 *   .item('Second item')
 * )
 * ```
 */
export interface ListMethod<Chain> {
  (parameters: ListParameters, children: Childrenish): Chain
  (children: Childrenish): Chain
  (builder: NodeImplementor<ListBuilder>): Chain
}

const resolveChild = <C extends Childish>(child: C): Exclude<C, string> => {
  if (child === null) return null as any
  if (typeof child === `string`) return new Block(new Leaf(child)) as any
  return child as any
}

export type ListArgs =
  | [ListParameters, Childrenish]
  | [Childrenish]
  | [NodeImplementor<ListBuilder>]

/**
 * List builder interface for creating bulleted or numbered item lists.
 *
 * @category CLI/Text Rendering
 */
export interface ListBuilder {
  /**
   * Set list parameters (bullet style, alignment, etc.).
   *
   * @param parameters - List configuration
   * @returns Builder for chaining
   */
  set(parameters: ListParameters): ListBuilder

  /**
   * Add a single item to the list.
   * Null items are filtered out.
   *
   * @param child - Item content (string, block, or null)
   * @returns Builder for chaining
   *
   * @example
   * ```typescript
   * .list(($) => $
   *   .item('First')
   *   .item('Second')
   * )
   * ```
   */
  item(child: Childish): ListBuilder

  /**
   * Add multiple items to the list.
   * Can be called with individual item arguments or a single array.
   * Null items are filtered out.
   *
   * @param nodes - Items to add
   * @returns Builder for chaining
   *
   * @example
   * ```typescript
   * // Multiple arguments
   * .items('A', 'B', 'C')
   *
   * // Single array
   * .items(['A', 'B', 'C'])
   *
   * // With null filtering
   * .items('A', null, 'B')
   * ```
   */
  items(...nodes: Childish[]): ListBuilder
  items(nodes: Childrenish): ListBuilder
}

export const createListBuilder = (): ListBuilder => {
  const parentNode = new List()

  const $: ListBuilder = {
    set: (parameters) => {
      parentNode.setParameters(parameters)
      return $
    },
    item: (childish) => {
      const child = resolveChild(childish)
      if (child) {
        parentNode.items.push(child)
      }
      return $
    },
    items: (...args) => {
      const childrenish =
        args.length === 1 && Array.isArray(args[0]) ? (args[0] as Childrenish) : args

      if (childrenish === null) return $

      const nodes = childrenish.filter((_): _ is NonNullChild => _ !== null).map(resolveChild)

      if (nodes.length > 0) {
        parentNode.items.push(...nodes)
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
