import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import * as TreeNamespace from './_.js'
import { arbitrary, arbitraryShapes } from './arbitrary.js'
import { fromList, manyFromList, toList } from './conversions.js'
import { Node, Tree, isEmpty, isLeaf } from './data.js'
import {
  count,
  depth,
  equals,
  find,
  findAll,
  leaves,
  path,
  pathTo,
  some,
  every,
  visit,
} from './queries.js'
import {
  clone,
  filter,
  filterPaths,
  map,
  merge,
  prune,
  reduce,
  sort,
  updateAt,
} from './transformations.js'

const sampleTree = Tree(
  Node('root', [
    Node('left', [Node('left.leaf')]),
    Node('right', [Node('right.leaf1'), Node('right.leaf2')]),
  ]),
)

const nodeDepth = <A>(node: { children: Array<{ children: A[] }> } | { children: A[] }): number => {
  const children = node.children as Array<{ children: A[] }>
  if (children.length === 0) return 0
  return 1 + Math.max(...children.map((child) => nodeDepth(child)))
}

const nodeCount = <A>(node: { children: Array<{ children: A[] }> } | { children: A[] }): number => {
  const children = node.children as Array<{ children: A[] }>
  return 1 + children.reduce((sum, child) => sum + nodeCount(child), 0)
}

describe('tree', () => {
  test('exports the namespace and core constructors', () => {
    expect(TreeNamespace.Tree.fromList).toBe(fromList)
    expect(TreeNamespace.Tree.merge).toBe(merge)
    expect(Tree()).toEqual({ root: null })
    expect(Tree(Node('branch')).root?.value).toBe('branch')
    expect(isEmpty(Tree())).toBe(true)
    expect(isEmpty(sampleTree)).toBe(false)
    expect(isLeaf(Node('leaf'))).toBe(true)
    expect(isLeaf(Node('branch', [Node('leaf')]))).toBe(false)
  })

  test('converts between tree and list representations', () => {
    const records = [
      { id: 'root', label: 'Root' },
      { id: 'left', parentId: 'root', label: 'Left' },
      { id: 'right', parentId: 'root', label: 'Right' },
      { id: 'orphan', label: 'Orphan' },
      { id: 'missing-child', parentId: 'missing', label: 'Ignored child' },
    ]

    expect(toList(Tree<string>())).toEqual([])
    expect(toList(sampleTree)).toEqual([
      'root',
      'left',
      'left.leaf',
      'right',
      'right.leaf1',
      'right.leaf2',
    ])

    const forest = manyFromList(records)
    expect(forest).toHaveLength(2)
    expect(forest.map((tree) => tree.root?.value.id)).toEqual(['root', 'orphan'])
    expect(forest[0]?.root?.children.map((child) => child.value.id)).toEqual(['left', 'right'])

    const single = fromList(records.filter((record) => record.id !== 'orphan'))
    expect(single.root?.value.id).toBe('root')
    expect(fromList([{ id: 'child', parentId: 'missing' }], 'top').root).toBe(null)
    expect(() => fromList(records)).toThrow('Found multiple root nodes, count: 2')
  })

  test('supports tree queries with depth and path context', () => {
    const found = find(
      sampleTree,
      (value, currentDepth, currentPath) =>
        currentDepth === 2 && currentPath.join('/') === 'root/right' && value === 'right.leaf2',
    )
    const allLeaves = findAll(sampleTree, (value) => value.includes('leaf'))
    const visited: string[] = []

    visit(sampleTree, (node, currentDepth, currentPath) => {
      visited.push(`${currentDepth}:${currentPath.join('/')}:${node.value}`)
    })

    expect(found?.value).toBe('right.leaf2')
    expect(find(Tree<string>(), () => true)).toBeUndefined()
    expect(allLeaves.map((node) => node.value)).toEqual(['left.leaf', 'right.leaf1', 'right.leaf2'])
    expect(depth(Tree<string>())).toBe(-1)
    expect(depth(sampleTree)).toBe(2)
    expect(count(sampleTree)).toBe(6)
    expect(leaves(sampleTree).map((node) => node.value)).toEqual([
      'left.leaf',
      'right.leaf1',
      'right.leaf2',
    ])
    expect(visited).toEqual([
      '0::root',
      '1:root:left',
      '2:root/left:left.leaf',
      '1:root:right',
      '2:root/right:right.leaf1',
      '2:root/right:right.leaf2',
    ])
    expect(every(Tree<string>(), () => false)).toBe(true)
    expect(every(sampleTree, (value) => value !== 'right.leaf2')).toBe(false)
    expect(some(Tree<string>(), () => true)).toBe(false)
    expect(
      some(sampleTree, (value, currentDepth) => currentDepth === 2 && value === 'left.leaf'),
    ).toBe(true)
    expect(path(sampleTree, (value) => value === 'right.leaf1')?.map((node) => node.value)).toEqual(
      ['root', 'right', 'right.leaf1'],
    )

    const targetNode = sampleTree.root?.children[1]?.children[1]
    if (!targetNode) throw new Error('expected sample tree to contain right.leaf2')
    expect(path(sampleTree, targetNode)?.map((node) => node.value)).toEqual([
      'root',
      'right',
      'right.leaf2',
    ])
    expect(
      pathTo(sampleTree, (value, currentDepth, currentPath) => {
        return (
          currentDepth === 2 &&
          currentPath[currentPath.length - 1] === 'right' &&
          value.endsWith('2')
        )
      }),
    ).toEqual(['root', 'right', 'right.leaf2'])

    const objectTreeA = Tree(Node({ id: 1, label: 'A' }, [Node({ id: 2, label: 'B' })]))
    const objectTreeB = Tree(Node({ id: 1, label: 'X' }, [Node({ id: 2, label: 'Y' })]))
    const objectTreeC = Tree(Node({ id: 1, label: 'X' }, [Node({ id: 3, label: 'Z' })]))
    expect(equals(objectTreeA, objectTreeB, (a, b) => a.id === b.id)).toBe(true)
    expect(equals(objectTreeA, objectTreeC, (a, b) => a.id === b.id)).toBe(false)
  })

  test('supports filtering, mapping, reducing, merging, and cloning trees', () => {
    const filtered = filter(sampleTree, (value) => value !== 'right' && !value.endsWith('2'))
    const preservedPaths = filterPaths(sampleTree, (value) => value === 'right.leaf2')
    const sorted = sort(
      Tree(
        Node('root', [
          Node('zebra', [Node('cat'), Node('ant')]),
          Node('apple', [Node('dog'), Node('bee')]),
        ]),
      ),
      (a, b) => a.localeCompare(b),
    )
    const mapped = map(sampleTree, (value, currentDepth, currentPath) => {
      return `${currentDepth}:${currentPath.join('/')}:${value.toUpperCase()}`
    })
    const updatedNested = updateAt(sampleTree, [1, 0], (node) =>
      Node(`${node.value}!`, node.children),
    )
    const updatedRoot = updateAt(sampleTree, [], (node) => Node(`${node.value}!`, node.children))
    const ignoredUpdate = updateAt(sampleTree, [99], (node) => Node('never', node.children))
    const defaultPruned = prune(Tree(Node('root', [Node('branch', [Node('leaf')]), Node('solo')])))
    const customPruned = prune(
      Tree(Node('root', [Node('keep', [Node('drop')]), Node('also-keep')])),
      (node) => node.value === 'drop',
    )
    const reduced = reduce(
      sampleTree,
      (acc, value, currentDepth, currentPath) =>
        acc.concat(`${currentDepth}:${currentPath.join('/')}:${value}`),
      [] as string[],
    )
    const merged = merge(
      Tree(Node('root', [Node('shared', [Node('left-only')]), Node('first-only')])),
      Tree(Node('ROOT', [Node('shared', [Node('right-only')]), Node('second-only')])),
      (a, b) => `${a}+${b}`,
    )
    const original = Tree(
      Node({ label: 'root', items: ['a'] }, [Node({ label: 'leaf', items: ['b'] })]),
    )
    const copied = clone(original, (value) => ({ ...value, items: [...value.items] }))

    copied.root!.value.items.push('changed')
    copied.root!.children[0]!.value.items.push('changed-child')

    expect(filtered.root?.children.map((node) => node.value)).toEqual(['left'])
    expect(preservedPaths.root?.children.map((node) => node.value)).toEqual(['right'])
    expect(preservedPaths.root?.children[0]?.children.map((node) => node.value)).toEqual([
      'right.leaf2',
    ])
    expect(sorted.root?.children.map((node) => node.value)).toEqual(['apple', 'zebra'])
    expect(sorted.root?.children[0]?.children.map((node) => node.value)).toEqual(['bee', 'dog'])
    expect(mapped.root?.children[1]?.children[0]?.value).toBe('2:root/right:RIGHT.LEAF1')
    expect(updatedNested.root?.children[1]?.children[0]?.value).toBe('right.leaf1!')
    expect(updatedRoot.root?.value).toBe('root!')
    expect(ignoredUpdate).toEqual(sampleTree)
    expect(defaultPruned.root).toBe(null)
    expect(customPruned.root?.children.map((node) => node.value)).toEqual(['keep', 'also-keep'])
    expect(customPruned.root?.children[0]?.children).toEqual([])
    expect(reduced).toContain('2:root/right:right.leaf2')
    expect(merged.root?.value).toBe('root+ROOT')
    expect(merged.root?.children.map((node) => node.value)).toEqual([
      'shared+shared',
      'first-only',
      'second-only',
    ])
    expect(merged.root?.children[0]?.children.map((node) => node.value)).toEqual([
      'left-only',
      'right-only',
    ])
    expect(original.root?.value.items).toEqual(['a'])
    expect(original.root?.children[0]?.value.items).toEqual(['b'])
  })

  test('builds arbitrary trees and common tree shapes', () => {
    const generatedTrees = fc.sample(
      arbitrary(fc.constantFrom('root', 'branch', 'leaf'), {
        maxDepth: 2,
        maxChildren: 2,
        minChildren: 1,
        leafWeight: 2,
      }),
      { numRuns: 20, seed: 12345 },
    )
    const depthZeroTrees = fc.sample(arbitrary(fc.constant('leaf'), { maxDepth: 0 }), {
      numRuns: 10,
      seed: 54321,
    })
    const leafNode = fc.sample(arbitraryShapes.leaf(fc.constant('leaf')), {
      numRuns: 1,
      seed: 1,
    })[0]!
    const exactDepthLeaf = fc.sample(arbitraryShapes.withDepth(fc.constant('leaf'), 0), {
      numRuns: 1,
      seed: 2,
    })[0]!
    const exactDepthTree = fc.sample(arbitraryShapes.withDepth(fc.constant('node'), 2), {
      numRuns: 1,
      seed: 3,
    })[0]!
    const linearLeaf = fc.sample(arbitraryShapes.linear(fc.constant('only'), 1), {
      numRuns: 1,
      seed: 4,
    })[0]!
    const linearTree = fc.sample(arbitraryShapes.linear(fc.constant('line'), 4), {
      numRuns: 1,
      seed: 5,
    })[0]!
    const balancedLeaf = fc.sample(arbitraryShapes.balanced(fc.constant('leaf'), 0), {
      numRuns: 1,
      seed: 6,
    })[0]!
    const balancedTree = fc.sample(arbitraryShapes.balanced(fc.constant('balanced'), 2, 2), {
      numRuns: 1,
      seed: 7,
    })[0]!
    const wideLeaf = fc.sample(arbitraryShapes.wide(fc.constant('leaf'), 4, 0), {
      numRuns: 1,
      seed: 8,
    })[0]!
    const wideTree = fc.sample(arbitraryShapes.wide(fc.constant('wide'), 4, 1), {
      numRuns: 1,
      seed: 9,
    })[0]!

    expect(generatedTrees.some((tree) => tree.root === null)).toBe(true)
    expect(
      generatedTrees.filter((tree) => tree.root !== null).every((tree) => depth(tree) <= 2),
    ).toBe(true)
    expect(generatedTrees.every((tree) => every(tree, (_, __, path) => path.length <= 2))).toBe(
      true,
    )
    expect(
      generatedTrees
        .flatMap((tree) => (tree.root ? [tree.root, ...findAll(tree, () => true)] : []))
        .every((node) => node.children.length <= 2),
    ).toBe(true)
    expect(
      depthZeroTrees.every((tree) => tree.root === null || tree.root.children.length === 0),
    ).toBe(true)
    expect(leafNode.children).toEqual([])
    expect(exactDepthLeaf.children).toEqual([])
    expect(nodeDepth(exactDepthTree)).toBe(2)
    expect(linearLeaf.children).toEqual([])
    expect(nodeCount(linearTree)).toBe(4)
    expect(every(Tree(linearTree), (_value, _depth, currentPath) => currentPath.length <= 3)).toBe(
      true,
    )
    expect(balancedLeaf.children).toEqual([])
    expect(nodeDepth(balancedTree)).toBe(2)
    expect(balancedTree.children).toHaveLength(2)
    expect(leaves(Tree(balancedTree))).toHaveLength(4)
    expect(wideLeaf.children).toEqual([])
    expect(wideTree.children.length).toBeGreaterThanOrEqual(2)
    expect(wideTree.children.length).toBeLessThanOrEqual(4)
  })
})
