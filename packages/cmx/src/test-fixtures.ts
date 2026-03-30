/**
 * Shared test fixtures for @kitz/cmx tests.
 *
 * Centralizes the AppMap, commands, capabilities, and shortcuts used across
 * handle-key, command-resolver, session, cmx, and regression tests.
 * Update here, not in 6 separate files.
 */
import { Effect } from 'effect'
import { AppMap } from './app-map.js'
import { Capability } from './capability.js'
import { Command } from './command.js'

// --- Capabilities ---

export const reload = Capability.make({ name: 'reload', execute: Effect.void })
export const exportCap = Capability.make({ name: 'export', execute: Effect.void })
export const close = Capability.make({ name: 'close', execute: Effect.void })
export const reply = Capability.make({ name: 'reply', execute: Effect.void })
export const lazyOpen = Capability.make({ name: 'lazy-open', execute: Effect.void })
export const lazyReload = Capability.make({ name: 'reload', execute: Effect.void })

// --- Commands ---

export const reloadCmd = Command.Leaf.make({ name: 'reload', capability: reload })
export const exportCmd = Command.Leaf.make({ name: 'export', capability: exportCap })
export const closeCmd = Command.Leaf.make({ name: 'close', capability: close })
export const replyCmd = Command.Leaf.make({ name: 'reply', capability: reply })

export const configNs = Command.Namespace.make({ name: 'Config', children: [reloadCmd, exportCmd] })
export const bufferNs = Command.Namespace.make({ name: 'Buffer', children: [closeCmd] })
export const threadNs = Command.Namespace.make({ name: 'Thread', children: [replyCmd] })

export const lazyHybrid = Command.Hybrid.make({
  name: 'Lazy',
  capability: lazyOpen,
  children: [Command.Leaf.make({ name: 'reload', capability: lazyReload })],
})

// --- AppMap ---

export const appMap = AppMap.make({
  commands: [configNs, bufferNs],
  shortcuts: [{ key: 'r', command: reloadCmd }],
  children: [
    AppMap.Node.make({
      name: 'workspace',
      commands: [threadNs],
      shortcuts: [{ key: 't', command: replyCmd }],
    }),
  ],
})

// --- Common contexts ---

export const workspaceCtx = { path: ['workspace'] } as const
export const rootCtx = { path: [] as readonly string[] } as const

// --- Proximities ---

export const defaultProximities = new Map([
  ['Config', 2],
  ['Buffer', 1],
  ['Lazy', 3],
])
