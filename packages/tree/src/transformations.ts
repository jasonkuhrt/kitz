import { Tree } from './data.js'
import type { Node, Tree as TreeType } from './data.js'
import type { Predicate } from './predicate.js'

/**
 * A function that transforms a value from one type to another during tree mapping.
 *
 * @param value - The current value to transform
 * @param depth - The depth of the current node (root is 0)
 * @param path - Array of ancestor values leading to this node (excluding current)
 * @returns The transformed value
 *
 * @example
 * ```ts
 * // Simple value transformation
 * const toUpper: Mapper<string, string> = (value) => value.toUpperCase()
 *
 * // Type conversion
 * const toString: Mapper<number, string> = (value) => value.toString()
 *
 * // Using depth information
 * const addDepth: Mapper<string, string> = (value, depth) => `${value}@${depth}`
 *
 * // Using path context
 * const withPath: Mapper<string, { value: string; path: string }> = (value, depth, path) => ({
 *   value,
 *   path: [...path, value].join('/')
 * })
 * ```
 */
export type Mapper<$FromValue, $ToValue> = (
  value: $FromValue,
  depth: number,
  path: $FromValue[],
) => $ToValue

/**
 * Filter tree nodes based on a predicate.
 * If a node doesn't match, that entire branch is pruned (short-circuit).
 * If the root doesn't match, returns an empty tree.
 *
 * @param tree - The tree to filter
 * @param predicate - Function that tests each node's value
 * @returns The filtered tree (may be empty)
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node(1, [
 *     Node(2, [
 *       Node(4),
 *       Node(5)
 *     ]),
 *     Node(3, [Node(6)])
 *   ])
 * )
 *
 * // Keep only even numbers - non-matching nodes prune their branches
 * const evenTree = filter(tree, value => value % 2 === 0)
 * // Result: Empty tree { root: null } (root 1 doesn't match)
 *
 * // Filter a tree with matching root
 * const tree2 = Tree(Node(2, [Node(3), Node(4)]))
 * const evenTree2 = filter(tree2, value => value % 2 === 0)
 * // Result: Tree with root 2 -> [4] (3 is pruned)
 * ```
 */
export const filter = <$Value>(
  tree: TreeType<$Value>,
  predicate: Predicate<$Value>,
): TreeType<$Value> => {
  if (tree.root === null) return tree

  const filterNode = (
    node: Node<$Value>,
    depth: number,
    path: $Value[],
  ): Node<$Value> | undefined => {
    // Short-circuit: if node doesn't match, prune entire branch
    if (!predicate(node.value, depth, path)) {
      return undefined
    }

    const newPath = [...path, node.value]
    const filteredChildren = node.children
      .map((child) => filterNode(child, depth + 1, newPath))
      .filter((child): child is Node<$Value> => child !== undefined)

    return {
      value: node.value,
      children: filteredChildren,
    }
  }

  const filteredRoot = filterNode(tree.root, 0, [])
  return Tree(filteredRoot || null)
}

/**
 * Filter tree preserving complete paths to any matching node.
 * A node is kept if it matches the predicate OR if it has any matching descendants.
 * This ensures all paths from root to matching nodes are preserved.
 * If no nodes in the tree match, returns an empty tree.
 *
 * @param tree - The tree to filter
 * @param predicate - Function that tests each node's value
 * @returns The filtered tree (may be empty)
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node(1, [
 *     Node(2, [
 *       Node(4),
 *       Node(5)
 *     ]),
 *     Node(3, [Node(6)])
 *   ])
 * )
 *
 * // Keep paths to all even numbers
 * const evenPaths = filterPaths(tree, value => value % 2 === 0)
 * // Result structure:
 * // Tree with:
 * // └─ 1 (kept: has matching descendants)
 * //    ├─ 2 (kept: matches)
 * //    │  └─ 4 (kept: matches)
 * //    └─ 3 (kept: has matching child)
 * //       └─ 6 (kept: matches)
 * ```
 */
export const filterPaths = <$Value>(
  tree: TreeType<$Value>,
  predicate: Predicate<$Value>,
): TreeType<$Value> => {
  if (tree.root === null) return tree

  const filterNode = (
    node: Node<$Value>,
    depth: number,
    path: $Value[],
  ): Node<$Value> | undefined => {
    const newPath = [...path, node.value]

    // First, recursively filter children
    const filteredChildren = node.children
      .map((child) => filterNode(child, depth + 1, newPath))
      .filter((child): child is Node<$Value> => child !== undefined)

    // Keep node if it matches OR has matching descendants
    const matches = predicate(node.value, depth, path)
    if (matches || filteredChildren.length > 0) {
      return {
        value: node.value,
        children: filteredChildren,
      }
    }

    return undefined
  }

  const filteredRoot = filterNode(tree.root, 0, [])
  return Tree(filteredRoot || null)
}

/**
 * Sort a tree's children at each level using a comparison function.
 * Recursively sorts all levels of the tree while preserving the hierarchy.
 *
 * @param tree - The tree to sort
 * @param compareFn - Function to compare node values (same as Array.sort)
 * @returns A new tree with sorted children at each level
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node('root', [
 *     Node('zebra', [Node('cat'), Node('ant')]),
 *     Node('apple', [Node('dog'), Node('bee')])
 *   ])
 * )
 *
 * // Sort alphabetically
 * const sorted = sort(tree, (a, b) => a.localeCompare(b))
 * // Result: Tree with root -> [apple -> [bee, dog], zebra -> [ant, cat]]
 *
 * // Sort numbers in descending order
 * const numTree = Tree(Node(0, [Node(3), Node(1), Node(2)]))
 * const descending = sort(numTree, (a, b) => b - a)
 * // Result: Tree with 0 -> [3, 2, 1]
 * ```
 */
export const sort = <$Value>(
  tree: TreeType<$Value>,
  compareFn: (a: $Value, b: $Value) => number,
): TreeType<$Value> => {
  if (tree.root === null) return tree

  const sortNode = (node: Node<$Value>): Node<$Value> => ({
    value: node.value,
    children: node.children
      .map((child) => sortNode(child))
      .sort((a, b) => compareFn(a.value, b.value)),
  })

  return Tree(sortNode(tree.root))
}

/**
 * Transform a tree by applying a mapping function to each node's value.
 * The tree structure is preserved, only values are transformed.
 *
 * @param tree - The tree to map
 * @param mapper - Function to transform each value
 * @returns A new tree with transformed values
 *
 * @example
 * ```ts
 * const stringTree = Tree(
 *   Node('hello', [
 *     Node('world', [Node('foo')]),
 *     Node('bar')
 *   ])
 * )
 *
 * // Transform to uppercase
 * const upperTree = map(stringTree, value => value.toUpperCase())
 * // Result: Tree with HELLO -> [WORLD -> [FOO], BAR]
 *
 * // Transform to lengths
 * const lengthTree = map(stringTree, value => value.length)
 * // Result: Tree with 5 -> [5 -> [3], 3]
 *
 * // Transform with depth info
 * const depthTree = map(stringTree, (value, depth) => `${value}@${depth}`)
 * // Result: Tree with hello@0 -> [world@1 -> [foo@2], bar@1]
 * ```
 */
export const map = <$FromValue, $ToValue>(
  tree: TreeType<$FromValue>,
  mapper: Mapper<$FromValue, $ToValue>,
): TreeType<$ToValue> => {
  if (tree.root === null) return Tree<$ToValue>(null)

  const mapNode = (node: Node<$FromValue>, depth: number, path: $FromValue[]): Node<$ToValue> => {
    const newPath = [...path, node.value]
    return {
      value: mapper(node.value, depth, path),
      children: node.children.map((child) => mapNode(child, depth + 1, newPath)),
    }
  }

  return Tree(mapNode(tree.root, 0, []))
}

/**
 * Update a specific node in the tree at the given path.
 * The path is an array of child indices from the tree root to target node.
 *
 * @param tree - The tree to update
 * @param path - Array of child indices leading to the target node
 * @param updater - Function to transform the target node
 * @returns A new tree with the updated node
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node('A', [
 *     Node('B', [
 *       Node('D'),
 *       Node('E')
 *     ]),
 *     Node('C')
 *   ])
 * )
 *
 * // Update node E at path [0, 0, 1] (first root child, first child, second grandchild)
 * const updated = updateAt(tree, [0, 0, 1], node =>
 *   Node('E-updated', node.children)
 * )
 *
 * // Update node B and add a child
 * const withNewChild = updateAt(tree, [0, 0], node =>
 *   Node(node.value, [...node.children, Node('F')])
 * )
 * ```
 */
export const updateAt = <$Value>(
  tree: TreeType<$Value>,
  path: number[],
  updater: (node: Node<$Value>) => Node<$Value>,
): TreeType<$Value> => {
  if (tree.root === null) return tree

  const updateNode = (node: Node<$Value>, remainingPath: number[]): Node<$Value> => {
    if (remainingPath.length === 0) {
      return updater(node)
    }

    const [index, ...rest] = remainingPath
    const children = [...node.children]

    if (index !== undefined && index >= 0 && index < children.length) {
      children[index] = updateNode(children[index]!, rest)
    }

    return { ...node, children }
  }

  if (path.length === 0) {
    // Update the root itself
    return Tree(updater(tree.root))
  }

  return Tree(updateNode(tree.root, path))
}

/**
 * Remove empty branches from a tree based on a custom emptiness check.
 * By default, removes all leaf nodes (nodes with no children).
 * Works bottom-up: prunes children first, then checks if parent becomes empty.
 * If the root is pruned, returns an empty tree.
 *
 * @param tree - The tree to prune
 * @param isEmpty - Function to determine if a node should be pruned (defaults to checking for no children)
 * @returns The pruned tree (may be empty)
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node('root', [
 *     Node('branch1', [
 *       Node('leaf1'),
 *       Node('leaf2')
 *     ]),
 *     Node('branch2'),  // empty branch
 *     Node('branch3', [Node('leaf3')])
 *   ])
 * )
 *
 * // Remove all leaves (default behavior)
 * const noLeaves = prune(tree)
 * // Result: Tree with root -> [branch1, branch3] (leaves removed)
 *
 * // Remove nodes with specific values
 * const filtered = prune(tree, node =>
 *   node.value.includes('leaf') ||
 *   (node.children.length === 0 && node.value === 'branch2')
 * )
 *
 * // Prune that removes root
 * const leafOnly = Tree(Node('leaf'))
 * const pruned = prune(leafOnly) // Returns empty tree { root: null }
 * ```
 */
export const prune = <$Value>(
  tree: TreeType<$Value>,
  isEmpty: (node: Node<$Value>) => boolean = (node) => node.children.length === 0,
): TreeType<$Value> => {
  if (tree.root === null) return tree

  const pruneNode = (node: Node<$Value>): Node<$Value> | undefined => {
    const prunedChildren = node.children
      .map((child) => pruneNode(child))
      .filter((child): child is Node<$Value> => child !== undefined)

    const prunedNode = { ...node, children: prunedChildren }

    // Remove this node if it's empty after pruning children
    if (isEmpty(prunedNode)) {
      return undefined
    }

    return prunedNode
  }

  const prunedRoot = pruneNode(tree.root)
  return Tree(prunedRoot || null)
}

/**
 * Reduce a tree to a single value by applying a reducer function to each node.
 * Processes nodes in depth-first order, accumulating a result.
 *
 * @param tree - The tree to reduce
 * @param reducer - Function to accumulate values
 * @param initial - The initial accumulator value
 * @returns The final accumulated value
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node(1, [
 *     Node(2, [Node(3), Node(4)]),
 *     Node(5)
 *   ])
 * )
 *
 * // Sum all values
 * const sum = reduce(tree, (acc, value) => acc + value, 0)
 * console.log(sum) // 15
 *
 * // Collect all values at depth 2
 * const depth2Values = reduce(tree,
 *   (acc, value, depth) => depth === 2 ? [...acc, value] : acc,
 *   [] as number[]
 * )
 * console.log(depth2Values) // [3, 4]
 *
 * // Build a path string
 * const pathString = reduce(tree,
 *   (acc, value, depth, path) =>
 *     acc + '  '.repeat(depth) + value + '\n',
 *   ''
 * )
 * ```
 */
export const reduce = <$Value, $Result>(
  tree: TreeType<$Value>,
  reducer: (acc: $Result, value: $Value, depth: number, path: $Value[]) => $Result,
  initial: $Result,
): $Result => {
  if (tree.root === null) return initial

  const reduceNode = (node: Node<$Value>, acc: $Result, depth: number, path: $Value[]): $Result => {
    const newAcc = reducer(acc, node.value, depth, path)
    const newPath = [...path, node.value]
    return node.children.reduce(
      (childAcc, child) => reduceNode(child, childAcc, depth + 1, newPath),
      newAcc,
    )
  }

  return reduceNode(tree.root, initial, 0, [])
}

/**
 * A function that defines how to merge two values when combining trees.
 *
 * @param a - The value from the first tree
 * @param b - The value from the second tree
 * @returns The merged value
 *
 * @example
 * ```ts
 * // Take the second value (default)
 * const takeSecond: MergeStrategy<string> = (a, b) => b
 *
 * // Concatenate strings
 * const concat: MergeStrategy<string> = (a, b) => `${a}+${b}`
 *
 * // Sum numbers
 * const sum: MergeStrategy<number> = (a, b) => a + b
 * ```
 */
export type MergeStrategy<$Value> = (a: $Value, b: $Value) => $Value

/**
 * Merge two trees by combining nodes with matching values.
 * Children are matched by their values and merged recursively.
 * Unmatched children from both trees are preserved.
 *
 * @param tree1 - The first tree
 * @param tree2 - The second tree
 * @param mergeValues - Strategy for merging node values (defaults to taking second value)
 * @returns A new merged tree
 *
 * @example
 * ```ts
 * const tree1 = Tree(
 *   Node('root', [
 *     Node('shared', [Node('a1')]),
 *     Node('only1')
 *   ])
 * )
 *
 * const tree2 = Tree(
 *   Node('root', [
 *     Node('shared', [Node('a2')]),
 *     Node('only2')
 *   ])
 * )
 *
 * // Default merge (take second value)
 * const merged = merge(tree1, tree2)
 * // Result: Tree with root -> [shared -> [a1, a2], only1, only2]
 *
 * // Custom merge strategy
 * const sumTree1 = Tree(Node(1, [Node(2), Node(3)]))
 * const sumTree2 = Tree(Node(10, [Node(2), Node(4)]))
 * const summed = merge(sumTree1, sumTree2, (a, b) => a + b)
 * // Result: Tree with 11 -> [4, 3, 4]
 * //   (2+2=4 for matching child, 3 from tree1, 4 from tree2)
 * ```
 */
export const merge = <$Value>(
  tree1: TreeType<$Value>,
  tree2: TreeType<$Value>,
  mergeValues: MergeStrategy<$Value> = (a, b) => b, // default: take second value
): TreeType<$Value> => {
  if (tree1.root === null) return tree2
  if (tree2.root === null) return tree1

  const mergeNode = (node1: Node<$Value>, node2: Node<$Value>): Node<$Value> => {
    // Merge the values using the provided strategy
    const mergedValue = mergeValues(node1.value, node2.value)

    // Create a map of node2's children for efficient lookup
    const node2ChildMap = new Map<unknown, Node<$Value>>()
    node2.children.forEach((child) => {
      // Use value as key, or could use a key extractor function
      node2ChildMap.set(child.value, child)
    })

    // Merge children
    const mergedChildren: Node<$Value>[] = []

    // Process node1's children
    node1.children.forEach((child1) => {
      const matchingChild2 = node2ChildMap.get(child1.value)
      if (matchingChild2) {
        mergedChildren.push(mergeNode(child1, matchingChild2))
        node2ChildMap.delete(child1.value)
      } else {
        mergedChildren.push(child1)
      }
    })

    // Add remaining children from node2
    node2ChildMap.forEach((child2) => {
      mergedChildren.push(child2)
    })

    return {
      value: mergedValue,
      children: mergedChildren,
    }
  }

  return Tree(mergeNode(tree1.root, tree2.root))
}

/**
 * Create a deep copy of a tree.
 * All nodes are cloned, creating a completely independent tree structure.
 *
 * @param tree - The tree to clone
 * @param cloneValue - Optional function to clone values (defaults to identity for primitives)
 * @returns A new tree with the same structure but independent nodes
 *
 * @example
 * ```ts
 * const original = Tree(
 *   Node('root', [
 *     Node('child1'),
 *     Node('child2')
 *   ])
 * )
 *
 * const copy = clone(original)
 * // Modifying copy doesn't affect original
 *
 * // With object values that need deep cloning
 * const objTree = Tree(
 *   Node({ id: 1, data: [1, 2, 3] })
 * )
 *
 * const cloned = clone(objTree, value => ({
 *   ...value,
 *   data: [...value.data]
 * }))
 * ```
 */
export const clone = <$Value>(
  tree: TreeType<$Value>,
  cloneValue: (value: $Value) => $Value = (v) => v,
): TreeType<$Value> => {
  if (tree.root === null) return Tree(null)

  const cloneNode = (node: Node<$Value>): Node<$Value> => ({
    value: cloneValue(node.value),
    children: node.children.map(cloneNode),
  })

  return Tree(cloneNode(tree.root))
}
