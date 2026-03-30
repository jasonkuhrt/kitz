import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { Command, collectExecutablePaths } from './command.js'
import { Capability } from './capability.js'

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const exportCap = Capability.make({ name: 'export', execute: Effect.void })
const close = Capability.make({ name: 'close', execute: Effect.void })
const lazyOpen = Capability.make({ name: 'lazy-open', execute: Effect.void })
const lazyReload = Capability.make({ name: 'reload', execute: Effect.void })
const lazyHealth = Capability.make({ name: 'health', execute: Effect.void })

describe('Command.Leaf', () => {
  it('creates with capability', () => {
    const cmd = Command.Leaf.make({ name: 'reload', capability: reload })
    expect(cmd._tag).toBe('Leaf')
    expect(cmd.name).toBe('reload')
    expect(cmd.capability).toBe(reload)
  })

  it('accepts documentation fields', () => {
    const cmd = Command.Leaf.make({
      name: 'reload',
      capability: reload,
      description: 'Reload config',
      aliases: ['refresh'],
      tags: ['config'],
      warning: 'Unsaved changes lost',
      confirmation: true,
      deprecated: { replacement: 'Config refresh' },
      group: 'admin',
    })
    expect(cmd.description).toBe('Reload config')
    expect(cmd.aliases).toEqual(['refresh'])
    expect(cmd.confirmation).toBe(true)
    expect(cmd.deprecated?.replacement).toBe('Config refresh')
    expect(cmd.group).toBe('admin')
  })
})

describe('Command.Namespace', () => {
  it('creates with children', () => {
    const leaf = Command.Leaf.make({ name: 'reload', capability: reload })
    const ns = Command.Namespace.make({ name: 'Config', children: [leaf] })
    expect(ns._tag).toBe('Namespace')
    expect(ns.children).toHaveLength(1)
  })

  it('creates nested namespaces', () => {
    const inner = Command.Namespace.make({
      name: 'refactor',
      children: [Command.Leaf.make({ name: 'rename', capability: reload })],
    })
    const outer = Command.Namespace.make({
      name: 'Lsp',
      children: [inner],
    })
    expect(outer.children).toHaveLength(1)
    expect(outer.children[0]._tag).toBe('Namespace')
  })
})

describe('Command.Namespace.fromCapabilities', () => {
  it('returns namespace and typed leaf handles', () => {
    const { namespace, commands } = Command.Namespace.fromCapabilities({
      name: 'Config',
      capabilities: { reload, export: exportCap },
    })
    expect(namespace._tag).toBe('Namespace')
    expect(namespace.name).toBe('Config')
    expect(namespace.children).toHaveLength(2)
    expect(commands.reload._tag).toBe('Leaf')
    expect(commands.reload.name).toBe('reload')
    expect(commands.export._tag).toBe('Leaf')
    expect(commands.export.name).toBe('export')
  })

  it('leaf names come from capability names', () => {
    const { commands } = Command.Namespace.fromCapabilities({
      name: 'Config',
      capabilities: { reload },
    })
    expect(commands.reload.name).toBe('reload')
  })

  it('passes description to namespace', () => {
    const { namespace } = Command.Namespace.fromCapabilities({
      name: 'Config',
      description: 'Configuration management',
      capabilities: { reload },
    })
    expect(namespace.description).toBe('Configuration management')
  })
})

describe('Command.Hybrid', () => {
  it('creates with capability and children', () => {
    const child = Command.Leaf.make({ name: 'health', capability: lazyHealth })
    const hybrid = Command.Hybrid.make({
      name: 'Lazy',
      capability: lazyOpen,
      children: [child],
    })
    expect(hybrid._tag).toBe('Hybrid')
    expect(hybrid.capability).toBe(lazyOpen)
    expect(hybrid.children).toHaveLength(1)
  })
})

describe('collectExecutablePaths', () => {
  const configNs = Command.Namespace.make({
    name: 'Config',
    children: [
      Command.Leaf.make({ name: 'reload', capability: reload }),
      Command.Leaf.make({ name: 'export', capability: exportCap }),
    ],
  })
  const bufferNs = Command.Namespace.make({
    name: 'Buffer',
    children: [Command.Leaf.make({ name: 'close', capability: close })],
  })
  const lazyHybrid = Command.Hybrid.make({
    name: 'Lazy',
    capability: lazyOpen,
    children: [
      Command.Leaf.make({ name: 'reload', capability: lazyReload }),
      Command.Leaf.make({ name: 'health', capability: lazyHealth }),
    ],
  })

  it('collects leaf paths', () => {
    const paths = collectExecutablePaths([configNs])
    expect(paths.map(p => p.path)).toEqual(['Config reload', 'Config export'])
  })

  it('collects from multiple namespaces', () => {
    const paths = collectExecutablePaths([configNs, bufferNs])
    expect(paths.map(p => p.path)).toEqual([
      'Config reload',
      'Config export',
      'Buffer close',
    ])
  })

  it('includes hybrid itself and its children', () => {
    const paths = collectExecutablePaths([lazyHybrid])
    expect(paths.map(p => p.path)).toEqual([
      'Lazy',
      'Lazy reload',
      'Lazy health',
    ])
  })

  it('handles nested namespaces', () => {
    const lsp = Command.Namespace.make({
      name: 'Lsp',
      children: [
        Command.Leaf.make({ name: 'references', capability: reload }),
        Command.Namespace.make({
          name: 'refactor',
          children: [
            Command.Leaf.make({ name: 'rename', capability: reload }),
          ],
        }),
      ],
    })
    const paths = collectExecutablePaths([lsp])
    expect(paths.map(p => p.path)).toEqual([
      'Lsp references',
      'Lsp refactor rename',
    ])
  })
})
