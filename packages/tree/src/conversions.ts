import { Node, Tree } from './data.js'
import type { Forest, Tree as TreeType } from './data.js'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • List
//
//

/**
 * Flatten a tree into an array using depth-first traversal.
 * All node values are collected in the order they would be visited
 * in a depth-first search.
 *
 * @param tree - The tree to flatten
 * @returns Array containing all values in depth-first order
 *
 * @example
 * ```ts
 * const tree = Tree(
 *   Node('A', [
 *     Node('B', [
 *       Node('D'),
 *       Node('E')
 *     ]),
 *     Node('C', [Node('F')])
 *   ])
 * )
 *
 * const list = toList(tree)
 * console.log(list) // ['A', 'B', 'D', 'E', 'C', 'F']
 *
 * // Works with any value type
 * const numTree = Tree(
 *   Node(1, [
 *     Node(2, [Node(4), Node(5)]),
 *     Node(3)
 *   ])
 * )
 * console.log(toList(numTree)) // [1, 2, 4, 5, 3]
 * ```
 */
export const toList = <$Value>(tree: TreeType<$Value>): $Value[] => {
  if (tree.root === null) return []

  const toListNode = (node: Node<$Value>): $Value[] => {
    const result: $Value[] = [node.value]
    node.children.forEach((child) => {
      result.push(...toListNode(child))
    })
    return result
  }

  return toListNode(tree.root)
}

/**
 * Build trees from a flat list of items with parent references.
 * Each item must have an `id` and optionally a `parentId` to establish hierarchy.
 * Items with no parent or matching rootId become root nodes.
 * Returns a forest (array of trees) as there may be multiple root nodes.
 *
 * @param values - Array of items with id and parentId properties
 * @param rootId - Optional ID to use as the root parent (defaults to undefined)
 * @returns A forest (array of trees) containing all root nodes
 *
 * @example
 * ```ts
 * const items = [
 *   { id: '1', name: 'Root' },
 *   { id: '2', parentId: '1', name: 'Child A' },
 *   { id: '3', parentId: '1', name: 'Child B' },
 *   { id: '4', parentId: '2', name: 'Grandchild' },
 *   { id: '5', name: 'Another Root' }
 * ]
 *
 * const forest = fromList(items)
 * // Result: Forest with two trees:
 * // [
 * //   Tree(Root -> [Child A -> [Grandchild], Child B]),
 * //   Tree(Another Root)
 * // ]
 *
 * // Build tree with specific root
 * const categories = [
 *   { id: 'electronics', parentId: 'root' },
 *   { id: 'computers', parentId: 'electronics' },
 *   { id: 'phones', parentId: 'electronics' },
 *   { id: 'laptops', parentId: 'computers' }
 * ]
 *
 * const categoryForest = fromList(categories, 'root')
 * // Result: Forest with one tree:
 * // [Tree(electronics -> [computers -> [laptops], phones])]
 * ```
 */
export const manyFromList = <value extends { id: string; parentId?: string | null }>(
  values: value[],
  rootId?: string,
): Forest<value> => {
  const roots: Node<value>[] = []
  const nodeMap = new Map<string, Node<value>>()

  // Create all nodes
  values.forEach((item) => {
    nodeMap.set(item.id, Node(item))
  })

  // Build hierarchy
  values.forEach((item) => {
    const itemNode = nodeMap.get(item.id)!
    if (item.parentId === rootId || !item.parentId) {
      // Items match the rootId OR have no parent (orphans) become roots
      roots.push(itemNode)
    } else if (item.parentId) {
      const parent = nodeMap.get(item.parentId)
      if (parent) {
        parent.children.push(itemNode)
      }
    }
  })

  return roots.map((root) => Tree(root))
}

/**
 * Build a tree from a flat list expecting at most one root node.
 * Returns an empty tree if no roots are found.
 * Throws an error if multiple root nodes are found.
 *
 * @param values - Array of items with id and parentId properties
 * @param rootId - Optional ID to use as the root parent (defaults to undefined)
 * @returns Tree with single root node or empty tree
 * @throws Error if multiple roots are found
 *
 * @example
 * ```ts
 * const items = [
 *   { id: '1', name: 'Root' },
 *   { id: '2', parentId: '1', name: 'Child A' },
 *   { id: '3', parentId: '1', name: 'Child B' },
 *   { id: '4', parentId: '2', name: 'Grandchild' }
 * ]
 *
 * const tree = fromList(items)
 * console.log(tree.root!.value.name) // 'Root'
 *
 * // Error case: multiple roots
 * const multipleRoots = [
 *   { id: '1', name: 'Root 1' },
 *   { id: '2', name: 'Root 2' }
 * ]
 * fromList(multipleRoots) // Throws: Found multiple root nodes, count: 2
 *
 * // Empty tree case: no roots
 * const noRoots = [
 *   { id: '1', parentId: 'missing', name: 'Orphan' }
 * ]
 * const emptyTree = fromList(noRoots, 'root')
 * console.log(emptyTree.root) // null
 * ```
 */
export const fromList = <value extends { id: string; parentId?: string | null }>(
  values: value[],
  rootId?: string,
): Tree<value> => {
  const forest = manyFromList(values, rootId)

  if (forest.length > 1) {
    throw new Error(`Found multiple root nodes, count: ${forest.length}`)
  }

  return forest[0] ?? Tree()
}
