/**
 * A tree data structure with a single root node.
 * Trees are hierarchical structures where each tree has exactly one root.
 * An empty tree is represented as `{ root: null }`.
 *
 * @example
 * ```ts
 * // Create a tree
 * const tree: Tree<string> = {
 *   root: { value: 'root', children: [] }
 * }
 *
 * // Create an empty tree
 * const empty: Tree<string> = { root: null }
 *
 * // Or use the constructor
 * const tree2 = Tree(Node('root', [
 *   Node('child1'),
 *   Node('child2')
 * ]))
 * ```
 */
export interface Tree<$Value> {
  root: Node<$Value> | null
}

/**
 * Type alias for a collection of trees.
 * Use this when you need to work with multiple disconnected trees.
 *
 * @example
 * ```ts
 * const forest: Forest<string> = [
 *   Tree(Node('tree1')),
 *   Tree(Node('tree2')),
 *   Tree(Node('tree3'))
 * ]
 * ```
 */
export type Forest<$Value> = Tree<$Value>[]

/**
 * A node in a tree structure containing a value and an array of child nodes.
 *
 * @property value - The data stored in this node
 * @property children - Array of child nodes (empty array for leaf nodes)
 *
 * @example
 * ```ts
 * const node: Node<number> = {
 *   value: 42,
 *   children: [
 *     { value: 10, children: [] },
 *     { value: 20, children: [] }
 *   ]
 * }
 * ```
 */
export interface Node<$Value> {
  value: $Value
  children: Node<$Value>[]
}

/**
 * Create a new tree with a root node or empty tree.
 * This is a convenience constructor function for creating Tree objects.
 *
 * @param root - The root node of the tree, or null for an empty tree
 * @returns A new Tree object with the specified root
 *
 * @example
 * ```ts
 * // Create a tree with a single root node
 * const tree = Tree(
 *   Node('root', [
 *     Node('child1'),
 *     Node('child2')
 *   ])
 * )
 *
 * // Create a simple tree
 * const simple = Tree(Node('root'))
 *
 * // Create an empty tree
 * const empty = Tree<string>(null)
 *
 * // Create a deeper tree
 * const deep = Tree(
 *   Node('A', [
 *     Node('B', [
 *       Node('D'),
 *       Node('E')
 *     ]),
 *     Node('C')
 *   ])
 * )
 * ```
 */
export const Tree = <$Value>(root?: Node<$Value> | null): Tree<$Value> => ({
  root: root ?? null,
})

/**
 * Create a new tree node with the given value and optional children.
 * This is a convenience constructor function for creating Node objects.
 *
 * @param value - The value to store in the node
 * @param children - Optional array of child nodes (defaults to empty array)
 * @returns A new Node object with the specified value and children
 *
 * @example
 * ```ts
 * // Create a leaf node
 * const leaf = Node('leaf-value')
 *
 * // Create a node with children
 * const parent = Node('parent', [
 *   Node('child1'),
 *   Node('child2')
 * ])
 *
 * // Create a complex node structure
 * const root = Node('root', [
 *   Node('branch1', [
 *     Node('leaf1'),
 *     Node('leaf2')
 *   ]),
 *   Node('branch2', [
 *     Node('leaf3')
 *   ])
 * ])
 * ```
 */
export const Node = <$Value>(value: $Value, children: Node<$Value>[] = []): Node<$Value> => ({
  value,
  children,
})

/**
 * Check if a tree is empty (has no root).
 *
 * @param tree - The tree to check
 * @returns `true` if the tree has no root (is empty), `false` otherwise
 *
 * @example
 * ```ts
 * const empty = Tree<string>(null)
 * const leaf = Tree(Node('root'))
 * const withChildren = Tree(Node('root', [Node('child')]))
 *
 * console.log(isEmpty(empty))         // true
 * console.log(isEmpty(leaf))          // false
 * console.log(isEmpty(withChildren))  // false
 * ```
 */
export const isEmpty = <$Value>(tree: Tree<$Value>): boolean => {
  return tree.root === null
}

/**
 * Check if a node is a leaf (has no children).
 * Leaf nodes are the terminal nodes in a tree that have no descendants.
 *
 * @param node - The node to check
 * @returns `true` if the node has no children, `false` otherwise
 *
 * @example
 * ```ts
 * const leaf = Node('leaf')
 * const parent = Node('parent', [Node('child')])
 *
 * console.log(isLeaf(leaf))   // true
 * console.log(isLeaf(parent)) // false
 * ```
 */
export const isLeaf = <$Value>(node: Node<$Value>): boolean => {
  return node.children.length === 0
}
