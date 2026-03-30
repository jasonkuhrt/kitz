import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { AppMap } from './app-map.js'
import { Command } from './command.js'
import { Capability } from './capability.js'

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const reply = Capability.make({ name: 'reply', execute: Effect.void })
const nav = Capability.make({ name: 'nav', execute: Effect.void })
const close = Capability.make({ name: 'close', execute: Effect.void })

const reloadCmd = Command.Leaf.make({ name: 'reload', capability: reload })
const replyCmd = Command.Leaf.make({ name: 'reply', capability: reply })
const navCmd = Command.Leaf.make({ name: 'nav', capability: nav })
const closeCmd = Command.Leaf.make({ name: 'close', capability: close })

const configNs = Command.Namespace.make({ name: 'Config', children: [reloadCmd] })
const threadNs = Command.Namespace.make({ name: 'Thread', children: [replyCmd] })
const navNs = Command.Namespace.make({ name: 'Nav', children: [navCmd] })
const bufferNs = Command.Namespace.make({ name: 'Buffer', children: [closeCmd] })

describe('AppMap.make', () => {
  it('creates root with commands', () => {
    const map = AppMap.make({ commands: [navNs] })
    expect(map.commands).toHaveLength(1)
    expect(map.children).toEqual([])
  })

  it('creates with children', () => {
    const map = AppMap.make({
      commands: [navNs],
      children: [
        AppMap.Node.make({
          name: 'workspace',
          commands: [configNs],
          children: [AppMap.Node.make({ name: 'thread', commands: [threadNs] })],
        }),
      ],
    })
    expect(map.children).toHaveLength(1)
    expect(map.children[0].name).toBe('workspace')
    expect(map.children[0].children).toHaveLength(1)
  })
})

describe('AppMap.computeScope', () => {
  const map = AppMap.make({
    commands: [navNs],
    children: [
      AppMap.Node.make({
        name: 'workspace',
        commands: [configNs],
        children: [AppMap.Node.make({ name: 'thread', commands: [threadNs] })],
      }),
    ],
  })

  it('at root: only root commands visible', () => {
    const scope = AppMap.computeScope(map, [])
    expect(scope.commands.map((c) => c.name)).toEqual(['Nav'])
  })

  it('at workspace: workspace + root visible', () => {
    const scope = AppMap.computeScope(map, ['workspace'])
    const names = scope.commands.map((c) => c.name)
    expect(names).toContain('Config')
    expect(names).toContain('Nav')
  })

  it('at thread: thread + workspace + root visible, deepest first', () => {
    const scope = AppMap.computeScope(map, ['workspace', 'thread'])
    const names = scope.commands.map((c) => c.name)
    expect(names).toEqual(['Thread', 'Config', 'Nav'])
  })

  it('invalid path throws CmxInvalidPath', () => {
    expect(() => AppMap.computeScope(map, ['nonexistent'])).toThrow(/nonexistent/)
  })

  it('partially invalid path throws', () => {
    expect(() => AppMap.computeScope(map, ['workspace', 'nonexistent'])).toThrow()
  })
})

describe('AppMap.computeScope proximity', () => {
  const map = AppMap.make({
    commands: [navNs],
    children: [
      AppMap.Node.make({
        name: 'workspace',
        commands: [configNs],
        children: [AppMap.Node.make({ name: 'thread', commands: [threadNs] })],
      }),
    ],
  })

  it('assigns higher proximity to closer nodes', () => {
    const scope = AppMap.computeScope(map, ['workspace', 'thread'])
    const threadProx = scope.proximities.get('Thread')!
    const configProx = scope.proximities.get('Config')!
    const navProx = scope.proximities.get('Nav')!
    expect(threadProx).toBeGreaterThan(configProx)
    expect(configProx).toBeGreaterThan(navProx)
  })

  it('deepest node gets highest proximity', () => {
    const scope = AppMap.computeScope(map, ['workspace', 'thread'])
    // chain = [root(i=0), workspace(i=1), thread(i=2)]
    // proximity = i + 1: root=1, workspace=2, thread=3
    expect(scope.proximities.get('Thread')).toBe(3)
    expect(scope.proximities.get('Config')).toBe(2)
    expect(scope.proximities.get('Nav')).toBe(1)
  })
})

describe('AppMap.computeScope namespace uniqueness', () => {
  it('throws CmxDuplicateNamespace when same name at two nodes', () => {
    const map = AppMap.make({
      commands: [configNs],
      children: [
        AppMap.Node.make({
          name: 'workspace',
          commands: [Command.Namespace.make({ name: 'Config', children: [replyCmd] })],
        }),
      ],
    })
    expect(() => AppMap.computeScope(map, ['workspace'])).toThrow(/Config/)
  })
})

describe('AppMap.resolveShortcut', () => {
  const map = AppMap.make({
    shortcuts: [{ key: '?', command: navCmd }],
    children: [
      AppMap.Node.make({
        name: 'workspace',
        shortcuts: [{ key: 'n', command: reloadCmd }],
        children: [
          AppMap.Node.make({
            name: 'thread',
            shortcuts: [
              { key: 'r', command: replyCmd },
              { key: 'n', command: replyCmd }, // shadows workspace's 'n'
            ],
          }),
        ],
      }),
    ],
  })

  it('finds shortcut at deepest matching node', () => {
    const kb = AppMap.resolveShortcut(map, ['workspace', 'thread'], 'r')
    expect(kb?.command).toBe(replyCmd)
  })

  it('closer binding shadows farther for same key', () => {
    const kb = AppMap.resolveShortcut(map, ['workspace', 'thread'], 'n')
    expect(kb?.command).toBe(replyCmd) // thread's 'n', not workspace's
  })

  it('finds root shortcut', () => {
    const kb = AppMap.resolveShortcut(map, ['workspace', 'thread'], '?')
    expect(kb?.command).toBe(navCmd)
  })

  it('returns null for unbound key', () => {
    const kb = AppMap.resolveShortcut(map, ['workspace', 'thread'], 'x')
    expect(kb).toBeNull()
  })

  it('returns null for key bound at deeper node when not in path', () => {
    const kb = AppMap.resolveShortcut(map, ['workspace'], 'r')
    expect(kb).toBeNull()
  })

  describe('local shortcuts', () => {
    const localMap = AppMap.make({
      shortcuts: [
        { key: '?', command: navCmd },
        { key: 'h', command: navCmd, local: true },
      ],
      children: [
        AppMap.Node.make({
          name: 'workspace',
          shortcuts: [{ key: 'n', command: reloadCmd }],
          children: [AppMap.Node.make({ name: 'thread', shortcuts: [{ key: 'r', command: replyCmd }] })],
        }),
      ],
    })

    it('local binding resolves when node is deepest', () => {
      const kb = AppMap.resolveShortcut(localMap, [], 'h')
      expect(kb?.command).toBe(navCmd)
    })

    it('local binding is skipped when node is not deepest', () => {
      const kb = AppMap.resolveShortcut(localMap, ['workspace'], 'h')
      expect(kb).toBeNull()
    })

    it('local binding is skipped at deeper path', () => {
      const kb = AppMap.resolveShortcut(localMap, ['workspace', 'thread'], 'h')
      expect(kb).toBeNull()
    })

    it('inherited binding still resolves from non-deepest', () => {
      const kb = AppMap.resolveShortcut(localMap, ['workspace', 'thread'], '?')
      expect(kb?.command).toBe(navCmd)
    })
  })
})

describe('AppMap.getActiveShortcuts', () => {
  const map = AppMap.make({
    shortcuts: [{ key: '?', command: navCmd }],
    children: [
      AppMap.Node.make({
        name: 'workspace',
        shortcuts: [{ key: 'n', command: reloadCmd }],
        children: [
          AppMap.Node.make({
            name: 'thread',
            shortcuts: [{ key: 'r', command: replyCmd }],
          }),
        ],
      }),
    ],
  })

  it('returns shortcuts grouped by scope level, deepest first', () => {
    const groups = AppMap.getActiveShortcuts(map, ['workspace', 'thread'])
    expect(groups).toHaveLength(3)
    expect(groups[0].nodeName).toBe('thread')
    expect(groups[0].shortcuts[0].key).toBe('r')
    expect(groups[1].nodeName).toBe('workspace')
    expect(groups[1].shortcuts[0].key).toBe('n')
    expect(groups[2].nodeName).toBe('(root)')
    expect(groups[2].shortcuts[0].key).toBe('?')
  })

  it('omits nodes with no shortcuts', () => {
    const map2 = AppMap.make({
      children: [
        AppMap.Node.make({
          name: 'workspace',
          shortcuts: [{ key: 'n', command: reloadCmd }],
        }),
      ],
    })
    const groups = AppMap.getActiveShortcuts(map2, ['workspace'])
    expect(groups).toHaveLength(1)
    expect(groups[0].nodeName).toBe('workspace')
  })

  describe('local shortcuts', () => {
    const localMap = AppMap.make({
      shortcuts: [
        { key: '?', command: navCmd },
        { key: 'h', command: navCmd, local: true },
        { key: 'l', command: closeCmd, local: true },
      ],
      children: [
        AppMap.Node.make({
          name: 'workspace',
          shortcuts: [{ key: 'n', command: reloadCmd }],
        }),
      ],
    })

    it('includes local bindings when node is deepest', () => {
      const groups = AppMap.getActiveShortcuts(localMap, [])
      const rootGroup = groups.find((g) => g.nodeName === '(root)')
      expect(rootGroup?.shortcuts).toHaveLength(3) // ?, h, l
    })

    it('excludes local bindings when node is not deepest', () => {
      const groups = AppMap.getActiveShortcuts(localMap, ['workspace'])
      const rootGroup = groups.find((g) => g.nodeName === '(root)')
      expect(rootGroup?.shortcuts).toHaveLength(1) // only ?
      expect(rootGroup?.shortcuts[0].key).toBe('?')
    })

    it('omits node entirely when all bindings are local and not deepest', () => {
      const allLocalMap = AppMap.make({
        shortcuts: [{ key: 'h', command: navCmd, local: true }],
        children: [
          AppMap.Node.make({
            name: 'workspace',
            shortcuts: [{ key: 'n', command: reloadCmd }],
          }),
        ],
      })
      const groups = AppMap.getActiveShortcuts(allLocalMap, ['workspace'])
      expect(groups.find((g) => g.nodeName === '(root)')).toBeUndefined()
    })
  })
})
