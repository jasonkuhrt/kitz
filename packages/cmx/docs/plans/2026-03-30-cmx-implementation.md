# @kitz/cmx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the @kitz/cmx semantic command system — AppMap-driven visibility, character-level resolution with handleKey two-tier dispatch, slot resolution, and pluggable matching/ranking.

**Architecture:** The Cmx singleton Effect service owns handleKey, which routes through a two-tier dispatch (Tier 1: keybindings + Controls, Tier 2: internal Resolver). The Resolver coordinates a Command Resolver (flat/tree mode navigation) and a Slot Resolver (enum/fuzzy/search/text). All state is internal — consumers see only handleKey results and Resolution snapshots.

**Tech Stack:** Effect v4, @kitz/core (errors), @kitz/fuzzy (matching), @tanstack/hotkeys (key types), vitest (testing)

---

## File Structure

```
packages/cmx/src/
├── _.ts                          # Public namespace: export * as Cmx from './__.js'
├── __.ts                         # Barrel: re-exports all public API
├── errors.ts                     # CmxDuplicateNamespace, CmxDuplicateSlot, CmxInvalidAppMap, etc.
├── slot.ts                       # Slot.Enum, Slot.Fuzzy, Slot.Search, Slot.Text (discriminated types)
├── capability.ts                 # Capability.make, Capability.Composite.make
├── command.ts                    # Command.Leaf, Command.Namespace, Command.Hybrid
├── choice.ts                     # Choice type, AcceptedToken type
├── resolution.ts                 # Resolution type
├── app-map.ts                    # AppMap.make, AppMap.Node.make, scope computation, keybinding resolution
├── controls.ts                   # Controls Effect service + defaults
├── matcher.ts                    # Matcher Effect service (wraps @kitz/fuzzy)
├── ranker.ts                     # Ranker Effect service
├── handle-key-result.ts          # Nil, BeginPalette, BeginShortcut, Resolution, Execute, Close
├── command-resolver.ts           # Internal: command tree navigation, auto-advance, dead-end prevention
├── slot-resolver.ts              # Internal: slot value resolution, multi-slot lifecycle
├── session.ts                    # Internal: session state machine
├── handle-key.ts                 # Internal: two-tier dispatch
├── cmx.ts                        # Cmx Effect service (top-level singleton)
└── slot-values.ts                # Cmx.SlotValues Effect service (capability-scoped)
```

Test files co-located:
```
packages/cmx/src/
├── slot.test.ts
├── capability.test.ts
├── command.test.ts
├── app-map.test.ts
├── controls.test.ts
├── command-resolver.test.ts
├── slot-resolver.test.ts
├── session.test.ts
├── handle-key.test.ts
└── cmx.test.ts
```

---

### Task 1: Errors

**Files:**
- Create: `packages/cmx/src/errors.ts`
- Create: `packages/cmx/src/errors.test.ts`

- [ ] **Step 1: Write failing test for error construction**

```typescript
import { describe, expect, it } from 'vitest'
import { CmxDuplicateNamespace, CmxDuplicateSlot, CmxInvalidAppMap, CmxInvalidPath, CmxMissingLayer, CmxSlotValidationFailure, CmxCapabilityExecutionFailure } from './errors.js'

describe('CmxDuplicateNamespace', () => {
  it('constructs with context', () => {
    const err = new CmxDuplicateNamespace({
      context: { namespace: 'Config', nodeA: 'app', nodeB: 'workspace' },
    })
    expect(err.message).toContain('Config')
    expect(err.message).toContain('app')
    expect(err.message).toContain('workspace')
    expect(err._tag).toBe('CmxDuplicateNamespace')
  })
})

describe('CmxDuplicateSlot', () => {
  it('constructs with context', () => {
    const err = new CmxDuplicateSlot({
      context: { slot: 'format', capabilityA: 'export', capabilityB: 'convert' },
    })
    expect(err.message).toContain('format')
    expect(err._tag).toBe('CmxDuplicateSlot')
  })
})

describe('CmxInvalidAppMap', () => {
  it('constructs with context', () => {
    const err = new CmxInvalidAppMap({ context: { detail: 'cycle detected' } })
    expect(err.message).toContain('cycle detected')
    expect(err._tag).toBe('CmxInvalidAppMap')
  })
})

describe('CmxInvalidPath', () => {
  it('constructs with context', () => {
    const err = new CmxInvalidPath({ context: { path: ['workspace', 'nonexistent'] } })
    expect(err._tag).toBe('CmxInvalidPath')
  })
})

describe('CmxMissingLayer', () => {
  it('constructs with context', () => {
    const err = new CmxMissingLayer({ context: { nodeId: 'thread', service: 'ThreadContext' } })
    expect(err._tag).toBe('CmxMissingLayer')
  })
})

describe('CmxSlotValidationFailure', () => {
  it('constructs with context', () => {
    const err = new CmxSlotValidationFailure({ context: { slot: 'name', command: 'create', value: '' } })
    expect(err._tag).toBe('CmxSlotValidationFailure')
  })
})

describe('CmxCapabilityExecutionFailure', () => {
  it('constructs with context', () => {
    const err = new CmxCapabilityExecutionFailure({ context: { capability: 'reload', cause: new Error('fail') } })
    expect(err._tag).toBe('CmxCapabilityExecutionFailure')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/cmx vitest run src/errors.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement errors**

```typescript
// packages/cmx/src/errors.ts
import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'cmx'] as const

export const CmxDuplicateNamespace = Err.TaggedContextualError(
  'CmxDuplicateNamespace', baseTags, {
    context: S.Struct({
      namespace: S.String,
      nodeA: S.String,
      nodeB: S.String,
    }),
    message: (ctx) => `Namespace "${ctx.namespace}" is visible from both "${ctx.nodeA}" and "${ctx.nodeB}"`,
  },
)
export type CmxDuplicateNamespace = InstanceType<typeof CmxDuplicateNamespace>

export const CmxDuplicateSlot = Err.TaggedContextualError(
  'CmxDuplicateSlot', baseTags, {
    context: S.Struct({
      slot: S.String,
      capabilityA: S.String,
      capabilityB: S.String,
    }),
    message: (ctx) => `Slot "${ctx.slot}" declared by both "${ctx.capabilityA}" and "${ctx.capabilityB}" in the same composite`,
  },
)
export type CmxDuplicateSlot = InstanceType<typeof CmxDuplicateSlot>

export const CmxInvalidAppMap = Err.TaggedContextualError(
  'CmxInvalidAppMap', baseTags, {
    context: S.Struct({ detail: S.String }),
    message: (ctx) => `Invalid AppMap: ${ctx.detail}`,
  },
)
export type CmxInvalidAppMap = InstanceType<typeof CmxInvalidAppMap>

export const CmxInvalidPath = Err.TaggedContextualError(
  'CmxInvalidPath', baseTags, {
    context: S.Struct({ path: S.Array(S.String) }),
    message: (ctx) => `Invalid path: ${ctx.path.join('/')}`,
  },
)
export type CmxInvalidPath = InstanceType<typeof CmxInvalidPath>

export const CmxMissingLayer = Err.TaggedContextualError(
  'CmxMissingLayer', baseTags, {
    context: S.Struct({ nodeId: S.String, service: S.String }),
    message: (ctx) => `Node "${ctx.nodeId}" requires service "${ctx.service}" but no layer provides it`,
  },
)
export type CmxMissingLayer = InstanceType<typeof CmxMissingLayer>

export const CmxSlotValidationFailure = Err.TaggedContextualError(
  'CmxSlotValidationFailure', baseTags, {
    context: S.Struct({
      slot: S.String,
      command: S.String,
      value: S.Unknown,
    }),
    message: (ctx) => `Slot "${ctx.slot}" on command "${ctx.command}" failed validation`,
  },
)
export type CmxSlotValidationFailure = InstanceType<typeof CmxSlotValidationFailure>

export const CmxCapabilityExecutionFailure = Err.TaggedContextualError(
  'CmxCapabilityExecutionFailure', baseTags, {
    context: S.Struct({
      capability: S.String,
      cause: S.Unknown,
    }),
    message: (ctx) => `Capability "${ctx.capability}" failed during execution`,
  },
)
export type CmxCapabilityExecutionFailure = InstanceType<typeof CmxCapabilityExecutionFailure>

export type All =
  | CmxDuplicateNamespace
  | CmxDuplicateSlot
  | CmxInvalidAppMap
  | CmxInvalidPath
  | CmxMissingLayer
  | CmxSlotValidationFailure
  | CmxCapabilityExecutionFailure
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/cmx vitest run src/errors.test.ts`
Expected: PASS — all 7 error types construct correctly

- [ ] **Step 5: Commit**

```bash
git add packages/cmx/src/errors.ts packages/cmx/src/errors.test.ts
git commit -m "feat(cmx): add error definitions"
```

---

### Task 2: Slot Types

**Files:**
- Create: `packages/cmx/src/slot.ts`
- Create: `packages/cmx/src/slot.test.ts`

- [ ] **Step 1: Write failing tests for all four slot kinds**

```typescript
import { describe, expect, it } from 'vitest'
import { Schema as S } from 'effect'
import { Slot } from './slot.js'

describe('Slot.Enum', () => {
  it('creates with schema', () => {
    const slot = Slot.Enum.make({
      name: 'format',
      schema: S.Literal('json', 'yaml'),
    })
    expect(slot._tag).toBe('Enum')
    expect(slot.name).toBe('format')
  })

  it('accepts optional documentation fields', () => {
    const slot = Slot.Enum.make({
      name: 'format',
      schema: S.Literal('json', 'yaml'),
      description: 'Output format',
      detail: 'The serialization format',
      placeholder: 'Choose format',
      required: false,
    })
    expect(slot.description).toBe('Output format')
    expect(slot.required).toBe(false)
  })
})

describe('Slot.Fuzzy', () => {
  it('creates with source', () => {
    const slot = Slot.Fuzzy.make({
      name: 'email',
      schema: S.String,
      source: Effect.succeed([{ value: 'test', label: 'Test' }]),
    })
    expect(slot._tag).toBe('Fuzzy')
    expect(slot.name).toBe('email')
  })
})

describe('Slot.Search', () => {
  it('creates with query-based source', () => {
    const slot = Slot.Search.make({
      name: 'file',
      schema: S.String,
      source: (_query: string) => Effect.succeed([{ value: '/tmp', label: '/tmp' }]),
    })
    expect(slot._tag).toBe('Search')
  })
})

describe('Slot.Text', () => {
  it('creates with schema for validation', () => {
    const slot = Slot.Text.make({
      name: 'name',
      schema: S.String.pipe(S.minLength(1)),
    })
    expect(slot._tag).toBe('Text')
    expect(slot.name).toBe('name')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/cmx vitest run src/slot.test.ts`
Expected: FAIL — Slot module not found

- [ ] **Step 3: Implement Slot types**

```typescript
// packages/cmx/src/slot.ts
import { Schema as S } from 'effect'
import type { Effect } from 'effect'

interface SlotBase {
  readonly name: string
  readonly description?: string
  readonly detail?: string
  readonly placeholder?: string
  readonly required?: boolean
}

export interface SlotCandidate<V> {
  readonly value: V
  readonly label: string
  readonly description?: string
}

export interface SlotEnum<A = unknown> extends SlotBase {
  readonly _tag: 'Enum'
  readonly schema: S.Schema<A>
}

export interface SlotFuzzy<A = unknown> extends SlotBase {
  readonly _tag: 'Fuzzy'
  readonly schema: S.Schema<A>
  readonly source: Effect.Effect<ReadonlyArray<SlotCandidate<A>>>
}

export interface SlotSearch<A = unknown> extends SlotBase {
  readonly _tag: 'Search'
  readonly schema: S.Schema<A>
  readonly source: (query: string) => Effect.Effect<ReadonlyArray<SlotCandidate<A>>>
}

export interface SlotText<A = unknown> extends SlotBase {
  readonly _tag: 'Text'
  readonly schema: S.Schema<A>
}

export type Slot<A = unknown> = SlotEnum<A> | SlotFuzzy<A> | SlotSearch<A> | SlotText<A>

export const Slot = {
  Enum: {
    make: <A>(config: Omit<SlotEnum<A>, '_tag'>): SlotEnum<A> => ({
      _tag: 'Enum',
      ...config,
    }),
  },
  Fuzzy: {
    make: <A>(config: Omit<SlotFuzzy<A>, '_tag'>): SlotFuzzy<A> => ({
      _tag: 'Fuzzy',
      ...config,
    }),
  },
  Search: {
    make: <A>(config: Omit<SlotSearch<A>, '_tag'>): SlotSearch<A> => ({
      _tag: 'Search',
      ...config,
    }),
  },
  Text: {
    make: <A>(config: Omit<SlotText<A>, '_tag'>): SlotText<A> => ({
      _tag: 'Text',
      ...config,
    }),
  },
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/cmx vitest run src/slot.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cmx/src/slot.ts packages/cmx/src/slot.test.ts
git commit -m "feat(cmx): add Slot types (Enum, Fuzzy, Search, Text)"
```

---

### Task 3: Capability Types

**Files:**
- Create: `packages/cmx/src/capability.ts`
- Create: `packages/cmx/src/capability.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { Capability } from './capability.js'

describe('Capability.make', () => {
  it('creates a capability with name and execute', () => {
    const cap = Capability.make({
      name: 'reload',
      execute: Effect.void,
    })
    expect(cap._tag).toBe('Capability')
    expect(cap.name).toBe('reload')
    expect(cap.slots).toEqual([])
  })

  it('creates a capability with slots', () => {
    const cap = Capability.make({
      name: 'export',
      slots: [{ _tag: 'Enum', name: 'format', schema: {} } as any],
      execute: Effect.void,
    })
    expect(cap.slots).toHaveLength(1)
  })
})

describe('Capability.Composite.make', () => {
  it('creates a composite with steps', () => {
    const step1 = Capability.make({ name: 'write', execute: Effect.void })
    const step2 = Capability.make({ name: 'reload', execute: Effect.void })
    const composite = Capability.Composite.make({
      name: 'write-and-reload',
      steps: [{ capability: step1 }, { capability: step2 }],
    })
    expect(composite._tag).toBe('Composite')
    expect(composite.steps).toHaveLength(2)
    expect(composite.slots).toEqual([])
  })

  it('aggregates slots from steps', () => {
    const step1 = Capability.make({ name: 'write', execute: Effect.void })
    const step2 = Capability.make({
      name: 'export',
      slots: [{ _tag: 'Enum', name: 'format', schema: {} } as any],
      execute: Effect.void,
    })
    const composite = Capability.Composite.make({
      name: 'write-and-export',
      steps: [{ capability: step1 }, { capability: step2 }],
    })
    expect(composite.slots).toHaveLength(1)
    expect(composite.slots[0].name).toBe('format')
  })

  it('throws CmxDuplicateSlot on name collision', () => {
    const step1 = Capability.make({
      name: 'a',
      slots: [{ _tag: 'Enum', name: 'format', schema: {} } as any],
      execute: Effect.void,
    })
    const step2 = Capability.make({
      name: 'b',
      slots: [{ _tag: 'Enum', name: 'format', schema: {} } as any],
      execute: Effect.void,
    })
    expect(() =>
      Capability.Composite.make({
        name: 'dup',
        steps: [{ capability: step1 }, { capability: step2 }],
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/cmx vitest run src/capability.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Capability types**

```typescript
// packages/cmx/src/capability.ts
import type { Effect } from 'effect'
import type { Slot } from './slot.js'
import { CmxDuplicateSlot } from './errors.js'

export interface CapabilityBase {
  readonly name: string
  readonly slots: ReadonlyArray<Slot>
  readonly execute: Effect.Effect<void, unknown, unknown>
}

export interface CapabilitySimple extends CapabilityBase {
  readonly _tag: 'Capability'
}

export interface CapabilityComposite extends CapabilityBase {
  readonly _tag: 'Composite'
  readonly steps: ReadonlyArray<{ readonly capability: CapabilityBase }>
}

export type AnyCapability = CapabilitySimple | CapabilityComposite

const aggregateSlots = (steps: ReadonlyArray<{ readonly capability: CapabilityBase }>): ReadonlyArray<Slot> => {
  const seen = new Map<string, string>()
  const result: Slot[] = []
  for (const step of steps) {
    for (const slot of step.capability.slots) {
      const existing = seen.get(slot.name)
      if (existing) {
        throw new CmxDuplicateSlot({
          context: {
            slot: slot.name,
            capabilityA: existing,
            capabilityB: step.capability.name,
          },
        })
      }
      seen.set(slot.name, step.capability.name)
      result.push(slot)
    }
  }
  return result
}

export const Capability = {
  make: (config: { name: string; slots?: ReadonlyArray<Slot>; execute: Effect.Effect<void, unknown, unknown> }): CapabilitySimple => ({
    _tag: 'Capability',
    name: config.name,
    slots: config.slots ?? [],
    execute: config.execute,
  }),
  Composite: {
    make: (config: { name: string; steps: ReadonlyArray<{ readonly capability: CapabilityBase }> }): CapabilityComposite => ({
      _tag: 'Composite',
      name: config.name,
      slots: aggregateSlots(config.steps),
      steps: config.steps,
      execute: Effect.void, // placeholder — actual sequential execution built at resolution time
    }),
  },
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/cmx vitest run src/capability.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cmx/src/capability.ts packages/cmx/src/capability.test.ts
git commit -m "feat(cmx): add Capability types with composite slot aggregation"
```

---

### Task 4: Command Types

**Files:**
- Create: `packages/cmx/src/command.ts`
- Create: `packages/cmx/src/command.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { Command } from './command.js'
import { Capability } from './capability.js'

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const exportCap = Capability.make({ name: 'export', execute: Effect.void })

describe('Command.Leaf', () => {
  it('creates with capability', () => {
    const cmd = Command.Leaf.make({ name: 'reload', capability: reload })
    expect(cmd._tag).toBe('Leaf')
    expect(cmd.name).toBe('reload')
    expect(cmd.capability).toBe(reload)
  })

  it('inherits slots from capability', () => {
    const slottedCap = Capability.make({
      name: 'export',
      slots: [{ _tag: 'Enum', name: 'format', schema: {} } as any],
      execute: Effect.void,
    })
    const cmd = Command.Leaf.make({ name: 'export', capability: slottedCap })
    expect(cmd.capability.slots).toHaveLength(1)
  })

  it('accepts inline documentation fields', () => {
    const cmd = Command.Leaf.make({
      name: 'reload',
      capability: reload,
      description: 'Reload config',
      aliases: ['refresh'],
      tags: ['config'],
      warning: 'Unsaved changes lost',
      confirmation: true,
    })
    expect(cmd.description).toBe('Reload config')
    expect(cmd.aliases).toEqual(['refresh'])
    expect(cmd.confirmation).toBe(true)
  })
})

describe('Command.Namespace', () => {
  it('creates with children', () => {
    const leaf = Command.Leaf.make({ name: 'reload', capability: reload })
    const ns = Command.Namespace.make({ name: 'Config', children: [leaf] })
    expect(ns._tag).toBe('Namespace')
    expect(ns.children).toHaveLength(1)
  })

  describe('fromCapabilities', () => {
    it('returns namespace and leaf handles', () => {
      const { namespace, commands } = Command.Namespace.fromCapabilities({
        name: 'Config',
        capabilities: { reload, export: exportCap },
      })
      expect(namespace._tag).toBe('Namespace')
      expect(namespace.children).toHaveLength(2)
      expect(commands.reload._tag).toBe('Leaf')
      expect(commands.reload.name).toBe('reload')
      expect(commands.export._tag).toBe('Leaf')
    })
  })
})

describe('Command.Hybrid', () => {
  it('creates with capability and children', () => {
    const child = Command.Leaf.make({ name: 'health', capability: reload })
    const hybrid = Command.Hybrid.make({
      name: 'Lazy',
      capability: reload,
      children: [child],
    })
    expect(hybrid._tag).toBe('Hybrid')
    expect(hybrid.children).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/cmx vitest run src/command.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Command types**

```typescript
// packages/cmx/src/command.ts
import type { CapabilityBase } from './capability.js'

interface CommandDocumentation {
  readonly description?: string
  readonly detail?: string
  readonly icon?: string
  readonly badge?: string
  readonly examples?: ReadonlyArray<string>
  readonly related?: ReadonlyArray<string>
  readonly warning?: string
  readonly confirmation?: boolean
  readonly aliases?: ReadonlyArray<string>
  readonly tags?: ReadonlyArray<string>
  readonly deprecated?: { readonly replacement: string }
  readonly group?: string
}

export interface CommandLeaf extends CommandDocumentation {
  readonly _tag: 'Leaf'
  readonly name: string
  readonly capability: CapabilityBase
}

export interface CommandNamespace extends CommandDocumentation {
  readonly _tag: 'Namespace'
  readonly name: string
  readonly children: ReadonlyArray<AnyCommand>
}

export interface CommandHybrid extends CommandDocumentation {
  readonly _tag: 'Hybrid'
  readonly name: string
  readonly capability: CapabilityBase
  readonly children: ReadonlyArray<AnyCommand>
}

export type AnyCommand = CommandLeaf | CommandNamespace | CommandHybrid

export const Command = {
  Leaf: {
    make: (config: Omit<CommandLeaf, '_tag'>): CommandLeaf => ({
      _tag: 'Leaf',
      ...config,
    }),
  },
  Namespace: {
    make: (config: Omit<CommandNamespace, '_tag'>): CommandNamespace => ({
      _tag: 'Namespace',
      ...config,
    }),
    fromCapabilities: <K extends string>(config: {
      name: string
      description?: string
      capabilities: Record<K, CapabilityBase>
    }): { namespace: CommandNamespace; commands: Record<K, CommandLeaf> } => {
      const commands = {} as Record<K, CommandLeaf>
      const children: CommandLeaf[] = []
      for (const [key, cap] of Object.entries<CapabilityBase>(config.capabilities)) {
        const leaf: CommandLeaf = { _tag: 'Leaf', name: cap.name, capability: cap }
        commands[key as K] = leaf
        children.push(leaf)
      }
      return {
        namespace: { _tag: 'Namespace', name: config.name, description: config.description, children },
        commands,
      }
    },
  },
  Hybrid: {
    make: (config: Omit<CommandHybrid, '_tag'>): CommandHybrid => ({
      _tag: 'Hybrid',
      ...config,
    }),
  },
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/cmx vitest run src/command.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cmx/src/command.ts packages/cmx/src/command.test.ts
git commit -m "feat(cmx): add Command types (Leaf, Namespace, Hybrid) with fromCapabilities"
```

---

### Task 5: Choice, AcceptedToken, and Resolution Types

**Files:**
- Create: `packages/cmx/src/choice.ts`
- Create: `packages/cmx/src/resolution.ts`
- Create: `packages/cmx/src/handle-key-result.ts`
- Create: `packages/cmx/src/resolution.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import type { Choice, AcceptedToken } from './choice.js'
import type { Resolution } from './resolution.js'
import { HandleKeyResult } from './handle-key-result.js'

describe('Choice', () => {
  it('carries command metadata', () => {
    const choice: Choice = {
      token: 'reload',
      kind: 'leaf',
      executable: true,
      description: 'Reload config',
    }
    expect(choice.token).toBe('reload')
    expect(choice.kind).toBe('leaf')
  })
})

describe('AcceptedToken', () => {
  it('carries token and preTakeQuery', () => {
    const token: AcceptedToken = {
      token: 'Config',
      preTakeQuery: 'C',
    }
    expect(token.token).toBe('Config')
    expect(token.preTakeQuery).toBe('C')
  })
})

describe('HandleKeyResult', () => {
  it('creates Nil', () => {
    const result = HandleKeyResult.Nil()
    expect(result._tag).toBe('Nil')
  })

  it('creates Close', () => {
    const result = HandleKeyResult.Close()
    expect(result._tag).toBe('Close')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/cmx vitest run src/resolution.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement types**

```typescript
// packages/cmx/src/choice.ts
export interface Choice {
  readonly token: string
  readonly kind: 'leaf' | 'namespace' | 'hybrid' | 'value'
  readonly executable: boolean
  readonly description?: string
  readonly detail?: string
  readonly icon?: string
  readonly badge?: string
  readonly keybinding?: string
  readonly warning?: string
  readonly deprecated?: { readonly replacement: string }
  readonly group?: string
}

export interface AcceptedToken {
  readonly token: string
  readonly preTakeQuery: string
}
```

```typescript
// packages/cmx/src/resolution.ts
import type { Effect } from 'effect'
import type { Choice, AcceptedToken } from './choice.js'

export interface SlotState {
  readonly name: string
  readonly kind: 'Enum' | 'Fuzzy' | 'Search' | 'Text'
  readonly value: unknown | null
  readonly required: boolean
}

export interface Resolution {
  readonly mode: 'flat' | 'tree'
  readonly acceptedTokens: ReadonlyArray<AcceptedToken>
  readonly query: string
  readonly _tag: 'Leaf' | 'Namespace' | 'Hybrid' | 'None'
  readonly executable: boolean
  readonly effect: Effect.Effect<void, unknown, unknown> | null
  readonly complete: boolean
  readonly topChoice: Choice | null
  readonly choices: ReadonlyArray<Choice>
  readonly choicesLoading: boolean
  readonly slots: ReadonlyArray<SlotState>
  readonly focusedSlot: string | null
}
```

```typescript
// packages/cmx/src/handle-key-result.ts
import type { Resolution } from './resolution.js'

interface Nil { readonly _tag: 'Nil' }
interface BeginPalette { readonly _tag: 'BeginPalette'; readonly resolution: Resolution }
interface BeginShortcut { readonly _tag: 'BeginShortcut'; readonly resolution: Resolution; readonly executable: boolean }
interface ResolutionResult { readonly _tag: 'Resolution'; readonly resolution: Resolution }
interface Execute { readonly _tag: 'Execute'; readonly resolution: Resolution }
interface Close { readonly _tag: 'Close' }

export type HandleKeyResult = Nil | BeginPalette | BeginShortcut | ResolutionResult | Execute | Close

export const HandleKeyResult = {
  Nil: (): Nil => ({ _tag: 'Nil' }),
  BeginPalette: (resolution: Resolution): BeginPalette => ({ _tag: 'BeginPalette', resolution }),
  BeginShortcut: (resolution: Resolution, executable: boolean): BeginShortcut => ({ _tag: 'BeginShortcut', resolution, executable }),
  Resolution: (resolution: Resolution): ResolutionResult => ({ _tag: 'Resolution', resolution }),
  Execute: (resolution: Resolution): Execute => ({ _tag: 'Execute', resolution }),
  Close: (): Close => ({ _tag: 'Close' }),
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/cmx vitest run src/resolution.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cmx/src/choice.ts packages/cmx/src/resolution.ts packages/cmx/src/handle-key-result.ts packages/cmx/src/resolution.test.ts
git commit -m "feat(cmx): add Choice, AcceptedToken, Resolution, HandleKeyResult types"
```

---

### Task 6: AppMap — Structure and Scope Computation

**Files:**
- Create: `packages/cmx/src/app-map.ts`
- Create: `packages/cmx/src/app-map.test.ts`

- [ ] **Step 1: Write failing tests for AppMap construction and scope**

```typescript
import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { AppMap } from './app-map.js'
import { Command } from './command.js'
import { Capability } from './capability.js'

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const reply = Capability.make({ name: 'reply', execute: Effect.void })
const nav = Capability.make({ name: 'nav', execute: Effect.void })

const configCmd = Command.Leaf.make({ name: 'reload', capability: reload })
const replyCmd = Command.Leaf.make({ name: 'reply', capability: reply })
const navCmd = Command.Leaf.make({ name: 'nav', capability: nav })

const configNs = Command.Namespace.make({ name: 'Config', children: [configCmd] })
const threadNs = Command.Namespace.make({ name: 'Thread', children: [replyCmd] })
const navNs = Command.Namespace.make({ name: 'Nav', children: [navCmd] })

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
          children: [
            AppMap.Node.make({ name: 'thread', commands: [threadNs] }),
          ],
        }),
      ],
    })
    expect(map.children).toHaveLength(1)
    expect(map.children[0].name).toBe('workspace')
  })
})

describe('AppMap.computeScope', () => {
  const map = AppMap.make({
    commands: [navNs],
    children: [
      AppMap.Node.make({
        name: 'workspace',
        commands: [configNs],
        children: [
          AppMap.Node.make({ name: 'thread', commands: [threadNs] }),
        ],
      }),
    ],
  })

  it('at root: only root commands visible', () => {
    const scope = AppMap.computeScope(map, [])
    expect(scope.commands.map(c => c.name)).toEqual(['Nav'])
  })

  it('at workspace: workspace + root visible', () => {
    const scope = AppMap.computeScope(map, ['workspace'])
    const names = scope.commands.map(c => c.name)
    expect(names).toContain('Config')
    expect(names).toContain('Nav')
  })

  it('at thread: thread + workspace + root visible, deepest first', () => {
    const scope = AppMap.computeScope(map, ['workspace', 'thread'])
    const names = scope.commands.map(c => c.name)
    expect(names).toEqual(['Thread', 'Config', 'Nav'])
  })

  it('invalid path throws', () => {
    expect(() => AppMap.computeScope(map, ['nonexistent'])).toThrow()
  })
})

describe('AppMap.computeScope proximity', () => {
  const map = AppMap.make({
    commands: [navNs],
    children: [
      AppMap.Node.make({
        name: 'workspace',
        commands: [configNs],
        children: [
          AppMap.Node.make({ name: 'thread', commands: [threadNs] }),
        ],
      }),
    ],
  })

  it('assigns proximity values (closer = higher)', () => {
    const scope = AppMap.computeScope(map, ['workspace', 'thread'])
    expect(scope.proximities.get('Thread')).toBeGreaterThan(scope.proximities.get('Config')!)
    expect(scope.proximities.get('Config')).toBeGreaterThan(scope.proximities.get('Nav')!)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/cmx vitest run src/app-map.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement AppMap**

```typescript
// packages/cmx/src/app-map.ts
import type { Layer } from 'effect'
import type { AnyCommand, CommandNamespace } from './command.js'
import { CmxInvalidPath, CmxDuplicateNamespace } from './errors.js'

interface Keybinding {
  readonly key: string
  readonly command: AnyCommand
}

export interface AppMapNode {
  readonly name: string
  readonly commands: ReadonlyArray<AnyCommand>
  readonly keybindings?: ReadonlyArray<Keybinding>
  readonly layer?: Layer.Layer<any>
  readonly children: ReadonlyArray<AppMapNode>
}

export interface AppMapRoot {
  readonly commands: ReadonlyArray<AnyCommand>
  readonly keybindings?: ReadonlyArray<Keybinding>
  readonly layer?: Layer.Layer<any>
  readonly children: ReadonlyArray<AppMapNode>
}

export interface Scope {
  readonly commands: ReadonlyArray<AnyCommand>
  readonly keybindings: ReadonlyArray<Keybinding>
  readonly proximities: Map<string, number>
}

const findNode = (root: AppMapRoot, path: ReadonlyArray<string>): ReadonlyArray<AppMapRoot | AppMapNode> => {
  const chain: (AppMapRoot | AppMapNode)[] = [root]
  let current: AppMapRoot | AppMapNode = root
  for (const segment of path) {
    const child = current.children.find(c => c.name === segment)
    if (!child) {
      throw new CmxInvalidPath({ context: { path: [...path] } })
    }
    chain.push(child)
    current = child
  }
  return chain
}

const computeScope = (root: AppMapRoot, path: ReadonlyArray<string>): Scope => {
  const chain = findNode(root, path)
  const commands: AnyCommand[] = []
  const keybindings: Keybinding[] = []
  const proximities = new Map<string, number>()
  const seenNamespaces = new Map<string, string>()

  // Walk deepest-first
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]
    const proximity = chain.length - i // deepest = highest
    for (const cmd of node.commands) {
      // Check namespace uniqueness
      const existing = seenNamespaces.get(cmd.name)
      const nodeName = i === 0 ? 'root' : (node as AppMapNode).name
      if (existing) {
        throw new CmxDuplicateNamespace({
          context: { namespace: cmd.name, nodeA: existing, nodeB: nodeName },
        })
      }
      seenNamespaces.set(cmd.name, nodeName)
      commands.push(cmd)
      proximities.set(cmd.name, proximity)
    }
    for (const kb of node.keybindings ?? []) {
      keybindings.push(kb)
    }
  }

  return { commands, keybindings, proximities }
}

export const AppMap = {
  make: (config: {
    commands?: ReadonlyArray<AnyCommand>
    keybindings?: ReadonlyArray<Keybinding>
    layer?: Layer.Layer<any>
    children?: ReadonlyArray<AppMapNode>
  }): AppMapRoot => ({
    commands: config.commands ?? [],
    keybindings: config.keybindings,
    layer: config.layer,
    children: config.children ?? [],
  }),
  Node: {
    make: (config: {
      name: string
      commands?: ReadonlyArray<AnyCommand>
      keybindings?: ReadonlyArray<Keybinding>
      layer?: Layer.Layer<any>
      children?: ReadonlyArray<AppMapNode>
    }): AppMapNode => ({
      name: config.name,
      commands: config.commands ?? [],
      keybindings: config.keybindings,
      layer: config.layer,
      children: config.children ?? [],
    }),
  },
  computeScope,
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/cmx vitest run src/app-map.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cmx/src/app-map.ts packages/cmx/src/app-map.test.ts
git commit -m "feat(cmx): add AppMap with scope computation and proximity"
```

---

### Task 7: Controls Service

**Files:**
- Create: `packages/cmx/src/controls.ts`
- Create: `packages/cmx/src/controls.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import { Controls } from './controls.js'

describe('Controls.defaults', () => {
  it('has openPalette', () => {
    expect(Controls.defaults.openPalette).toBe(';')
  })
  it('has confirm', () => {
    expect(Controls.defaults.confirm).toBe('Enter')
  })
  it('has complete', () => {
    expect(Controls.defaults.complete).toBe('Tab')
  })
  it('has cancel', () => {
    expect(Controls.defaults.cancel).toBe('Escape')
  })
  it('has backspace', () => {
    expect(Controls.defaults.backspace).toBe('Backspace')
  })
  it('has toggleMode', () => {
    expect(Controls.defaults.toggleMode).toBe('?')
  })
})

describe('Controls.classify', () => {
  it('classifies openPalette key', () => {
    expect(Controls.classify(Controls.defaults, ';')).toBe('openPalette')
  })
  it('classifies confirm key', () => {
    expect(Controls.classify(Controls.defaults, 'Enter')).toBe('confirm')
  })
  it('classifies printable character', () => {
    expect(Controls.classify(Controls.defaults, 'c')).toBe('printable')
  })
  it('classifies space', () => {
    expect(Controls.classify(Controls.defaults, ' ')).toBe('space')
  })
  it('returns null for unrecognized non-printable', () => {
    expect(Controls.classify(Controls.defaults, 'F12')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/cmx vitest run src/controls.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Controls**

```typescript
// packages/cmx/src/controls.ts
import { Context } from 'effect'

export interface ControlsConfig {
  readonly openPalette: string
  readonly confirm: string
  readonly complete: string
  readonly cancel: string
  readonly backspace: string
  readonly toggleMode: string
}

export type ControlAction =
  | 'openPalette'
  | 'confirm'
  | 'complete'
  | 'cancel'
  | 'backspace'
  | 'toggleMode'
  | 'space'
  | 'printable'

const defaults: ControlsConfig = {
  openPalette: ';',
  confirm: 'Enter',
  complete: 'Tab',
  cancel: 'Escape',
  backspace: 'Backspace',
  toggleMode: '?',
}

const isPrintable = (key: string): boolean => key.length === 1

const classify = (config: ControlsConfig, key: string): ControlAction | null => {
  if (key === config.openPalette) return 'openPalette'
  if (key === config.confirm) return 'confirm'
  if (key === config.complete) return 'complete'
  if (key === config.cancel) return 'cancel'
  if (key === config.backspace) return 'backspace'
  if (key === config.toggleMode) return 'toggleMode'
  if (key === ' ') return 'space'
  if (isPrintable(key)) return 'printable'
  return null
}

export class Controls extends Context.Tag('Cmx/Controls')<Controls, ControlsConfig>() {
  static readonly defaults = defaults
  static readonly classify = classify
  static readonly of = (config: ControlsConfig) => Controls.make(config)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/cmx vitest run src/controls.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cmx/src/controls.ts packages/cmx/src/controls.test.ts
git commit -m "feat(cmx): add Controls service with key classification"
```

---

### Task 8: Command Resolver — Core State Machine

**Files:**
- Create: `packages/cmx/src/command-resolver.ts`
- Create: `packages/cmx/src/command-resolver.test.ts`

This is the largest task — the core state machine for command tree navigation. Tests cover: query.push, query.undo, choice.takeTop, choice.take, choice.undo, auto-advance, dead-end prevention, space handling, flat/tree mode, preTakeQuery restoration.

- [ ] **Step 1: Write failing tests for basic query.push and choices**

```typescript
import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { CommandResolver } from './command-resolver.js'
import { Command } from './command.js'
import { Capability } from './capability.js'

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const exportCap = Capability.make({ name: 'export', execute: Effect.void })
const close = Capability.make({ name: 'close', execute: Effect.void })

const configNs = Command.Namespace.make({
  name: 'Config',
  children: [
    Command.Leaf.make({ name: 'reload', capability: reload }),
    Command.Leaf.make({ name: 'export', capability: exportCap }),
  ],
})
const bufferNs = Command.Namespace.make({
  name: 'Buffer',
  children: [
    Command.Leaf.make({ name: 'close', capability: close }),
  ],
})

describe('CommandResolver', () => {
  it('initial flat mode shows all executable paths', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], new Map())
    const resolution = resolver.getResolution()
    expect(resolution.mode).toBe('flat')
    expect(resolution.choices.map(c => c.token)).toContain('Config reload')
    expect(resolution.choices.map(c => c.token)).toContain('Config export')
    expect(resolution.choices.map(c => c.token)).toContain('Buffer close')
  })

  it('query.push filters choices', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], new Map())
    const resolution = resolver.queryPush('r')
    expect(resolution.query).toBe('r')
    // fuzzy match: 'r' matches 'Config reload', 'Config export', 'Buffer close' (all have 'r')
    // but 'Config reload' should rank highest
    expect(resolution.choices.length).toBeGreaterThan(0)
    expect(resolution.choices[0].token).toContain('reload')
  })

  it('query.undo removes last character', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], new Map())
    resolver.queryPush('r')
    resolver.queryPush('e')
    const resolution = resolver.queryUndo()
    expect(resolution.query).toBe('r')
  })

  it('query.undo on empty query does nothing at root', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], new Map())
    const resolution = resolver.queryUndo()
    expect(resolution.query).toBe('')
    expect(resolution.acceptedTokens).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/cmx vitest run src/command-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement CommandResolver core**

(Implementation will be the actual CommandResolver class with internal state, flat path computation, Matcher integration, auto-advance, dead-end prevention. This is ~200-300 lines — the core of cmx.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/cmx vitest run src/command-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Write tests for auto-advance and dead-end prevention**

(Additional tests for: auto-advance on frontier-of-1, dead-end prevention rejecting invalid chars, space handling, preTakeQuery restoration on undo, choice.takeTop, choice.take, choice.undo, tree mode toggle.)

- [ ] **Step 6: Implement remaining behaviors**

- [ ] **Step 7: Run full test suite**

Run: `bun run --cwd packages/cmx vitest run src/command-resolver.test.ts`
Expected: PASS — all command resolver tests

- [ ] **Step 8: Commit**

```bash
git add packages/cmx/src/command-resolver.ts packages/cmx/src/command-resolver.test.ts
git commit -m "feat(cmx): add Command Resolver with auto-advance, dead-end prevention, flat/tree mode"
```

---

### Task 9: Slot Resolver

**Files:**
- Create: `packages/cmx/src/slot-resolver.ts`
- Create: `packages/cmx/src/slot-resolver.test.ts`

Tests cover: Slot.Enum resolution, Slot.Fuzzy with source, Slot.Search with query-based source, Slot.Text validation, multi-slot lifecycle, undo across slot boundaries, optional slot skipping, preTakeQuery on slots.

- [ ] **Step 1-5: TDD for each slot kind and multi-slot lifecycle**

(Follows same TDD pattern — write failing tests, implement, verify, commit.)

- [ ] **Step 6: Commit**

```bash
git add packages/cmx/src/slot-resolver.ts packages/cmx/src/slot-resolver.test.ts
git commit -m "feat(cmx): add Slot Resolver with enum, fuzzy, search, text, multi-slot lifecycle"
```

---

### Task 10: Session State Machine

**Files:**
- Create: `packages/cmx/src/session.ts`
- Create: `packages/cmx/src/session.test.ts`

The Session wraps CommandResolver + SlotResolver and manages the lifecycle: command resolution → slot resolution → executable → effect building.

- [ ] **Step 1-5: TDD for session lifecycle**

- [ ] **Step 6: Commit**

```bash
git add packages/cmx/src/session.ts packages/cmx/src/session.test.ts
git commit -m "feat(cmx): add Session state machine (command → slot → executable)"
```

---

### Task 11: handleKey Two-Tier Dispatch

**Files:**
- Create: `packages/cmx/src/handle-key.ts`
- Create: `packages/cmx/src/handle-key.test.ts`

Tests cover: Tier 1 (Nil, BeginPalette on openPalette, BeginShortcut on keybinding), Tier 2 (Resolution, Execute, Close), session caching, Controls precedence.

- [ ] **Step 1-5: TDD for two-tier dispatch**

- [ ] **Step 6: Commit**

```bash
git add packages/cmx/src/handle-key.ts packages/cmx/src/handle-key.test.ts
git commit -m "feat(cmx): add handleKey two-tier dispatch with session management"
```

---

### Task 12: Cmx Effect Service + Barrel Exports

**Files:**
- Create: `packages/cmx/src/cmx.ts`
- Modify: `packages/cmx/src/__.ts`
- Modify: `packages/cmx/src/_.ts`
- Create: `packages/cmx/src/cmx.test.ts`

The top-level service that pulls Controls, Matcher, Ranker, AppMap from the Effect context and exposes handleKey.

- [ ] **Step 1-5: TDD for Cmx service**

- [ ] **Step 6: Wire barrel exports**

```typescript
// packages/cmx/src/__.ts
export { Cmx } from './cmx.js'
export { Capability } from './capability.js'
export { Command } from './command.js'
export { Slot } from './slot.js'
export { AppMap } from './app-map.js'
export { Controls } from './controls.js'
export type { Resolution } from './resolution.js'
export type { Choice, AcceptedToken } from './choice.js'
export type { HandleKeyResult } from './handle-key-result.js'
export * as Errors from './errors.js'
```

- [ ] **Step 7: Run full test suite**

Run: `bun run --cwd packages/cmx vitest run`
Expected: ALL PASS

- [ ] **Step 8: Run type check**

Run: `bun run --cwd packages/cmx check:types`
Expected: No errors

- [ ] **Step 9: Run coverage**

Run: `bun run --cwd packages/cmx vitest run --coverage`
Expected: 100% coverage

- [ ] **Step 10: Commit**

```bash
git add packages/cmx/src/
git commit -m "feat(cmx): add Cmx Effect service and barrel exports — full implementation"
```

---

### Task 13: CI Validation

- [ ] **Step 1: Run workspace checks**

Run: `bun run check:types`
Expected: No errors across workspace

- [ ] **Step 2: Run workspace tests**

Run: `bun run test:packages`
Expected: All pass

- [ ] **Step 3: Run workspace lint**

Run: `bun run check:lint`
Expected: No warnings

- [ ] **Step 4: Run pre-commit hook**

Run: `bun run pre-commit`
Expected: Pass

- [ ] **Step 5: Final commit if needed**

```bash
git commit -m "chore(cmx): CI green, 100% coverage"
```
