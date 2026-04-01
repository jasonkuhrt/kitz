import { bench, describe } from 'vitest'
import { Effect } from 'effect'
import { Pat } from '@kitz/core'
import { AppMap } from './app-map.js'
import { Command } from './command.js'
import { Capability } from './capability.js'

// =============================================================================
// Benchmarks: measure shortcut filter cost with Pat.isMatch on hot path
//
// Scenario: 50 shortcuts in scope, mix of unconditional + conditional (if)
// Budget: <1ms for resolveShortcut + computeScope + getActiveShortcuts combined
//
// Run: bun run --cwd packages/cmx bench
// =============================================================================

// --- Fixtures ----------------------------------------------------------------

const cap = Capability.make({ name: 'action', execute: Effect.void })
const cmd = Command.Leaf.make({ name: 'action', capability: cap })

// 50 shortcuts: 25 unconditional, 25 conditional with `if` patterns
const shortcuts = Array.from({ length: 50 }, (_, i) => {
  const base = { key: `k${i}`, command: cmd } as const
  if (i % 2 === 0) return base
  return { ...base, if: { mode: `mode${i % 5}` } satisfies Pat.Pattern }
})

// 3-level deep AppMap: root → workspace → thread
// Shortcuts distributed across all levels
const appMap = AppMap.make({
  shortcuts: shortcuts.slice(0, 17),
  children: [
    AppMap.Node.make({
      name: 'workspace',
      shortcuts: shortcuts.slice(17, 34),
      children: [
        AppMap.Node.make({
          name: 'thread',
          shortcuts: shortcuts.slice(34),
        }),
      ],
    }),
  ],
})

const deepPath = ['workspace', 'thread'] as const
const state = { mode: 'mode1' }

// --- Benchmarks (profiling) --------------------------------------------------

describe('resolveShortcut — 50 shortcuts, 3-level path', () => {
  bench('unconditional shortcut (no if)', () => {
    AppMap.resolveShortcut(appMap, deepPath, 'k0', { state })
  })

  bench('conditional shortcut (with if, matches)', () => {
    AppMap.resolveShortcut(appMap, deepPath, 'k1', { state })
  })

  bench('miss — key not bound', () => {
    AppMap.resolveShortcut(appMap, deepPath, 'zzz', { state })
  })
})

describe('computeScope — 50 shortcuts, 3-level path', () => {
  bench('with state', () => {
    AppMap.computeScope(appMap, deepPath, { state })
  })

  bench('without state (all conditional skipped)', () => {
    AppMap.computeScope(appMap, deepPath)
  })
})

describe('getActiveShortcuts — 50 shortcuts, 3-level path', () => {
  bench('with state', () => {
    AppMap.getActiveShortcuts(appMap, deepPath, { state })
  })

  bench('without state', () => {
    AppMap.getActiveShortcuts(appMap, deepPath)
  })
})
