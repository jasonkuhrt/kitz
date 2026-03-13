import { isLeaf } from './data.js'
import type { Node, Tree } from './data.js'
import type { Predicate } from './predicate.js'

/**
 * A function that visits a node in the tree during traversal.
 *
 * @param node - The current node being visited
 * @param depth - The depth of the current node (root is 0)
 * @param path - Array of ancestor values leading to this node (excluding current)
 * @returns The result of visiting the node
 *
 * @example
 * ```ts
 * // Simple visitor that collects values
 * const collectValues: Visitor<string, void> = (node, depth, path) => {
 *   console.log(`Found ${node.value} at depth ${depth}`)
 * }
 *
 * // Visitor that builds a result
 * const sumVisitor: Visitor<number, number> = (node, depth, path) => {
 *   return node.value + depth // Return value + depth
 * }
 *
 * // Visitor with path context
 * const pathVisitor: Visitor<string, void> = (node, depth, path) => {
 *   const fullPath = [...path, node.value].join('/')
 *   console.log(fullPath)
 * }
 * ```
 */
export type Visitor<$Value, $Result = void> = (
  node: Node<$Value>,
  depth: number,
  path: $Value[],
) => $Result

/**
 * Find the first node in the tree that matches the given predicate.
 * Uses depth-first search to traverse the tree.
 *
 * @param tree - The tree to search
 * @param predicate - Function that tests each node's value
 * @returns The first matching node, or undefined if no match is found
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node(1, [
 *     Node(2, [Node(4), Node(5)]),
 *     Node(3, [Node(6)])
 *   ])
 * )
 *
 * // Find node with value 5
 * const node = find(tree, value => value === 5)
 * console.log(node?.value) // 5
 *
 * // Find node at specific depth
 * const deepNode = find(tree, (value, depth) => depth === 2 && value > 4)
 * console.log(deepNode?.value) // 4
 * ```
 */
export const find = <$Value>(
  tree: Tree<$Value>,
  predicate: Predicate<$Value>,
): Node<$Value> | undefined => {
  if (tree.root === null) return undefined

  const findNode = (
    node: Node<$Value>,
    depth: number,
    path: $Value[],
  ): Node<$Value> | undefined => {
    if (predicate(node.value, depth, path)) {
      return node
    }
    const newPath = [...path, node.value]
    for (const child of node.children) {
      const found = findNode(child, depth + 1, newPath)
      if (found) return found
    }
    return undefined
  }

  return findNode(tree.root, 0, [])
}

/**
 * Find all nodes in the tree that match the given predicate.
 * Uses depth-first search to traverse the tree.
 *
 * @param tree - The tree to search
 * @param predicate - Function that tests each node's value
 * @returns Array of all matching nodes in depth-first order
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node(1, [
 *     Node(2, [Node(4), Node(5)]),
 *     Node(3, [Node(6)])
 *   ])
 * )
 *
 * // Find all even numbers
 * const evenNodes = findAll(tree, value => value % 2 === 0)
 * console.log(evenNodes.map(n => n.value)) // [2, 4, 6]
 *
 * // Find all nodes at depth 2
 * const depth2Nodes = findAll(tree, (value, depth) => depth === 2)
 * console.log(depth2Nodes.map(n => n.value)) // [4, 5, 6]
 * ```
 */
export const findAll = <$Value>(
  tree: Tree<$Value>,
  predicate: Predicate<$Value>,
): Node<$Value>[] => {
  if (tree.root === null) return []

  const results: Node<$Value>[] = []

  const findAllNodes = (node: Node<$Value>, depth: number, path: $Value[]): void => {
    if (predicate(node.value, depth, path)) {
      results.push(node)
    }
    const newPath = [...path, node.value]
    node.children.forEach((child) => findAllNodes(child, depth + 1, newPath))
  }

  findAllNodes(tree.root, 0, [])
  return results
}

/**
 * Calculate the maximum depth of the tree.
 * The depth is the length of the longest path from root to any leaf.
 * An empty tree has depth -1, a single node (leaf) has depth 0.
 *
 * @param tree - The tree to measure
 * @returns The maximum depth of the tree
 *
 * @remarks
 * This follows the traditional computer science convention where depth
 * counts edges, not nodes. An empty tree has depth -1 (no edges),
 * a single node has depth 0 (no edges from root to itself).
 * This differs from array.length which counts elements.
 *
 * @example
 * ```ts
 * const empty = Tree(null)
 * console.log(depth(empty)) // -1 (no tree)
 *
 * const leaf = Tree(Node('leaf'))
 * console.log(depth(leaf)) // 0 (no edges)
 *
 * const deep = Tree(
 *   Node('root', [
 *     Node('level1', [
 *       Node('level2', [
 *         Node('level3')
 *       ])
 *     ])
 *   ])
 * )
 * console.log(depth(deep)) // 3 (three edges from root to deepest leaf)
 * ```
 */
export const depth = <$Value>(tree: Tree<$Value>): number => {
  if (tree.root === null) return -1

  const nodeDepth = (node: Node<$Value>): number => {
    if (node.children.length === 0) return 0
    return 1 + Math.max(...node.children.map(nodeDepth))
  }

  return nodeDepth(tree.root)
}

/**
 * Count the total number of nodes in the tree.
 *
 * @param tree - The tree to count nodes in
 * @returns The total number of nodes in the tree
 *
 * @example
 * ```ts
 * const empty = Tree()
 * console.log(count(empty)) // 0
 *
 * const single = Tree(Node('single'))
 * console.log(count(single)) // 1
 *
 * const multi = Tree(
 *   Node('root', [
 *     Node('child1', [Node('grandchild1')]),
 *     Node('child2')
 *   ])
 * )
 * console.log(count(multi)) // 4
 * ```
 */
export const count = <$Value>(tree: Tree<$Value>): number => {
  if (tree.root === null) return 0

  const countNode = (node: Node<$Value>): number => {
    return 1 + node.children.reduce((sum, child) => sum + countNode(child), 0)
  }

  return countNode(tree.root)
}

/**
 * Get all leaf nodes in the tree.
 * Leaf nodes are nodes that have no children.
 *
 * @param tree - The tree to search for leaves
 * @returns Array of all leaf nodes in depth-first order
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node('root', [
 *     Node('branch', [
 *       Node('leaf1'),
 *       Node('leaf2')
 *     ]),
 *     Node('leaf3')
 *   ])
 * )
 *
 * const leafNodes = leaves(tree)
 * console.log(leafNodes.map(n => n.value)) // ['leaf1', 'leaf2', 'leaf3']
 * ```
 */
export const leaves = <$Value>(tree: Tree<$Value>): Node<$Value>[] => {
  if (tree.root === null) return []

  const leavesNode = (node: Node<$Value>): Node<$Value>[] => {
    if (isLeaf(node)) return [node]
    return node.children.flatMap(leavesNode)
  }

  return leavesNode(tree.root)
}

/**
 * Visit each node in the tree using depth-first traversal.
 * The visitor function is called for each node with its depth and path information.
 *
 * @param tree - The tree to traverse
 * @param visitor - Function to call for each node
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node('A', [
 *     Node('B', [Node('D'), Node('E')]),
 *     Node('C')
 *   ])
 * )
 *
 * // Print each node with its depth
 * visit(tree, (node, depth) => {
 *   console.log('  '.repeat(depth) + node.value)
 * })
 * // Output:
 * // A
 * // B
 * //     D
 * //     E
 * //   C
 *
 * // Collect all values at depth 2
 * const depth2Values: string[] = []
 * visit(tree, (node, depth) => {
 *   if (depth === 2) depth2Values.push(node.value)
 * })
 * console.log(depth2Values) // ['D', 'E']
 * ```
 */
export const visit = <$Value>(tree: Tree<$Value>, visitor: Visitor<$Value>): void => {
  if (tree.root === null) return

  const visitNode = (node: Node<$Value>, depth: number, path: $Value[]): void => {
    visitor(node, depth, path)
    const newPath = [...path, node.value]
    node.children.forEach((child) => visitNode(child, depth + 1, newPath))
  }

  visitNode(tree.root, 0, [])
}

/**
 * Test if all nodes in the tree satisfy the given predicate.
 * Returns true only if every node passes the test.
 * Returns true for empty trees.
 *
 * @param tree - The tree to test
 * @param predicate - Function that tests each node's value
 * @returns true if all nodes satisfy the predicate, false otherwise
 *
 * @example
 * ```ts
 * const numberTree = Tree(
 *   Node(10, [
 *     Node(20, [Node(30)]),
 *     Node(40)
 *   ])
 * )
 *
 * // Check if all values are positive
 * console.log(every(numberTree, value => value > 0)) // true
 *
 * // Check if all values are less than 35
 * console.log(every(numberTree, value => value < 35)) // false (40 fails)
 *
 * // Check depth constraint
 * console.log(every(numberTree, (value, depth) => depth <= 2)) // true
 * ```
 */
export const every = <$Value>(tree: Tree<$Value>, predicate: Predicate<$Value>): boolean => {
  if (tree.root === null) return true // vacuous truth for empty tree

  const everyNode = (node: Node<$Value>, depth: number, path: $Value[]): boolean => {
    if (!predicate(node.value, depth, path)) return false
    const newPath = [...path, node.value]
    return node.children.every((child) => everyNode(child, depth + 1, newPath))
  }

  return everyNode(tree.root, 0, [])
}

/**
 * Test if any node in the tree satisfies the given predicate.
 * Returns true if at least one node passes the test.
 * Returns false for empty trees.
 *
 * @param tree - The tree to test
 * @param predicate - Function that tests each node's value
 * @returns true if any node satisfies the predicate, false otherwise
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node('root', [
 *     Node('apple', [Node('red')]),
 *     Node('banana')
 *   ])
 * )
 *
 * // Check if any node contains 'apple'
 * console.log(some(tree, value => value.includes('apple'))) // true
 *
 * // Check if any leaf node exists
 * console.log(some(tree, (value, depth, path) =>
 *   path.length > 0 && depth > 1
 * )) // true (for 'red')
 * ```
 */
export const some = <$Value>(tree: Tree<$Value>, predicate: Predicate<$Value>): boolean => {
  if (tree.root === null) return false

  const someNode = (node: Node<$Value>, depth: number, path: $Value[]): boolean => {
    if (predicate(node.value, depth, path)) return true
    const newPath = [...path, node.value]
    return node.children.some((child) => someNode(child, depth + 1, newPath))
  }

  return someNode(tree.root, 0, [])
}

/**
 * Get the path from the tree root to a target node.
 * The path includes all nodes from root to target (inclusive).
 *
 * @param tree - The tree to search
 * @param target - Result a specific node reference or a predicate function to find the target
 * @returns Array of nodes from root to target, or undefined if target not found
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
 * // Find path to node with value 'E'
 * const pathToE = path(tree, value => value === 'E')
 * console.log(pathToE?.map(n => n.value)) // ['A', 'B', 'E']
 *
 * // Find path to specific node reference
 * const nodeD = tree.children[0].children[0].children[0]
 * const pathToD = path(tree, nodeD)
 * console.log(pathToD?.map(n => n.value)) // ['A', 'B', 'D']
 * ```
 */
export const path = <$Value>(
  tree: Tree<$Value>,
  target: Node<$Value> | ((value: $Value) => boolean),
): Node<$Value>[] | undefined => {
  if (tree.root === null) return undefined

  const pathNode = (
    node: Node<$Value>,
    currentPath: Node<$Value>[],
  ): Node<$Value>[] | undefined => {
    const newPath = [...currentPath, node]

    if (typeof target === 'function') {
      if (target(node.value)) return newPath
    } else if (node === target) {
      return newPath
    }

    for (const child of node.children) {
      const found = pathNode(child, newPath)
      if (found) return found
    }

    return undefined
  }

  return pathNode(tree.root, [])
}

/**
 * Get the path of values from the tree root to a node matching the predicate.
 * Similar to {@link path} but returns just the values instead of node objects.
 *
 * @param tree - The tree to search
 * @param predicate - Function that tests each node's value
 * @returns Array of values from root to target, or undefined if no match found
 *
 * @example
 * ```ts
 * const fileTree = Tree(
 *   Node('/', [
 *     Node('home', [
 *       Node('user', [
 *         Node('documents', [
 *           Node('file.txt')
 *         ])
 *       ])
 *     ])
 *   ])
 * )
 *
 * // Find path to file.txt
 * const filePath = pathTo(fileTree, value => value === 'file.txt')
 * console.log(filePath) // ['/', 'home', 'user', 'documents', 'file.txt']
 *
 * // Find path to any .txt file
 * const txtPath = pathTo(fileTree, value => value.endsWith('.txt'))
 * console.log(txtPath?.join('/')) // '/home/user/documents/file.txt'
 * ```
 */
export const pathTo = <$Value>(
  tree: Tree<$Value>,
  predicate: Predicate<$Value>,
): $Value[] | undefined => {
  if (tree.root === null) return undefined

  const pathToNode = (
    node: Node<$Value>,
    currentPath: $Value[],
    depth: number,
  ): $Value[] | undefined => {
    const newPath = [...currentPath, node.value]

    if (predicate(node.value, depth, currentPath)) {
      return newPath
    }

    for (const child of node.children) {
      const found = pathToNode(child, newPath, depth + 1)
      if (found) return found
    }

    return undefined
  }

  return pathToNode(tree.root, [], 0)
}

/**
 * Check if two trees are equal in structure and values.
 * Trees are equal if they have the same structure and all corresponding
 * nodes have equal values (using === comparison).
 *
 * @param tree1 - The first tree to compare
 * @param tree2 - The second tree to compare
 * @param valueEquals - Optional custom equality function for values (defaults to ===)
 * @returns true if trees are equal, false otherwise
 *
 * @example
 * ```ts
 * const tree1 = Tree(
 *   Node(1, [
 *     Node(2),
 *     Node(3)
 *   ])
 * )
 *
 * const tree2 = Tree(
 *   Node(1, [
 *     Node(2),
 *     Node(3)
 *   ])
 * )
 *
 * console.log(equals(tree1, tree2)) // true
 *
 * // With custom equality
 * const tree3 = Tree(Node({ id: 1, name: 'A' }))
 * const tree4 = Tree(Node({ id: 1, name: 'A' }))
 *
 * console.log(equals(tree3, tree4, (a, b) => a.id === b.id)) // true
 * ```
 */
export const equals = <$Value>(
  tree1: Tree<$Value>,
  tree2: Tree<$Value>,
  valueEquals: (a: $Value, b: $Value) => boolean = (a, b) => a === b,
): boolean => {
  if (tree1.root === null && tree2.root === null) return true
  if (tree1.root === null || tree2.root === null) return false

  const nodesEqual = (node1: Node<$Value>, node2: Node<$Value>): boolean => {
    if (!valueEquals(node1.value, node2.value)) return false
    if (node1.children.length !== node2.children.length) return false

    return node1.children.every((child1, index) => nodesEqual(child1, node2.children[index]!))
  }

  return nodesEqual(tree1.root, tree2.root)
}
