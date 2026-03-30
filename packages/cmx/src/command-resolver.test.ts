import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { CommandResolver } from './command-resolver.js'
import { Command } from './command.js'
import { Capability } from './capability.js'

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const exportCap = Capability.make({ name: 'export', execute: Effect.void })
const close = Capability.make({ name: 'close', execute: Effect.void })
const lazyOpen = Capability.make({ name: 'lazy-open', execute: Effect.void })
const lazyReload = Capability.make({ name: 'reload', execute: Effect.void })

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
  children: [Command.Leaf.make({ name: 'reload', capability: lazyReload })],
})

const proximities = new Map([['Config', 2], ['Buffer', 1], ['Lazy', 3]])

describe('CommandResolver initial state', () => {
  it('starts in flat mode', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    const res = resolver.getResolution()
    expect(res.mode).toBe('flat')
    expect(res.query).toBe('')
    expect(res.acceptedTokens).toEqual([])
  })

  it('flat mode shows all executable paths', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    const res = resolver.getResolution()
    const tokens = res.choices.map((c) => c.token)
    expect(tokens).toContain('Config reload')
    expect(tokens).toContain('Config export')
    expect(tokens).toContain('Buffer close')
  })

  it('flat mode includes hybrids', () => {
    const resolver = CommandResolver.create([configNs, lazyHybrid], proximities)
    const res = resolver.getResolution()
    const tokens = res.choices.map((c) => c.token)
    expect(tokens).toContain('Lazy')
    expect(tokens).toContain('Lazy reload')
  })

  it('flat mode does NOT include namespaces as choices', () => {
    const resolver = CommandResolver.create([configNs], proximities)
    const res = resolver.getResolution()
    const tokens = res.choices.map((c) => c.token)
    expect(tokens).not.toContain('Config')
  })
})

describe('queryPush — filtering', () => {
  it('filters choices by query', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    // 'C' matches: "Config reload", "Config export", "Buffer close" (all contain C/c)
    const res = resolver.queryPush('C')
    // Multiple matches, so no auto-advance
    expect(res.choices.length).toBeGreaterThan(0)
    // All remaining choices should contain 'C' (case-insensitive)
    for (const choice of res.choices) {
      expect(choice.token.toLowerCase()).toContain('c')
    }
  })

  it('progressively narrows choices', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    const res1 = resolver.queryPush('C')
    const count1 = res1.choices.length
    // "Cl" narrows further — only "Buffer close" contains "cl"
    const res2 = resolver.queryPush('l')
    // Should have fewer or equal choices
    expect(res2.choices.length).toBeLessThanOrEqual(count1)
  })
})

describe('queryPush — dead-end prevention', () => {
  it('rejects characters that produce zero matches', () => {
    const resolver = CommandResolver.create([configNs], proximities)
    const res = resolver.queryPush('z')
    // 'z' should not match anything — rejected
    // But wait, "Config export" doesn't contain z, "Config reload" doesn't contain z
    // So dead-end prevention should reject
    expect(res.query).toBe('')
    expect(res.choices.length).toBeGreaterThan(0)
  })
})

describe('queryPush — auto-advance', () => {
  it('auto-advances when choices narrow to 1', () => {
    // With configNs having reload and export:
    // "r" matches both "Config reload" and "Config export" (both contain 'r') → no auto-advance
    // "re" matches only "Config reload" (only one contains 're') → auto-advance!
    const resolver = CommandResolver.create([configNs], proximities)
    resolver.queryPush('r')
    const afterR = resolver.getResolution()
    // 'r' appears in both "Config reload" and "Config export" → 2 matches, no auto-advance
    expect(afterR.acceptedTokens.length).toBe(0)

    resolver.queryPush('e')
    const afterRe = resolver.getResolution()
    // 're' only in "Config reload" → 1 match → auto-advance
    expect(afterRe.acceptedTokens.length).toBe(1)
    expect(afterRe.acceptedTokens[0].token).toBe('Config reload')
    expect(afterRe.query).toBe('')
  })
})

describe('queryUndo', () => {
  it('removes last character', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    // Type characters that don't trigger auto-advance
    resolver.queryPush('C')
    resolver.queryPush('o')
    const res = resolver.queryUndo()
    expect(res.query).toBe('C')
  })

  it('un-accepts last token when query is empty', () => {
    const resolver = CommandResolver.create([configNs], proximities)
    // Force an accepted token via choiceTakeTop
    resolver.choiceTakeTop()
    expect(resolver.getResolution().acceptedTokens.length).toBe(1)
    // Now undo with empty query
    const res = resolver.queryUndo()
    expect(res.acceptedTokens.length).toBe(0)
    // preTakeQuery should be restored
    expect(res.query).toBe('')
  })

  it('restores preTakeQuery on undo', () => {
    const resolver = CommandResolver.create([configNs], proximities)
    // Type "re" which auto-advances to "Config reload" (only match for "re")
    resolver.queryPush('r')
    resolver.queryPush('e')
    // Should be auto-advanced at "re"
    expect(resolver.getResolution().acceptedTokens.length).toBe(1)
    expect(resolver.getResolution().acceptedTokens[0].preTakeQuery).toBe('re')
    // Undo should restore "re"
    const res = resolver.queryUndo()
    expect(res.query).toBe('re')
    expect(res.acceptedTokens.length).toBe(0)
  })
})

describe('choiceTakeTop', () => {
  it('accepts the top choice', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    const res = resolver.choiceTakeTop()
    expect(res.acceptedTokens.length).toBe(1)
    expect(res.query).toBe('')
  })

  it('does NOT auto-advance after take', () => {
    // Create a namespace with only 1 child
    const singleNs = Command.Namespace.make({
      name: 'Single',
      children: [Command.Leaf.make({ name: 'only', capability: reload })],
    })
    const resolver = CommandResolver.create([singleNs], new Map())
    const res = resolver.choiceTakeTop()
    // Should have taken "Single only" (the only flat path)
    // Even though there's only 1 item, choiceTakeTop should NOT further auto-advance
    expect(res.acceptedTokens.length).toBe(1)
  })
})

describe('choiceTake', () => {
  it('accepts a specific choice', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    const res0 = resolver.getResolution()
    const bufferChoice = res0.choices.find((c) => c.token === 'Buffer close')!
    const res = resolver.choiceTake(bufferChoice)
    expect(res.acceptedTokens.length).toBe(1)
    expect(res.acceptedTokens[0].token).toBe('Buffer close')
  })
})

describe('choiceUndo', () => {
  it('removes last accepted token', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.choiceTakeTop()
    expect(resolver.getResolution().acceptedTokens.length).toBe(1)
    const res = resolver.choiceUndo()
    expect(res.acceptedTokens.length).toBe(0)
  })

  it('clears query', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.queryPush('C')
    resolver.queryPush('o')
    const res = resolver.choiceUndo()
    expect(res.query).toBe('')
  })
})

describe('toggleMode', () => {
  it('switches from flat to tree', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    expect(resolver.getResolution().mode).toBe('flat')
    const res = resolver.toggleMode()
    expect(res.mode).toBe('tree')
  })

  it('tree mode shows top-level commands (namespaces)', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.toggleMode()
    const res = resolver.getResolution()
    const tokens = res.choices.map((c) => c.token)
    expect(tokens).toContain('Config')
    expect(tokens).toContain('Buffer')
  })

  it('toggles back to flat', () => {
    const resolver = CommandResolver.create([configNs], proximities)
    resolver.toggleMode() // flat → tree
    const res = resolver.toggleMode() // tree → flat
    expect(res.mode).toBe('flat')
  })
})

describe('tree mode navigation', () => {
  it('choiceTakeTop in tree mode descends into namespace', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.toggleMode() // switch to tree
    const res = resolver.choiceTakeTop() // take "Config" namespace
    expect(res.acceptedTokens.length).toBe(1)
    // Should now show Config's children
    const tokens = res.choices.map((c) => c.token)
    expect(tokens).toContain('reload')
    expect(tokens).toContain('export')
  })

  it('choiceTake in tree mode descends into namespace', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.toggleMode()
    const treeRes = resolver.getResolution()
    const configChoice = treeRes.choices.find((c) => c.token === 'Config')!
    const res = resolver.choiceTake(configChoice)
    expect(res.choices.map((c) => c.token)).toContain('reload')
  })

  it('choiceUndo in tree mode ascends to parent', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.toggleMode()
    resolver.choiceTakeTop() // enter Config
    const res = resolver.choiceUndo()
    // Should be back at root namespace level
    const tokens = res.choices.map((c) => c.token)
    expect(tokens).toContain('Config')
    expect(tokens).toContain('Buffer')
  })

  it('queryPush in tree mode filters tree choices', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.toggleMode()
    resolver.choiceTakeTop() // enter Config (shows reload, export)
    const res = resolver.queryPush('r')
    // Should filter to just reload
    expect(res.choices.length).toBeGreaterThan(0)
  })

  it('space with empty query at namespace level is no-op', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    const res1 = resolver.getResolution()
    const res2 = resolver.queryPush(' ')
    // Should be no change — empty query + space = no-op
    expect(res2.acceptedTokens.length).toBe(res1.acceptedTokens.length)
  })
})

describe('reset', () => {
  it('clears all state', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.queryPush('r')
    resolver.queryPush('e')
    resolver.queryPush('l')
    const res = resolver.reset()
    expect(res.mode).toBe('flat')
    expect(res.acceptedTokens).toEqual([])
    expect(res.query).toBe('')
    expect(res.choices.length).toBeGreaterThan(0)
  })
})

describe('space handling', () => {
  it('space auto-advances top choice when query is non-empty', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], proximities)
    resolver.queryPush('C')
    resolver.queryPush('o')
    // Query is "Co", space should advance top match
    const res = resolver.queryPush(' ')
    expect(res.acceptedTokens.length).toBe(1)
    expect(res.query).toBe('')
  })
})
