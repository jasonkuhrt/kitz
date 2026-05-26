import { describe, expect, it, test } from 'bun:test'
import { Effect } from 'effect'
import { Bench } from 'tinybench'
import { Pat } from '@kitz/core'
import { AppMap } from './app-map.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { reloadCmd, replyCmd, closeCmd, threadNs, bufferNs } from './test-fixtures.js'

const nav = Capability.make({ name: 'nav', execute: Effect.void })
const navCmd = Command.Leaf.make({ name: 'nav', capability: nav })
const navNs = Command.Namespace.make({ name: 'Nav', children: [navCmd] })
const configNs = Command.Namespace.make({ name: 'Config', children: [reloadCmd] })

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
          children: [
            AppMap.Node.make({ name: 'thread', shortcuts: [{ key: 'r', command: replyCmd }] }),
          ],
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

// ─────────────────────────────────────────────────────────────────
// Conditional shortcuts via `if` (Pat.isMatch on consumer state)
// ─────────────────────────────────────────────────────────────────

describe('AppMap.resolveShortcut conditional (if)', () => {
  const condMap = AppMap.make({
    shortcuts: [{ key: 't', command: navCmd, if: { mode: 'tree' } satisfies Pat.Pattern }],
    children: [
      AppMap.Node.make({
        name: 'workspace',
        shortcuts: [{ key: 'n', command: reloadCmd }],
      }),
    ],
  })

  it('fires when state matches the if pattern', () => {
    const kb = AppMap.resolveShortcut(condMap, [], 't', { state: { mode: 'tree' } })
    expect(kb?.command).toBe(navCmd)
  })

  it('does NOT fire when state does not match', () => {
    const kb = AppMap.resolveShortcut(condMap, [], 't', { state: { mode: 'node' } })
    expect(kb).toBeNull()
  })

  it('shortcut without if fires regardless of state', () => {
    const kb = AppMap.resolveShortcut(condMap, ['workspace'], 'n', { state: { mode: 'node' } })
    expect(kb?.command).toBe(reloadCmd)
  })

  it('if and local are orthogonal — both must pass', () => {
    const bothMap = AppMap.make({
      shortcuts: [
        { key: 'x', command: navCmd, local: true, if: { mode: 'tree' } satisfies Pat.Pattern },
      ],
      children: [AppMap.Node.make({ name: 'workspace', shortcuts: [] })],
    })
    // local passes (root is deepest), if passes (state matches)
    expect(AppMap.resolveShortcut(bothMap, [], 'x', { state: { mode: 'tree' } })?.command).toBe(
      navCmd,
    )
    // local passes (root is deepest), if fails (state doesn't match)
    expect(AppMap.resolveShortcut(bothMap, [], 'x', { state: { mode: 'node' } })).toBeNull()
    // local fails (root is not deepest), if passes
    expect(
      AppMap.resolveShortcut(bothMap, ['workspace'], 'x', { state: { mode: 'tree' } }),
    ).toBeNull()
  })

  it('missing state defaults to {} — shortcuts with if do not match', () => {
    const kb = AppMap.resolveShortcut(condMap, [], 't')
    expect(kb).toBeNull()
  })
})

describe('AppMap.computeScope conditional (if)', () => {
  const condMap = AppMap.make({
    shortcuts: [
      { key: 't', command: navCmd, if: { mode: 'tree' } satisfies Pat.Pattern },
      { key: '?', command: closeCmd },
    ],
  })

  it('includes shortcut when state matches', () => {
    const scope = AppMap.computeScope(condMap, [], { state: { mode: 'tree' } })
    expect(scope.shortcuts.map((s) => s.key)).toContain('t')
  })

  it('excludes shortcut when state does not match', () => {
    const scope = AppMap.computeScope(condMap, [], { state: { mode: 'node' } })
    expect(scope.shortcuts.map((s) => s.key)).not.toContain('t')
    expect(scope.shortcuts.map((s) => s.key)).toContain('?')
  })
})

describe('AppMap.getActiveShortcuts conditional (if)', () => {
  const condMap = AppMap.make({
    shortcuts: [
      { key: 't', command: navCmd, if: { mode: 'tree' } satisfies Pat.Pattern },
      { key: '?', command: closeCmd },
    ],
  })

  it('filters shortcuts by state pattern', () => {
    const groups = AppMap.getActiveShortcuts(condMap, [], { state: { mode: 'tree' } })
    const rootGroup = groups.find((g) => g.nodeName === '(root)')
    expect(rootGroup?.shortcuts.map((s) => s.key)).toContain('t')
    expect(rootGroup?.shortcuts.map((s) => s.key)).toContain('?')
  })

  it('excludes non-matching shortcuts', () => {
    const groups = AppMap.getActiveShortcuts(condMap, [], { state: { mode: 'node' } })
    const rootGroup = groups.find((g) => g.nodeName === '(root)')
    expect(rootGroup?.shortcuts.map((s) => s.key)).not.toContain('t')
    expect(rootGroup?.shortcuts.map((s) => s.key)).toContain('?')
  })
})

// ─────────────────────────────────────────────────────────────────
// Performance gate — shortcut filtering with Pat.isMatch on hot path
//
// Uses tinybench Bench directly for statistically rigorous measurement
// (proper warmup, iteration control, percentile reporting).
//
// Scenario: 50 shortcuts in scope (25 unconditional, 25 conditional),
// 3-level deep AppMap. All 3 filter sites called per keypress.
//
// Local gates use MEAN (robust to OS scheduling jitter, GC pauses).
// CI gates use P99 (controlled VM, reliable tail latency enforcement).
// Rationale: at 120Hz the frame budget is ~8.3ms. Shortcut filtering
// is one of several hot-path steps (fuzzy matching, ranking, rendering).
// See docs/rationales/0001-effect-on-hot-path.md.
//
// For detailed profiling tables: bun run --cwd packages/cmx bench
// ─────────────────────────────────────────────────────────────────

describe('AppMap performance gate', () => {
  const perfCap = Capability.make({ name: 'action', execute: Effect.void })
  const perfCmd = Command.Leaf.make({ name: 'action', capability: perfCap })

  // 50 shortcuts: 25 unconditional, 25 conditional with Pat.isMatch patterns
  const perfShortcuts = Array.from({ length: 50 }, (_, i) => {
    const base = { key: `k${i}`, command: perfCmd } as const
    if (i % 2 === 0) return base
    return { ...base, if: { mode: `mode${i % 5}` } satisfies Pat.Pattern }
  })

  // 3-level deep AppMap: root (17 shortcuts) → workspace (17) → thread (16)
  const perfMap = AppMap.make({
    shortcuts: perfShortcuts.slice(0, 17),
    children: [
      AppMap.Node.make({
        name: 'workspace',
        shortcuts: perfShortcuts.slice(17, 34),
        children: [
          AppMap.Node.make({
            name: 'thread',
            shortcuts: perfShortcuts.slice(34),
          }),
        ],
      }),
    ],
  })

  const deepPath = ['workspace', 'thread'] as const
  const state = { mode: 'mode1' }

  // Budget: combined cost of all 3 filter sites per keypress.
  // CI observed baseline: ~36ms combined p99. Threshold at ~3x for variance.
  // Local: gate on mean (robust to jitter). CI: gate on p99 (strict).
  const IS_CI = !!process.env['CI']
  const COMBINED_BUDGET = { localMean: 4, ciP99: 100 }

  test('combined keypress path (resolveShortcut + computeScope + getActiveShortcuts) stays within budget', async () => {
    const b = new Bench({
      time: 500, // 500ms measurement window — enough for stable statistics
      warmupTime: 200, // 200ms warmup — let V8 JIT settle
      warmupIterations: 100,
    })

    b.add('resolveShortcut', () => {
      AppMap.resolveShortcut(perfMap, deepPath, 'k1', { state })
    })

    b.add('computeScope', () => {
      AppMap.computeScope(perfMap, deepPath, { state })
    })

    b.add('getActiveShortcuts', () => {
      AppMap.getActiveShortcuts(perfMap, deepPath, { state })
    })

    await b.run()

    const resolve = b.getTask('resolveShortcut')!.result!
    const scope = b.getTask('computeScope')!.result!
    const active = b.getTask('getActiveShortcuts')!.result!

    if (
      resolve.state !== 'completed' ||
      scope.state !== 'completed' ||
      active.state !== 'completed'
    ) {
      throw new Error('Expected all benchmark tasks to complete')
    }

    const combinedP99 = resolve.latency.p99 + scope.latency.p99 + active.latency.p99
    const combinedMean = resolve.latency.mean + scope.latency.mean + active.latency.mean

    // Diagnostic output — visible in vitest verbose mode and CI logs
    console.log(
      [
        `\n  Shortcut filter performance (50 shortcuts, 3-level path):`,
        `    resolveShortcut : mean=${resolve.latency.mean.toFixed(4)}ms  p99=${resolve.latency.p99.toFixed(4)}ms  hz=${resolve.throughput.mean.toFixed(0)}`,
        `    computeScope    : mean=${scope.latency.mean.toFixed(4)}ms  p99=${scope.latency.p99.toFixed(4)}ms  hz=${scope.throughput.mean.toFixed(0)}`,
        `    getActiveShrtcts: mean=${active.latency.mean.toFixed(4)}ms  p99=${active.latency.p99.toFixed(4)}ms  hz=${active.throughput.mean.toFixed(0)}`,
        `    ──────────────────────────────────────────────────`,
        `    combined        : mean=${combinedMean.toFixed(4)}ms  p99=${combinedP99.toFixed(4)}ms`,
        `    budget: ${IS_CI ? `p99 < ${COMBINED_BUDGET.ciP99}ms` : `mean < ${COMBINED_BUDGET.localMean}ms`}`,
      ].join('\n'),
    )

    // Gate: local checks mean (stable), CI checks p99 (strict tail latency)
    if (IS_CI) {
      expect(
        combinedP99,
        `combined p99 ${combinedP99.toFixed(3)}ms exceeds CI budget ${COMBINED_BUDGET.ciP99}ms`,
      ).toBeLessThan(COMBINED_BUDGET.ciP99)
    } else {
      expect(
        combinedMean,
        `combined mean ${combinedMean.toFixed(3)}ms exceeds local budget ${COMBINED_BUDGET.localMean}ms`,
      ).toBeLessThan(COMBINED_BUDGET.localMean)
    }

    // Sanity: each individual site should contribute meaningfully (not degenerate)
    // CI observed: ~982 hz. Threshold at ~3x below for variance.
    const MIN_HZ = IS_CI ? 300 : 1000
    expect(resolve.throughput.mean, 'resolveShortcut hz too low').toBeGreaterThan(MIN_HZ)
    expect(scope.throughput.mean, 'computeScope hz too low').toBeGreaterThan(MIN_HZ)
    expect(active.throughput.mean, 'getActiveShortcuts hz too low').toBeGreaterThan(MIN_HZ)
  })
})
