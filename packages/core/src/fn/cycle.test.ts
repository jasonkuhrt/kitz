import { describe, expect, test } from 'bun:test'
import { createCycleTracker } from './cycle.js'

describe('createCycleTracker', () => {
  test('returns undefined for unseen keys', () => {
    const tracker = createCycleTracker<object, string>()
    const obj = { id: 1 }
    expect(tracker.getIfSeen(obj)).toBe(undefined)
  })

  test('returns tracked value for seen keys', () => {
    const tracker = createCycleTracker<object, string>()
    const obj = { id: 1 }
    tracker.track(obj, 'result')
    expect(tracker.getIfSeen(obj)).toBe('result')
  })

  test('track returns the value for fluent chaining', () => {
    const tracker = createCycleTracker<object, string>()
    const obj = { id: 1 }
    const result = tracker.track(obj, 'result')
    expect(result).toBe('result')
  })

  test('handles multiple keys independently', () => {
    const tracker = createCycleTracker<object, number>()
    const obj1 = { id: 1 }
    const obj2 = { id: 2 }

    tracker.track(obj1, 100)
    tracker.track(obj2, 200)

    expect(tracker.getIfSeen(obj1)).toBe(100)
    expect(tracker.getIfSeen(obj2)).toBe(200)
  })

  test('preserves type narrowing in return value', () => {
    const tracker = createCycleTracker<object, string | number>()
    const obj = { id: 1 }

    // track() preserves the specific type
    const result: string = tracker.track(obj, 'specific')
    expect(result).toBe('specific')
  })

  test('handles cyclic traversal with early tracking', () => {
    // Simulate a recursive traversal with cycle detection
    // KEY: You must track BEFORE recursing for cycles to be detected!
    interface Node {
      value: number
      children: Node[]
    }

    const tracker = createCycleTracker<Node, number>()
    const visitCounts = new Map<Node, number>()

    const sumTree = (node: Node): number => {
      visitCounts.set(node, (visitCounts.get(node) ?? 0) + 1)

      // Check if we've seen this node before
      const seen = tracker.getIfSeen(node)
      if (seen !== undefined) return seen

      // Track EARLY with the node's own value as a placeholder
      // This allows cycles to resolve (returning 0 for the cycle)
      tracker.track(node, 0) // Placeholder for cycle

      // Now recurse - if we hit this node again, we return 0
      const childSum = node.children.reduce((sum, child) => sum + sumTree(child), 0)

      // Update with final value (for future non-cyclic references)
      return tracker.track(node, node.value + childSum)
    }

    // Create a cyclic graph: a -> b -> a
    const nodeA: Node = { value: 1, children: [] }
    const nodeB: Node = { value: 2, children: [nodeA] }
    nodeA.children.push(nodeB)

    const result = sumTree(nodeA)

    // Should NOT infinite loop - cycle is detected
    expect(typeof result).toBe('number')
    // Each node visited exactly twice: once real processing, once cycle detection
    expect(visitCounts.get(nodeA)).toBe(2)
    expect(visitCounts.get(nodeB)).toBe(1)
  })

  test('early tracking enables cycle resolution', () => {
    // This demonstrates the pattern where you track early (before recursing)
    interface Node {
      value: number
      next?: Node
    }

    const tracker = createCycleTracker<Node, string>()

    const toString = (node: Node): string => {
      const seen = tracker.getIfSeen(node)
      if (seen !== undefined) return '[Circular]'

      // Track EARLY with a placeholder or partial result
      // For this case, we'll track immediately with the value portion
      const partial = `Node(${node.value})`
      tracker.track(node, partial) // Track before recursing!

      if (node.next) {
        const nextStr = toString(node.next)
        // Note: we can't update the tracked value, so the final string
        // won't include children. This is a limitation of this simple API.
        return `${partial} -> ${nextStr}`
      }
      return partial
    }

    // Create cycle: a -> b -> a
    const nodeA: Node = { value: 1 }
    const nodeB: Node = { value: 2, next: nodeA }
    nodeA.next = nodeB

    const result = toString(nodeA)
    expect(result).toContain('Node(1)')
    expect(result).toContain('Node(2)')
    expect(result).toContain('[Circular]')
  })
})
