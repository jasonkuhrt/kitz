import type { BlockParameters } from '../nodes/block.js'
import { Block } from '../nodes/block.js'
import { Leaf } from '../nodes/leaf.js'
import { List } from '../nodes/list.js'
import type { NodeImplementor } from './helpers.js'
import { toInternalBuilder } from './helpers.js'
import type { ListArgs, ListMethod } from './list.js'
import { createListBuilder } from './list.js'
import { createRootBuilder } from './root.js'
import type { TableMethod, TableMethodArgs } from './table.js'
import { resolveTableMethodArgs } from './table.js'

type Childish = string | null | BlockBuilder | Block
type Childrenish = Childish | Childish[]

/**
 * Add a block child to the current container.
 * Blocks can be nested, have borders, padding, and flow control.
 *
 * @category CLI/Text Rendering
 *
 * @example
 * ```typescript
 * // Simple string block
 * .block('Hello World')
 *
 * // Block with parameters
 * .block({ border: { edges: { top: '-' } }, padding: { left: 2 } }, 'Content')
 *
 * // Nested blocks using builder function
 * .block(($) => $
 *   .text('Parent')
 *   .block('Child')
 * )
 *
 * // Block with parameters and builder
 * .block({ border: { edges: { left: '|' } } }, ($) => $
 *   .text('Line 1')
 *   .text('Line 2')
 * )
 * ```
 */
export interface BlockMethod<Chain> {
  (builder: ($: BlockBuilder) => null | BlockBuilder): Chain
  (child: Childrenish): Chain
  (parameters: BlockParameters, children: Childrenish): Chain
  (parameters: BlockParameters, builder: ($: BlockBuilder) => null | BlockBuilder): Chain
}

/**
 * Block builder interface for creating text layout containers.
 * Blocks can contain text, nested blocks, tables, and lists.
 *
 * @category CLI/Text Rendering
 */
export interface BlockBuilder<Chain = null> {
  /**
   * Add a child block.
   * {@link BlockMethod}
   */
  block: BlockMethod<Chain extends null ? BlockBuilder : Chain>

  /**
   * Add a table.
   * {@link TableMethod}
   */
  table: TableMethod<Chain extends null ? BlockBuilder : Chain>

  /**
   * Add a list.
   * {@link ListMethod}
   */
  list: ListMethod<Chain extends null ? BlockBuilder : Chain>

  /**
   * Add text content.
   *
   * @param text - Text to add
   * @returns Builder for chaining
   *
   * @example
   * ```typescript
   * Tex.Tex()
   *   .text('Hello')
   *   .text('World')
   *   .render()
   * ```
   */
  text(text: string): Chain extends null ? BlockBuilder : Chain

  /**
   * Set block parameters (borders, padding, flow, etc.).
   *
   * @param parameters - Block configuration {@link BlockParameters}
   * @returns Builder for chaining
   *
   * @example
   * ```typescript
   * Tex.Tex()
   *   .set({ border: { edges: { top: '-' } }, padding: { left: 2 } })
   *   .text('Content')
   *   .render()
   * ```
   */
  set(parameters: BlockParameters): Chain extends null ? BlockBuilder : Chain
}

export type BlockMethodArgs =
  | [BlockParameters, Childrenish]
  | [Childrenish]
  | [NodeImplementor<BlockBuilder>]
  | [BlockParameters, NodeImplementor<BlockBuilder>]

export const createBlockBuilder = (params?: { getSuperChain: () => any }): BlockBuilder => {
  const parentNode = new Block()

  const $: BlockBuilder = {
    block: (...args: BlockMethodArgs) => {
      const input = resolveBlockMethodArgs(args)
      if (input.child) {
        if (input.parameters) {
          input.child.setParameters(input.parameters)
        }
        parentNode.addChild(input.child)
      }
      return params?.getSuperChain() ?? $
    },
    set: (parameters: BlockParameters) => {
      parentNode.setParameters(parameters)
      return params?.getSuperChain() ?? $
    },
    table: (...args: TableMethodArgs) => {
      const input = resolveTableMethodArgs(args)
      if (input.child) {
        if (input.parameters) {
          input.child.setParameters(input.parameters)
        }
        parentNode.addChild(input.child)
      }
      return params?.getSuperChain() ?? $
    },
    list: (...args: ListArgs) => {
      const parameters = args.length === 1 ? null : args[0]
      const childrenish = args.length === 1 ? args[0] : args[1]
      const child =
        typeof childrenish === `function`
          ? (toInternalBuilder(childrenish(createListBuilder()))?._.node ?? null)
          : childrenish === null
            ? null
            : new List(
                childrenish.map((_) =>
                  typeof _ === `string` ? (_ === null ? null : new Block(new Leaf(_))) : _,
                ),
              )
      if (child) {
        parentNode.addChild(child)
        if (parameters) {
          child.setParameters(parameters)
        }
      }
      return params?.getSuperChain() ?? $
    },
    text: (text) => {
      parentNode.addChild(new Leaf(text))
      return params?.getSuperChain() ?? $
    },
  }

  // Define Internal Methods
  const builderInternal = toInternalBuilder($)
  builderInternal._ = {
    node: parentNode,
  }

  return $
}

export const block = (...args: BlockMethodArgs) => {
  const input = resolveBlockMethodArgs(args)
  if (input.child && input.parameters) {
    input.child.setParameters(input.parameters)
  }
  return input.child
}

export const resolveBlockMethodArgs = (
  args: BlockMethodArgs,
): { parameters: BlockParameters | null; child: Block | null } => {
  const parameters = args.length === 1 ? null : args[0]
  const childrenInput = args.length === 1 ? args[0] : args[1]
  let child: null | Block | NodeImplementor<BlockBuilder> = null
  if (childrenInput !== null && childrenInput !== undefined) {
    if (typeof childrenInput === `string`) {
      child = new Block(new Leaf(childrenInput))
    } else if (childrenInput instanceof Block) {
      child = childrenInput
    } else if (typeof childrenInput === `function`) {
      child = childrenInput
      const result = childrenInput(createRootBuilder())
      child = result === null ? result : toInternalBuilder(result)._.node
    } else if (Array.isArray(childrenInput)) {
      child = new Block(
        childrenInput
          .map((_) =>
            _ === null
              ? null
              : _ instanceof Block
                ? _
                : typeof _ === `string`
                  ? new Leaf(_)
                  : (toInternalBuilder(_)?._.node ?? null),
          )
          .filter((_): _ is Block => _ !== null),
      )
    } else {
      child = toInternalBuilder(childrenInput)._.node
    }
  }
  return { parameters, child }
}
