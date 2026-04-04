# Release UI OpenTUI Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled ANSI release dashboard with an OpenTUI + React + effect-atom powered TUI that boots in under 5 seconds and renders a lazygit-quality panel layout.

**Architecture:** New `@kitz/tui` package owns the OpenTUI/React/effect-atom stack and exports reusable TUI primitives. `@kitz/release` depends on `@kitz/tui` for the dashboard. State is decomposed into reactive effect-atom atoms that load data progressively. React components render via OpenTUI's Zig core.

**Tech Stack:** OpenTUI (`@opentui/core` + `@opentui/react`), React 19, `@effect-atom/atom` + `@effect-atom/atom-react`, Effect 4.0.0-beta.31

**Spec:** `docs/superpowers/specs/2026-04-04-release-ui-opentui-design.md`

---

## File Structure

### New Package: `packages/tui/`

| File | Responsibility |
|---|---|
| `package.json` | Package manifest with OpenTUI + React + effect-atom deps |
| `tsconfig.json` | TypeScript config with JSX support |
| `tsconfig.build.json` | Build config with JSX support |
| `src/_.ts` | Package entry — namespace exports |
| `src/__.ts` | Package barrel |
| `src/runtime.tsx` | `createApp()` — OpenTUI renderer + React mount lifecycle |
| `src/components/panel.tsx` | `Panel` — bordered box with title, active state, scroll indicator |
| `src/components/status-bar.tsx` | `StatusBar` — key=value row |
| `src/components/key-hints.tsx` | `KeyHints` — bottom keybinding bar |
| `src/components/spinner.tsx` | `Spinner` — loading indicator |
| `src/components/badge.tsx` | `Badge` — colored label |
| `src/components/_.ts` | Components barrel |

### Modified Package: `packages/release/`

| File | Responsibility |
|---|---|
| `package.json` | Add `@kitz/tui` dependency |
| `tsconfig.json` | Add `.tsx` to include, add JSX config |
| `tsconfig.build.json` | Add `.tsx` to include/exclude patterns |
| `src/cli/commands/ui-atoms.ts` | effect-atom definitions for async data loading |
| `src/cli/commands/ui-components.tsx` | Release-specific React components |
| `src/cli/commands/ui-app.tsx` | Root Dashboard React component |
| `src/cli/commands/ui.ts` | Rewritten entry point using `createApp` |

### Deleted Files

| File | Reason |
|---|---|
| `src/cli/commands/ui-lib.ts` | Renderer + reducer replaced by OpenTUI + effect-atom |

### Kept Files (no changes)

| File | Reason |
|---|---|
| `src/cli/commands/doctor-runtime.ts` | Shared with non-interactive `doctor` command |
| `src/cli/interactive.ts` | Pickers for `explain`/`plan`/`pr` — lightweight, no OpenTUI needed |

---

## Task 1: Create `@kitz/tui` package scaffold

**Files:**
- Create: `packages/tui/package.json`
- Create: `packages/tui/tsconfig.json`
- Create: `packages/tui/tsconfig.build.json`
- Create: `packages/tui/src/_.ts`
- Create: `packages/tui/src/__.ts`

Use the `creating-packages` skill to scaffold the `@kitz/tui` package. Then customize the generated files:

- [ ] **Step 1: Scaffold package using creating-packages skill**

Invoke the `creating-packages` skill to create `@kitz/tui`. The skill handles `package.json`, tsconfigs, source stubs, workspace integration, and script sync.

- [ ] **Step 2: Add dependencies to package.json**

The package needs these dependencies added:

```json
{
  "dependencies": {
    "@opentui/core": "0.1.96",
    "@opentui/react": "0.1.96",
    "@effect-atom/atom": "0.5.3",
    "@effect-atom/atom-react": "0.5.0",
    "react": "19.1.0",
    "effect": "4.0.0-beta.31"
  }
}
```

- [ ] **Step 3: Add JSX support to tsconfig.json**

Add to `compilerOptions`:

```json
{
  "jsx": "react-jsx",
  "jsxImportSource": "react"
}
```

Add `"src/**/*.tsx"` to the `include` array alongside `"src/**/*.ts"`.

- [ ] **Step 4: Add JSX support to tsconfig.build.json**

Same JSX compiler options. Add `"src/**/*.tsx"` to include. Ensure `"**/*.test.tsx"` is in exclude.

- [ ] **Step 5: Install dependencies**

Run: `bun install`

Verify OpenTUI native binary loads:

```bash
bun -e "const { createCliRenderer } = require('@opentui/core'); console.log('OpenTUI loaded')"
```

- [ ] **Step 6: Commit**

```
feat(tui): scaffold @kitz/tui package with OpenTUI + React + effect-atom
```

---

## Task 2: Build `createApp` runtime

**Files:**
- Create: `packages/tui/src/runtime.tsx`
- Modify: `packages/tui/src/__.ts`

- [ ] **Step 1: Create runtime.tsx**

```tsx
import { createCliRenderer, type CliRenderer } from '@opentui/core'
import { createRoot, type Root } from '@opentui/react'
import { Effect } from 'effect'
import type { ReactElement } from 'react'

export interface App {
  readonly renderer: CliRenderer
  readonly root: Root
  readonly destroy: () => void
}

export const createApp = (element: ReactElement): Effect.Effect<App> =>
  Effect.promise(async () => {
    const renderer = await createCliRenderer()
    const root = createRoot(renderer)
    root.render(element)
    return {
      renderer,
      root,
      destroy: () => renderer.destroy(),
    }
  })

export const runApp = (element: ReactElement): Effect.Effect<never> =>
  Effect.gen(function* () {
    const app = yield* createApp(element)
    // Block until the renderer is destroyed (user quits)
    yield* Effect.promise(
      () =>
        new Promise<void>((resolve) => {
          app.renderer.on('destroy', () => resolve())
        }),
    )
  })
```

- [ ] **Step 2: Export from barrel**

In `packages/tui/src/__.ts`:

```typescript
export { createApp, runApp, type App } from './runtime.js'
```

- [ ] **Step 3: Verify it compiles**

Run: `bun run --cwd packages/tui check:types`

- [ ] **Step 4: Commit**

```
feat(tui): add createApp runtime wrapper for OpenTUI + React
```

---

## Task 3: Build TUI components — Panel, StatusBar, KeyHints, Spinner, Badge

**Files:**
- Create: `packages/tui/src/components/panel.tsx`
- Create: `packages/tui/src/components/status-bar.tsx`
- Create: `packages/tui/src/components/key-hints.tsx`
- Create: `packages/tui/src/components/spinner.tsx`
- Create: `packages/tui/src/components/badge.tsx`
- Create: `packages/tui/src/components/_.ts`
- Modify: `packages/tui/src/__.ts`

- [ ] **Step 1: Create Panel component**

`packages/tui/src/components/panel.tsx`:

```tsx
import type { ReactNode } from 'react'

export interface PanelProps {
  readonly title: string
  readonly active?: boolean
  readonly width?: string | number
  readonly height?: string | number
  readonly flex?: number
  readonly children?: ReactNode
}

export function Panel({ title, active = false, width, height, flex, children }: PanelProps) {
  const borderColor = active ? '#00BFFF' : '#555555'
  const titleColor = active ? '#00BFFF' : '#888888'

  return (
    <box
      border={true}
      borderStyle="rounded"
      borderFg={borderColor}
      title={` ${title} `}
      titleFg={titleColor}
      width={width}
      height={height}
      flex={flex}
      flexDirection="column"
    >
      {children}
    </box>
  )
}
```

- [ ] **Step 2: Create StatusBar component**

`packages/tui/src/components/status-bar.tsx`:

```tsx
export interface StatusBarEntry {
  readonly label: string
  readonly value: string
}

export interface StatusBarProps {
  readonly entries: readonly StatusBarEntry[]
  readonly message?: string
}

export function StatusBar({ entries, message }: StatusBarProps) {
  return (
    <box flexDirection="row" height={1} width="100%">
      {entries.map((entry, i) => (
        <box key={i} flexDirection="row" paddingRight={2}>
          <text content={`${entry.label}: `} fg="#888888" />
          <text content={entry.value} fg="#FFFFFF" />
        </box>
      ))}
      {message && (
        <box flex={1}>
          <text content={message} fg="#FFAA00" />
        </box>
      )}
    </box>
  )
}
```

- [ ] **Step 3: Create KeyHints component**

`packages/tui/src/components/key-hints.tsx`:

```tsx
export interface KeyHint {
  readonly key: string
  readonly label: string
}

export interface KeyHintsProps {
  readonly hints: readonly KeyHint[]
}

export function KeyHints({ hints }: KeyHintsProps) {
  return (
    <box flexDirection="row" height={1} width="100%">
      {hints.map((hint, i) => (
        <box key={i} flexDirection="row" paddingRight={2}>
          <text content={hint.key} fg="#00BFFF" />
          <text content={` ${hint.label}`} fg="#888888" />
        </box>
      ))}
    </box>
  )
}
```

- [ ] **Step 4: Create Spinner component**

`packages/tui/src/components/spinner.tsx`:

```tsx
import { useEffect, useState } from 'react'

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export interface SpinnerProps {
  readonly label?: string
}

export function Spinner({ label = 'Loading...' }: SpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length)
    }, 80)
    return () => clearInterval(interval)
  }, [])

  return (
    <box flexDirection="row">
      <text content={`${frames[frame]} `} fg="#00BFFF" />
      <text content={label} fg="#888888" />
    </box>
  )
}
```

- [ ] **Step 5: Create Badge component**

`packages/tui/src/components/badge.tsx`:

```tsx
export interface BadgeProps {
  readonly label: string
  readonly active?: boolean
  readonly color?: string
  readonly activeColor?: string
}

export function Badge({ label, active = false, color = '#555555', activeColor = '#00BFFF' }: BadgeProps) {
  const bg = active ? activeColor : undefined
  const fg = active ? '#000000' : color

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text content={active ? ` ${label} ` : label} fg={fg} backgroundColor={bg} />
    </box>
  )
}
```

- [ ] **Step 6: Create components barrel**

`packages/tui/src/components/_.ts`:

```typescript
export { Badge, type BadgeProps } from './badge.js'
export { KeyHints, type KeyHint, type KeyHintsProps } from './key-hints.js'
export { Panel, type PanelProps } from './panel.js'
export { Spinner, type SpinnerProps } from './spinner.js'
export { StatusBar, type StatusBarEntry, type StatusBarProps } from './status-bar.js'
```

- [ ] **Step 7: Update package barrel**

`packages/tui/src/__.ts` — add:

```typescript
export * from './components/_.js'
```

- [ ] **Step 8: Verify types**

Run: `bun run --cwd packages/tui check:types`

- [ ] **Step 9: Commit**

```
feat(tui): add Panel, StatusBar, KeyHints, Spinner, Badge components
```

---

## Task 4: Build release UI atoms

**Files:**
- Create: `packages/release/src/cli/commands/ui-atoms.ts`
- Modify: `packages/release/package.json` — add `@kitz/tui` dependency
- Modify: `packages/release/tsconfig.json` — add JSX + .tsx include

- [ ] **Step 1: Add @kitz/tui dependency to release**

In `packages/release/package.json`, add to dependencies:

```json
"@kitz/tui": "workspace:*"
```

Run: `bun install`

- [ ] **Step 2: Configure TSX support in release tsconfig.json**

Add `"jsx": "react-jsx"` and `"jsxImportSource": "react"` to compilerOptions. Change include from `["src/**/*.ts"]` to `["src/**/*.ts", "src/**/*.tsx"]`.

- [ ] **Step 3: Configure TSX in release tsconfig.build.json**

Read the current `tsconfig.build.json`, add the same JSX options, and add `.tsx` patterns to include/exclude.

- [ ] **Step 4: Create ui-atoms.ts**

`packages/release/src/cli/commands/ui-atoms.ts`:

```typescript
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Effect, FileSystem, Layer, Option } from 'effect'
import { Fs } from '@kitz/fs'
import * as Api from '../../api/__.js'
import {
  ChildProcessSpawnerLayer,
  FileSystemLayer,
  ServicesLayer,
  TerminalLayer,
} from '../../platform.js'
import { loadConfiguredPullRequestDiff, resolveDiffRemote } from '../pr-preview-diff.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'
import { createDoctorSummaryForPlan, runDoctorReportForPlan } from './doctor-runtime.js'
import { loadActivePlan } from './plan-file.js'

// ─── Types ───────────────────────────────────────────────────────────

export type Lifecycle = Api.Version.Lifecycle
export type SelectionMode = 'all' | 'exclude' | 'include'
export type FocusPane = 'packages' | 'plan' | 'doctor' | 'diff'

export interface UiPackage {
  readonly scope: string
  readonly name: string
}

export interface WorkspaceContext {
  readonly config: Api.Config.ResolvedConfig
  readonly analysis: Api.Analyzer.Models.Analysis
  readonly packages: readonly Api.Analyzer.Workspace.Package[]
  readonly uiPackages: readonly UiPackage[]
  readonly currentBranch: string
  readonly diffRemote: string
  readonly pullRequest: Github.PullRequest | null
  readonly diff: Api.Lint.Diff | null
  readonly persistedPlanPath: string
  readonly persistedPlanLabel: string
  readonly persistedPlanText: string | undefined
  readonly initialLifecycle: Lifecycle
}

// ─── Service Layer ───────────────────────────────────────────────────

export const ReleaseUiLayer = Layer.mergeAll(
  Env.Live,
  ServicesLayer,
  FileSystemLayer,
  TerminalLayer,
  ChildProcessSpawnerLayer,
  Api.Lint.Preconditions.DefaultLayer,
  Api.Lint.ReleasePlan.DefaultReleasePlanLayer,
  Git.GitLive,
)

// ─── Data Loading Effects ────────────────────────────────────────────

export const loadWorkspaceContext = Effect.gen(function* () {
  const git = yield* Git.Git
  const workspace = yield* loadCommandWorkspace()
  if (!isReadyCommandWorkspace(workspace)) return null

  const { config, packages } = workspace
  const planState = yield* loadActivePlan()
  const planLocation = yield* Api.Planner.Store.resolveActivePlanLocation
  const fs = yield* FileSystem.FileSystem
  const persistedPlanTextOption = yield* fs
    .readFileString(Fs.Path.toString(planLocation.file))
    .pipe(Effect.option)
  const persistedPlanText =
    persistedPlanTextOption._tag === 'Some' ? persistedPlanTextOption.value : undefined
  const currentBranch = yield* git.getCurrentBranch()
  const tags = yield* git.getTags()
  const analysis = yield* Api.Analyzer.analyze({
    packages,
    tags,
    resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
  })
  const diffRemote = resolveDiffRemote(config)
  const pullRequestAttempt = yield* Api.Explorer.resolvePullRequest().pipe(Effect.result)
  const pullRequest = pullRequestAttempt._tag === 'Success' ? pullRequestAttempt.success : null
  const diff = pullRequest
    ? yield* loadConfiguredPullRequestDiff({ config, pullRequest, packages, required: false })
    : null

  const persistedPlanLabel =
    planState._tag === 'PlanLoaded'
      ? `${planState.plan.lifecycle} plan`
      : planState._tag === 'PlanInvalid'
        ? 'invalid plan on disk'
        : 'missing'

  const uiPackages = [...packages]
    .map((pkg) => ({ scope: pkg.scope, name: pkg.name.moniker }))
    .toSorted((a, b) => a.scope.localeCompare(b.scope))

  const initialLifecycle: Lifecycle =
    planState._tag === 'PlanLoaded' ? planState.plan.lifecycle : 'official'

  return {
    config,
    analysis,
    packages,
    uiPackages,
    currentBranch,
    diffRemote,
    pullRequest,
    diff,
    persistedPlanPath: Fs.Path.toString(planLocation.file),
    persistedPlanLabel,
    persistedPlanText,
    initialLifecycle,
  } satisfies WorkspaceContext
})

export const buildPlan = (
  workspace: WorkspaceContext,
  lifecycle: Lifecycle,
  selectionMode: SelectionMode,
  selectedPackages: readonly string[],
) =>
  Effect.gen(function* () {
    const options = toPlannerOptions(selectionMode, selectedPackages, workspace.uiPackages)
    const ctx = { packages: workspace.packages }

    switch (lifecycle) {
      case 'official':
        return yield* Api.Planner.official(workspace.analysis, ctx, options)
      case 'candidate':
        return yield* Api.Planner.candidate(workspace.analysis, ctx, options)
      case 'ephemeral':
        return yield* Api.Planner.ephemeral(workspace.analysis, ctx, options)
    }
  })

export const buildDoctorReport = (workspace: WorkspaceContext, plan: Api.Planner.Plan) =>
  Effect.gen(function* () {
    const report = yield* runDoctorReportForPlan(
      {
        config: workspace.config,
        analysis: workspace.analysis,
        packages: workspace.packages,
        currentBranch: workspace.currentBranch,
        pullRequest: workspace.pullRequest,
        diff: workspace.diff,
        diffRemote: workspace.diffRemote,
      },
      plan,
    )
    const summary = createDoctorSummaryForPlan(plan, report)
    return summary
      ? Api.Commentator.renderDoctorSummary(summary)
      : 'Doctor found no issues for the current draft.'
  })

export const renderPlanText = (plan: Api.Planner.Plan): string => {
  const planned = plan.releases.length + plan.cascades.length
  return planned === 0
    ? 'No releases planned.'
    : Api.Renderer.renderPlan(plan)
}

export const serializePlanJson = (plan: Api.Planner.Plan): string =>
  JSON.stringify(Api.Planner.Plan.encodeSync(plan), null, 2)

// ─── Helpers ─────────────────────────────────────────────────────────

const toPlannerOptions = (
  mode: SelectionMode,
  selected: readonly string[],
  packages: readonly UiPackage[],
): Api.Planner.Options | undefined => {
  if (mode === 'all') return undefined
  const monikers = packages.filter((p) => selected.includes(p.scope)).map((p) => p.name)
  if (mode === 'include') return { packages: monikers }
  return monikers.length > 0 ? { exclude: monikers } : undefined
}
```

- [ ] **Step 5: Verify types**

Run: `bun run --cwd packages/release check:types`

- [ ] **Step 6: Commit**

```
feat(release): add effect-atom-compatible data loading for release UI
```

---

## Task 5: Build release React components

**Files:**
- Create: `packages/release/src/cli/commands/ui-components.tsx`

- [ ] **Step 1: Create ui-components.tsx**

```tsx
import { useKeyboard, useRenderer } from '@opentui/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, KeyHints, Panel, Spinner, StatusBar, type KeyHint } from '@kitz/tui'
import type { FocusPane, Lifecycle, SelectionMode, UiPackage } from './ui-atoms.js'

// ─── LifecycleTabs ───────────────────────────────────────────────────

const lifecycles: readonly Lifecycle[] = ['official', 'candidate', 'ephemeral']

export function LifecycleTabs({
  value,
  onChange,
}: {
  readonly value: Lifecycle
  readonly onChange: (lifecycle: Lifecycle) => void
}) {
  return (
    <box flexDirection="row" height={1} paddingLeft={1}>
      <text content="Lifecycle " fg="#888888" />
      {lifecycles.map((lc) => (
        <Badge key={lc} label={lc.toUpperCase()} active={lc === value} />
      ))}
    </box>
  )
}

// ─── PackageList ─────────────────────────────────────────────────────

export function PackageList({
  packages,
  selectedPackages,
  cursor,
  selectionMode,
}: {
  readonly packages: readonly UiPackage[]
  readonly selectedPackages: readonly string[]
  readonly cursor: number
  readonly selectionMode: SelectionMode
}) {
  return (
    <scrollbox scrollY={Math.max(0, cursor - 5)}>
      {packages.map((pkg, i) => {
        const isCursor = i === cursor
        const isSelected = selectedPackages.includes(pkg.scope)
        const marker = selectionMode === 'all' ? '  ' : isSelected ? '[x]' : '[ ]'
        const cursorChar = isCursor ? '>' : ' '
        const fg = isCursor ? '#00BFFF' : '#CCCCCC'

        return (
          <box key={pkg.scope} flexDirection="row" height={1}>
            <text content={`${cursorChar} ${marker} `} fg={fg} />
            <text content={pkg.scope} fg={fg} />
            <text content={` ${pkg.name}`} fg="#666666" />
          </box>
        )
      })}
    </scrollbox>
  )
}

// ─── Content Panes ───────────────────────────────────────────────────

interface AsyncPaneProps {
  readonly loading: boolean
  readonly error: string | undefined
  readonly content: string | undefined
  readonly label?: string
}

function AsyncPane({ loading, error, content, label }: AsyncPaneProps) {
  if (loading) return <Spinner label={label ?? 'Computing...'} />
  if (error) return <text content={error} fg="#FF5555" />
  if (!content) return <text content="No data." fg="#666666" />
  return (
    <scrollbox>
      <text content={content} />
    </scrollbox>
  )
}

export function PlanPane({
  loading,
  error,
  planText,
}: {
  readonly loading: boolean
  readonly error: string | undefined
  readonly planText: string | undefined
}) {
  return <AsyncPane loading={loading} error={error} content={planText} label="Building plan..." />
}

export function DoctorPane({
  loading,
  error,
  doctorText,
}: {
  readonly loading: boolean
  readonly error: string | undefined
  readonly doctorText: string | undefined
}) {
  return (
    <AsyncPane loading={loading} error={error} content={doctorText} label="Running doctor..." />
  )
}

export function DiffPane({
  loading,
  persistedText,
  draftText,
}: {
  readonly loading: boolean
  readonly persistedText: string | undefined
  readonly draftText: string | undefined
}) {
  if (loading) return <Spinner label="Computing diff..." />
  if (!draftText) return <text content="No draft to compare." fg="#666666" />

  const oldText = normalizeJson(persistedText ?? '')
  const newText = normalizeJson(draftText)

  if (oldText === newText) {
    return <text content="No changes. Draft matches persisted plan." fg="#666666" />
  }

  return <diff oldText={oldText} newText={newText} viewMode="unified" />
}

function normalizeJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

// ─── Key Hints ───────────────────────────────────────────────────────

export const dashboardKeyHints: readonly KeyHint[] = [
  { key: 'o/c/e', label: 'lifecycle' },
  { key: 'a', label: 'all' },
  { key: 'i', label: 'include' },
  { key: 'x', label: 'exclude' },
  { key: 't', label: 'toggle' },
  { key: 'Tab', label: 'pane' },
  { key: 'j/k', label: 'scroll' },
  { key: 'p', label: 'persist' },
  { key: 'r', label: 'refresh' },
  { key: 'q', label: 'quit' },
]
```

- [ ] **Step 2: Verify types**

Run: `bun run --cwd packages/release check:types`

- [ ] **Step 3: Commit**

```
feat(release): add React components for release UI dashboard
```

---

## Task 6: Build Dashboard root and rewrite entry point

**Files:**
- Create: `packages/release/src/cli/commands/ui-app.tsx`
- Rewrite: `packages/release/src/cli/commands/ui.ts`
- Delete: `packages/release/src/cli/commands/ui-lib.ts`

This is the integration task — wiring atoms, components, and runtime together.

- [ ] **Step 1: Create ui-app.tsx**

`packages/release/src/cli/commands/ui-app.tsx`:

```tsx
import { useKeyboard, useRenderer } from '@opentui/react'
import { useCallback, useEffect, useState } from 'react'
import { KeyHints, Panel, Spinner, StatusBar } from '@kitz/tui'
import { Effect } from 'effect'
import * as Api from '../../api/__.js'
import {
  buildDoctorReport,
  buildPlan,
  loadWorkspaceContext,
  ReleaseUiLayer,
  renderPlanText,
  serializePlanJson,
  type FocusPane,
  type Lifecycle,
  type SelectionMode,
  type WorkspaceContext,
} from './ui-atoms.js'
import {
  dashboardKeyHints,
  DiffPane,
  DoctorPane,
  LifecycleTabs,
  PackageList,
  PlanPane,
} from './ui-components.js'

const focusOrder: readonly FocusPane[] = ['packages', 'plan', 'doctor', 'diff']

export function Dashboard() {
  const renderer = useRenderer()

  // ─── Interaction state ────────────────────────────────────────────
  const [lifecycle, setLifecycle] = useState<Lifecycle>('official')
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all')
  const [selectedPackages, setSelectedPackages] = useState<readonly string[]>([])
  const [focusPane, setFocusPane] = useState<FocusPane>('packages')
  const [packageCursor, setPackageCursor] = useState(0)
  const [message, setMessage] = useState('Loading workspace...')

  // ─── Async data state ─────────────────────────────────────────────
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [planText, setPlanText] = useState<string | undefined>(undefined)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | undefined>(undefined)
  const [plan, setPlan] = useState<Api.Planner.Plan | undefined>(undefined)
  const [doctorText, setDoctorText] = useState<string | undefined>(undefined)
  const [doctorLoading, setDoctorLoading] = useState(false)
  const [doctorError, setDoctorError] = useState<string | undefined>(undefined)
  const [draftJson, setDraftJson] = useState<string | undefined>(undefined)

  // ─── Run an Effect with the release layer ─────────────────────────
  const runEffect = useCallback(
    <A,>(effect: Effect.Effect<A, unknown, never>): Promise<A> =>
      Effect.runPromise(Effect.provide(effect, ReleaseUiLayer) as Effect.Effect<A>),
    [],
  )

  // ─── Load workspace ───────────────────────────────────────────────
  const loadWorkspace = useCallback(async () => {
    setWorkspaceLoading(true)
    try {
      const ctx = await runEffect(loadWorkspaceContext)
      if (ctx === null) {
        setMessage('No packages found.')
        setWorkspaceLoading(false)
        return
      }
      setWorkspace(ctx)
      setLifecycle(ctx.initialLifecycle)
      setMessage(`Loaded ${ctx.uiPackages.length} packages.`)
    } catch (error) {
      setMessage(`Workspace error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setWorkspaceLoading(false)
    }
  }, [runEffect])

  // ─── Build plan when dependencies change ──────────────────────────
  const rebuildPlan = useCallback(async () => {
    if (!workspace) return
    setPlanLoading(true)
    setPlanError(undefined)
    setDoctorLoading(true)
    setDoctorError(undefined)
    try {
      const p = await runEffect(
        buildPlan(workspace, lifecycle, selectionMode, selectedPackages),
      )
      setPlan(p)
      setPlanText(renderPlanText(p))
      const planned = p.releases.length + p.cascades.length
      setDraftJson(planned > 0 ? serializePlanJson(p) : undefined)
      setMessage(`${lifecycle} plan: ${planned} packages.`)
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : String(error))
      setPlan(undefined)
      setDraftJson(undefined)
    } finally {
      setPlanLoading(false)
    }
  }, [workspace, lifecycle, selectionMode, selectedPackages, runEffect])

  // ─── Build doctor when plan changes ───────────────────────────────
  useEffect(() => {
    if (!workspace || !plan) {
      setDoctorLoading(false)
      return
    }
    const planned = plan.releases.length + plan.cascades.length
    if (planned === 0) {
      setDoctorText('Doctor skipped — no planned packages.')
      setDoctorLoading(false)
      return
    }
    setDoctorLoading(true)
    runEffect(buildDoctorReport(workspace, plan))
      .then((text) => {
        setDoctorText(text)
        setDoctorLoading(false)
      })
      .catch((error) => {
        setDoctorError(error instanceof Error ? error.message : String(error))
        setDoctorLoading(false)
      })
  }, [workspace, plan, runEffect])

  // ─── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  // Rebuild plan when dependencies change
  useEffect(() => {
    rebuildPlan()
  }, [rebuildPlan])

  // ─── Keyboard handling ────────────────────────────────────────────
  useKeyboard(
    useCallback(
      (event: { name: string; ctrl?: boolean }) => {
        // Quit
        if (event.name === 'q' || event.name === 'escape' || (event.name === 'c' && event.ctrl)) {
          renderer.destroy()
          return
        }

        // Lifecycle
        if (event.name === 'o') { setLifecycle('official'); return }
        if (event.name === 'c') { setLifecycle('candidate'); return }
        if (event.name === 'e') { setLifecycle('ephemeral'); return }

        // Selection mode
        if (event.name === 'a') { setSelectionMode('all'); setSelectedPackages([]); return }
        if (event.name === 'i') { setSelectionMode('include'); return }
        if (event.name === 'x') { setSelectionMode('exclude'); return }

        // Tab cycle
        if (event.name === 'tab') {
          setFocusPane((current) => {
            const i = focusOrder.indexOf(current)
            return focusOrder[(i + 1) % focusOrder.length]!
          })
          return
        }

        // Navigate
        if (event.name === 'up' || event.name === 'k') {
          if (focusPane === 'packages' && workspace) {
            setPackageCursor((c) =>
              workspace.uiPackages.length <= 0 ? 0 : (c - 1 + workspace.uiPackages.length) % workspace.uiPackages.length,
            )
          }
          return
        }
        if (event.name === 'down' || event.name === 'j') {
          if (focusPane === 'packages' && workspace) {
            setPackageCursor((c) =>
              workspace.uiPackages.length <= 0 ? 0 : (c + 1) % workspace.uiPackages.length,
            )
          }
          return
        }

        // Toggle package
        if (event.name === 't' || (event.name === 'return' && focusPane === 'packages')) {
          if (!workspace) return
          const pkg = workspace.uiPackages[packageCursor]
          if (!pkg) return
          setSelectedPackages((prev) =>
            prev.includes(pkg.scope)
              ? prev.filter((s) => s !== pkg.scope)
              : [...prev, pkg.scope],
          )
          return
        }

        // Persist
        if (event.name === 'p') {
          if (!plan) {
            setMessage('Nothing to persist.')
            return
          }
          const planned = plan.releases.length + plan.cascades.length
          const persist = planned === 0
            ? Api.Planner.Store.deleteActive
            : Api.Planner.Store.writeActive(plan)
          runEffect(persist)
            .then(() => {
              setMessage(planned === 0 ? 'Cleared the canonical plan.' : 'Persisted the draft plan.')
              loadWorkspace()
            })
            .catch((err) => setMessage(`Persist failed: ${err instanceof Error ? err.message : String(err)}`))
          return
        }

        // Refresh
        if (event.name === 'r') {
          loadWorkspace()
          setMessage('Refreshing...')
          return
        }
      },
      [focusPane, workspace, packageCursor, plan, runEffect, loadWorkspace],
    ),
    { release: false },
  )

  // ─── Render ───────────────────────────────────────────────────────
  if (workspaceLoading) {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <box flex={1} justifyContent="center" alignItems="center">
          <Spinner label="Loading workspace..." />
        </box>
      </box>
    )
  }

  if (!workspace) {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <text content="No packages found." fg="#FF5555" />
      </box>
    )
  }

  return (
    <box flexDirection="column" width="100%" height="100%">
      <StatusBar
        entries={[
          { label: 'Plan', value: workspace.persistedPlanPath },
          { label: 'State', value: workspace.persistedPlanLabel },
        ]}
        message={message}
      />
      <LifecycleTabs value={lifecycle} onChange={setLifecycle} />

      <box flexDirection="row" flex={1}>
        <Panel title="Packages" active={focusPane === 'packages'} width="30%">
          <PackageList
            packages={workspace.uiPackages}
            selectedPackages={selectedPackages}
            cursor={packageCursor}
            selectionMode={selectionMode}
          />
        </Panel>

        <box flexDirection="column" flex={1}>
          <Panel title="Draft Plan" active={focusPane === 'plan'} flex={1}>
            <PlanPane loading={planLoading} error={planError} planText={planText} />
          </Panel>
          <Panel title="Doctor" active={focusPane === 'doctor'} flex={1}>
            <DoctorPane loading={doctorLoading} error={doctorError} doctorText={doctorText} />
          </Panel>
          <Panel title="Diff" active={focusPane === 'diff'} flex={1}>
            <DiffPane
              loading={planLoading}
              persistedText={workspace.persistedPlanText}
              draftText={draftJson}
            />
          </Panel>
        </box>
      </box>

      <KeyHints hints={dashboardKeyHints} />
    </box>
  )
}
```

- [ ] **Step 2: Rewrite ui.ts entry point**

Replace `packages/release/src/cli/commands/ui.ts` entirely:

```typescript
import { Oak } from '@kitz/oak'
import { runApp } from '@kitz/tui'
import { Cause, Console, Effect } from 'effect'
import { createElement } from 'react'
import { ReleaseUiLayer } from './ui-atoms.js'
import { Dashboard } from './ui-app.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Open the interactive release dashboard UI')
  .parse()

void args

const program = Effect.gen(function* () {
  yield* runApp(createElement(Dashboard))
})

Effect.runPromise(program).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
```

- [ ] **Step 3: Delete ui-lib.ts**

Remove `packages/release/src/cli/commands/ui-lib.ts`.

- [ ] **Step 4: Verify types compile**

Run: `bun run --cwd packages/release check:types`

Fix any type errors that arise from the deletion and rewiring.

- [ ] **Step 5: Verify lint passes**

Run: `bun run --cwd packages/release check:lint`

- [ ] **Step 6: Run the UI**

```bash
bun release ui
```

Verify:
- Dashboard renders with bordered panels
- Package list populates after workspace loads
- Plan, Doctor, Diff panes show loading spinners then content
- Keyboard navigation works (j/k, tab, o/c/e, q)

- [ ] **Step 7: Commit**

```
feat(release): rewrite release UI with OpenTUI + React dashboard
```

---

## Task 7: Full project verification

- [ ] **Step 1: Full typecheck**

Run: `bun run check:types`

- [ ] **Step 2: Full lint**

Run: `bun run check:lint`

- [ ] **Step 3: Run existing tests**

Run: `bun run --cwd packages/release test`

Ensure existing tests (especially doctor-runtime tests) still pass.

- [ ] **Step 4: Manual verification**

Run `bun release ui` and verify:
1. Boot time < 5s to first interactive render
2. All 4 panels render with borders
3. Lifecycle switching works (o/c/e)
4. Package list navigation works (j/k)
5. Tab cycles through panes
6. Persist action works (p)
7. Refresh works (r)
8. Quit works (q/Esc)

- [ ] **Step 5: Final commit if any fixes were needed**

```
fix(release,tui): address type/lint issues from UI rewrite
```
