import fc from 'fast-check'
import { Node, Tree } from './data.js'
import type { Tree as TreeType } from './data.js'

/**
 * Configuration options for generating arbitrary trees.
 * These options control the shape and size of generated trees.
 */
export interface ArbitraryOptions {
  /**
   * Maximum tree depth. Trees will not grow deeper than this.
   * @default 5
   */
  maxDepth?: number

  /**
   * Maximum number of children a node can have.
   * @default 3
   */
  maxChildren?: number

  /**
   * Weight for generating leaf nodes relative to branch nodes.
   * Higher values produce more leaves and shallower trees.
   * @default 3
   */
  leafWeight?: number

  /**
   * Minimum number of children for non-leaf nodes.
   * @default 1
   */
  minChildren?: number
}

/**
 * Generate arbitrary tree values for property-based testing with fast-check.
 * This generator creates random trees with configurable constraints,
 * useful for testing tree algorithms with diverse inputs.
 *
 * @param valueArb - Arbitrary generator for node values
 * @param options - Configuration options for tree generation
 * @returns An arbitrary generator for trees
 *
 * @example
 * ```ts
 * import fc from 'fast-check'
 * import { arbitrary, Tree } from '@kitz/tree'
 *
 * // Generate trees of strings
 * const stringTreeArb = arbitrary(fc.string())
 *
 * // Generate trees of numbers with constraints
 * const numTreeArb = arbitrary(fc.integer(), {
 *   maxDepth: 3,
 *   maxChildren: 2,
 *   leafWeight: 5  // Prefer leaves
 * })
 *
 * // Use in property tests
 * fc.assert(
 *   fc.property(stringTreeArb, (tree) => {
 *     // Test that toList never returns empty for non-empty trees
 *     const list = toList(tree)
 *     return list.length >= 0  // Can be 0 for empty tree
 *   })
 * )
 *
 * // Generate trees with specific value constraints
 * const positiveTreeArb = arbitrary(
 *   fc.integer({ min: 1, max: 100 })
 * )
 * ```
 */
export const arbitrary = <$Value>(
  valueArb: fc.Arbitrary<$Value>,
  options?: ArbitraryOptions,
): fc.Arbitrary<TreeType<$Value>> => {
  const opts = {
    maxDepth: 5,
    maxChildren: 3,
    leafWeight: 3,
    minChildren: 1,
    ...options,
  }

  const generateTree = (currentDepth: number): fc.Arbitrary<Node<$Value>> => {
    if (currentDepth >= opts.maxDepth) {
      // Force leaf node at max depth
      return valueArb.map((value) => Node(value))
    }

    return fc.oneof(
      { weight: opts.leafWeight, arbitrary: valueArb.map((value) => Node(value)) },
      {
        weight: 1,
        arbitrary: valueArb.chain((value) =>
          fc
            .array(generateTree(currentDepth + 1), {
              minLength: opts.minChildren,
              maxLength: opts.maxChildren,
            })
            .map((children) => Node(value, children)),
        ),
      },
    )
  }

  // Generate a tree with a single root, or occasionally an empty tree
  return fc.oneof(
    { weight: 1, arbitrary: fc.constant(Tree<$Value>(null)) }, // empty tree
    { weight: 9, arbitrary: generateTree(0).map((root) => Tree(root)) }, // tree with root
  )
}

/**
 * Common tree shapes for testing.
 * These generators create trees with specific structural properties,
 * useful for testing edge cases and specific scenarios.
 */
export const arbitraryShapes = {
  /**
   * Generate a leaf node (node with no children).
   *
   * @param valueArb - Arbitrary generator for the node value
   * @returns Generator that always produces leaf nodes
   *
   * @example
   * ```ts
   * const leafGen = arbitraryShapes.leaf(fc.string())
   * // Always generates: { value: "...", children: [] }
   * ```
   */
  leaf: <$Value>(valueArb: fc.Arbitrary<$Value>): fc.Arbitrary<Node<$Value>> =>
    valueArb.map((value) => Node(value)),

  /**
   * Generate a tree with exact depth.
   * Every path from root to leaf has the same length.
   *
   * @param valueArb - Arbitrary generator for node values
   * @param depth - Exact depth of the tree (0 = single node)
   * @returns Generator for trees of exact depth
   *
   * @example
   * ```ts
   * const depth2Tree = arbitraryShapes.withDepth(fc.string(), 2)
   * // Generates trees where all leaves are exactly 2 levels deep
   * ```
   */
  withDepth: <$Value>(
    valueArb: fc.Arbitrary<$Value>,
    depth: number,
  ): fc.Arbitrary<Node<$Value>> => {
    if (depth <= 0) return arbitraryShapes.leaf(valueArb)

    return valueArb.chain((value) =>
      fc
        .array(arbitraryShapes.withDepth(valueArb, depth - 1), { minLength: 1, maxLength: 3 })
        .map((children) => Node(value, children)),
    )
  },

  /**
   * Generate a linear tree (linked list style).
   * Each node has at most one child, forming a chain.
   *
   * @param valueArb - Arbitrary generator for node values
   * @param length - Number of nodes in the chain
   * @returns Generator for linear trees
   *
   * @example
   * ```ts
   * const chain = arbitraryShapes.linear(fc.integer(), 4)
   * // Generates: node1 -> node2 -> node3 -> node4
   * ```
   */
  linear: <$Value>(valueArb: fc.Arbitrary<$Value>, length: number): fc.Arbitrary<Node<$Value>> => {
    if (length <= 1) return arbitraryShapes.leaf(valueArb)

    return valueArb.chain((value) =>
      arbitraryShapes.linear(valueArb, length - 1).map((child) => Node(value, [child])),
    )
  },

  /**
   * Generate a perfectly balanced tree.
   * Every node (except leaves) has exactly the same number of children.
   *
   * @param valueArb - Arbitrary generator for node values
   * @param depth - Depth of the tree
   * @param childrenPerNode - Number of children per internal node (default 2 for binary)
   * @returns Generator for balanced trees
   *
   * @example
   * ```ts
   * // Binary tree of depth 3
   * const binaryTree = arbitraryShapes.balanced(fc.string(), 3, 2)
   *
   * // Ternary tree of depth 2
   * const ternaryTree = arbitraryShapes.balanced(fc.integer(), 2, 3)
   * ```
   */
  balanced: <$Value>(
    valueArb: fc.Arbitrary<$Value>,
    depth: number,
    childrenPerNode = 2,
  ): fc.Arbitrary<Node<$Value>> => {
    if (depth <= 0) return arbitraryShapes.leaf(valueArb)

    return valueArb.chain((value) =>
      fc
        .array(arbitraryShapes.balanced(valueArb, depth - 1, childrenPerNode), {
          minLength: childrenPerNode,
          maxLength: childrenPerNode,
        })
        .map((children) => Node(value, children)),
    )
  },

  /**
   * Generate a wide tree (many children, shallow depth).
   * Useful for testing algorithms with high branching factor.
   *
   * @param valueArb - Arbitrary generator for node values
   * @param width - Maximum number of children per node
   * @param depth - Maximum depth (default 2 for shallow trees)
   * @returns Generator for wide trees
   *
   * @example
   * ```ts
   * // Tree with up to 10 children per node, max depth 2
   * const wideTree = arbitraryShapes.wide(fc.string(), 10)
   *
   * // Even wider but still shallow
   * const veryWide = arbitraryShapes.wide(fc.integer(), 20, 1)
   * ```
   */
  wide: <$Value>(
    valueArb: fc.Arbitrary<$Value>,
    width: number,
    depth = 2,
  ): fc.Arbitrary<Node<$Value>> => {
    if (depth <= 0) return arbitraryShapes.leaf(valueArb)

    return valueArb.chain((value) =>
      fc
        .array(arbitraryShapes.wide(valueArb, width, depth - 1), {
          minLength: Math.floor(width / 2),
          maxLength: width,
        })
        .map((children) => Node(value, children)),
    )
  },
}
