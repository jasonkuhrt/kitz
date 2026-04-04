# Release UI: OpenTUI Rewrite

## Problem

The `release ui` command has two fundamental issues:

1. **20-30s boot time** — all data (workspace scan, git tags, commit analysis, PR resolution, diff, plan generation, doctor checks) loads synchronously before the first frame renders.
2. **Low visual quality** — hand-rolled ANSI string concatenation via `Str.Builder` produces a flat, borderless dump. No panels, no scroll indicators, no visual hierarchy. The rendering approach has a ceiling and we're at it.

## Decision: OpenTUI + React + effect-atom

**Rendering**: [OpenTUI](https://github.com/sst/opentui) — Zig native TUI core with TypeScript bindings. Yoga-powered flexbox layout, double-buffered cell rendering with frame diffing, built-in `Diff`/`ScrollBox`/`Select`/`Code` components. Powers OpenCode.ai in production.

**Component model**: `@opentui/react` — React reconciler for OpenTUI. Battle-tested in OpenCode.ai. Familiar component model, hooks, JSX.

**State management**: `@effect-atom/atom-react` — Effect's reactive state library for React. Replaces the hand-rolled Elm reducer with atoms that natively compose with Effect. Atoms can represent async loading states, stream data arrivals, and compose derived state declaratively.

**Package**: New `@kitz/tui` package owns the OpenTUI dependency and exposes reusable TUI primitives. `@kitz/release` depends on `@kitz/tui` for the dashboard.

## Architecture

### Package: `@kitz/tui`

Owns the OpenTUI + React + effect-atom dependencies. Exposes:

- **Runtime**: `createApp(rootComponent)` — initializes OpenTUI `CliRenderer`, mounts React tree, manages lifecycle. Wraps the OpenTUI setup ceremony into an Effect-returning function.
- **Hooks**: `useEffectAtom(atom)`, `useEffectRun(effect)` — thin wrappers bridging Effect computations to React rendering. Backed by `@effect-atom/atom-react`.
- **Components**: Reusable TUI building blocks built on OpenTUI primitives:
  - `Panel` — bordered box with title, active/inactive styling, scroll indicator
  - `StatusBar` — key=value row with theme-aware formatting
  - `KeyHints` — bottom bar showing available keybindings
  - `Spinner` — loading indicator for async data
  - `Badge` — colored label (lifecycle tabs, status indicators)

These are the components that any kitz TUI would use. Release-specific components live in `@kitz/release`.

### Package: `@kitz/release` (changes)

**New dependencies**: `@kitz/tui`

**New files**:
- `src/cli/commands/ui-app.tsx` — Root React component. Composes the dashboard layout.
- `src/cli/commands/ui-atoms.ts` — effect-atom definitions for all data loading (workspace, plan, doctor, diff). Each atom represents a loadable async resource.
- `src/cli/commands/ui-components.tsx` — Release-specific React components (PackageList, PlanPane, DoctorPane, DiffPane, LifecycleTabs).

**Replaced files**:
- `ui-lib.ts` — The string rendering functions (`renderReleaseUi`, `renderBodyPane`, `scrollWindow`, `renderPlanOverwriteDiff`, `renderPackagesPane`) are deleted. The types (`ReleaseUiState`, `ReleaseUiAction`, `ReleaseUiViewModel`, `ReleaseUiPackage`) and the reducer (`reduceReleaseUiState`) are also deleted — state management moves to effect-atom.
- `ui.ts` — The Effect.gen event loop and alternate screen management are replaced by `createApp` from `@kitz/tui`.

**Kept files**:
- `doctor-runtime.ts` — shared with the non-interactive `doctor` command. No changes.
- `interactive.ts` — the `pickOption`/`withAlternateScreen` primitives stay for the non-dashboard commands (`explain`, `plan`, `pr` pickers). These are lightweight and don't need OpenTUI.

### Data Flow

```
              ┌──────────────────────────────────────────┐
              │           effect-atom layer              │
              │                                          │
              │  workspaceAtom ──► analysisAtom           │
              │       │               │                  │
              │       │          planAtom ──► doctorAtom  │
              │       │               │          │       │
              │       │          diffAtom        │       │
              │       │               │          │       │
              │  lifecycleAtom ───────┘          │       │
              │  selectionAtom ──────────────────┘       │
              └──────────────┬───────────────────────────┘
                             │
                      React re-renders
                             │
              ┌──────────────▼───────────────────────────┐
              │           React components               │
              │                                          │
              │  <Dashboard>                             │
              │    <StatusBar />                          │
              │    <LifecycleTabs />                      │
              │    <box flexDirection="row">              │
              │      <Panel title="Packages">            │
              │        <PackageList />                    │
              │      </Panel>                            │
              │      <box flexDirection="column" flex=1>  │
              │        <Panel title="Plan">              │
              │          <PlanPane />                     │
              │        </Panel>                          │
              │        <Panel title="Doctor">            │
              │          <DoctorPane />                   │
              │        </Panel>                          │
              │        <Panel title="Diff">              │
              │          <DiffPane />                     │
              │        </Panel>                          │
              │      </box>                              │
              │    </box>                                │
              │    <KeyHints />                           │
              │  </Dashboard>                            │
              └──────────────────────────────────────────┘
                             │
                      OpenTUI Zig core
                    (cell buffer + diff)
                             │
                          stdout
```

### State: effect-atom Design

Instead of a monolithic reducer, state is decomposed into independent reactive atoms:

```typescript
// --- User interaction atoms (synchronous) ---

const lifecycleAtom = Atom.make('official' as Lifecycle)
const selectionModeAtom = Atom.make('all' as SelectionMode)
const selectedPackagesAtom = Atom.make<readonly string[]>([])
const focusPaneAtom = Atom.make<FocusPane>('packages')
const packageCursorAtom = Atom.make(0)

// --- Derived async atoms (auto-recompute on dependency change) ---

const workspaceAtom = Atom.effect(() =>
  // Loads workspace, git tags, PR context, persisted plan
  // Returns UiRepoContext or null
  loadUiRepoContext
)

const planAtom = Atom.derived([workspaceAtom, lifecycleAtom, selectionModeAtom, selectedPackagesAtom], 
  (workspace, lifecycle, mode, selected) =>
    // Recomputes plan when lifecycle or package selection changes
    // Shows loading state during recomputation
    planDraft(workspace, lifecycle, mode, selected)
)

const doctorAtom = Atom.derived([workspaceAtom, planAtom],
  (workspace, plan) =>
    // Runs doctor checks against the current draft plan
    runDoctorReportForPlan(workspace, plan)
)

const diffAtom = Atom.derived([workspaceAtom, planAtom],
  (workspace, plan) =>
    // Computes diff between persisted and draft plan
    computePlanDiff(workspace.persistedPlanText, plan)
)
```

Each derived atom has three states: `loading`, `success(value)`, `failure(error)`. Components render accordingly — showing a spinner during loading, the content on success, an error message on failure.

**Key advantage over the reducer**: when the user changes lifecycle from `official` to `candidate`, only `planAtom` recomputes first. `doctorAtom` and `diffAtom` recompute after `planAtom` resolves. The UI shows the plan pane loading while packages and the previous doctor/diff remain visible. No 20-second freeze.

### Lazy Loading Strategy

**Phase 1 — Immediate render (< 100ms)**:
- Mount React tree with empty/loading atoms
- Render dashboard shell: panel borders, headers, lifecycle tabs, key hints
- All content panes show `<Spinner />` or "Loading..."

**Phase 2 — Workspace load (1-3s)**:
- `workspaceAtom` resolves: package list appears, status bar populates
- `planAtom` begins computing (depends on workspace)

**Phase 3 — Plan + Doctor + Diff (2-5s)**:
- `planAtom` resolves: plan pane shows release table
- `doctorAtom` and `diffAtom` begin computing (depend on plan)
- These resolve independently — whichever finishes first renders first

**Total perceived boot**: ~100ms to interactive shell, ~3s to package list, ~5s to full dashboard. Down from 20-30s blocking.

### Component Design

**Dashboard** (root):
```tsx
function Dashboard() {
  const workspace = useAtomValue(workspaceAtom)
  const lifecycle = useAtomValue(lifecycleAtom)
  const focusPane = useAtomValue(focusPaneAtom)
  
  // Key handling registered at root level
  useKeyHandler(handleDashboardKeys)

  return (
    <box flexDirection="column" width="100%" height="100%">
      <StatusBar 
        lifecycle={lifecycle}
        persistedPlanPath={workspace?.persistedPlanPath}
        message={message}
      />
      <LifecycleTabs value={lifecycle} onChange={setLifecycle} />
      
      <box flexDirection="row" flex={1}>
        <Panel title="Packages" active={focusPane === 'packages'} width="30%">
          <PackageList />
        </Panel>
        
        <box flexDirection="column" flex={1}>
          <Panel title="Plan" active={focusPane === 'plan'} flex={1}>
            <PlanPane />
          </Panel>
          <Panel title="Doctor" active={focusPane === 'doctor'} flex={1}>
            <DoctorPane />
          </Panel>
          <Panel title="Diff" active={focusPane === 'diff'} flex={1}>
            <DiffPane />
          </Panel>
        </box>
      </box>
      
      <KeyHints keys={currentKeyHints} />
    </box>
  )
}
```

**Panel** (in `@kitz/tui`):
- Bordered box with rounded corners
- Title in top border
- Active state: accent-colored border + bold title
- Inactive state: dim border + dim title
- Optional scroll indicator (line N/M) in bottom-right corner

**PackageList**:
- Scrollable list with cursor indicator (`>`)
- Selection markers (`[x]` / `[ ]`)
- Scope + moniker display
- Cursor follows keyboard, wraps around

**PlanPane**:
- Renders plan text from `Api.Renderer.renderPlan(plan)` inside a `<scrollBox>`
- Shows `<Spinner />` while `planAtom` is loading
- Shows error message on failure

**DoctorPane**:
- Renders doctor report from `Api.Commentator.renderDoctorSummary(summary)` inside a `<scrollBox>`
- Pass/warn/fail color coding

**DiffPane**:
- Uses OpenTUI's built-in `<diff>` component for the plan JSON diff
- Native diff rendering with proper added/removed/context coloring
- No more hand-rolled LCS algorithm

### Key Bindings

Same as current, mapped at the Dashboard level:

| Key | Action |
|---|---|
| `o` / `c` / `e` | Set lifecycle |
| `a` / `i` / `x` | Set selection mode (all/include/exclude) |
| `t` / `Enter` | Toggle package (when packages pane focused) |
| `Tab` | Cycle focus pane |
| `j` / `k` / `Up` / `Down` | Navigate (cursor in packages, scroll in content panes) |
| `p` | Persist current draft to disk |
| `r` | Refresh git/PR context |
| `q` / `Esc` / `Ctrl+C` | Quit |

### Persist Action

When the user presses `p`:
1. If `planAtom` is loading or failed: show status message, no-op
2. If plan has 0 releases + 0 cascades: delete the active plan file
3. Otherwise: write the plan to disk via `Api.Planner.Store.writeActive(plan)`
4. Trigger `workspaceAtom` refresh to pick up the new persisted state

### Error Handling

- Atom computation failures are captured as `failure(error)` states
- Each pane independently shows its error — one failing pane doesn't block others
- The status bar shows the most recent action result
- Fatal errors (workspace load failure) show a full-screen error message and exit

## New Dependencies

### `@kitz/tui`

```json
{
  "dependencies": {
    "@opentui/core": "^0.1.96",
    "@opentui/react": "^0.1.96",
    "@effect-atom/atom": "^0.5.3",
    "@effect-atom/atom-react": "^0.5.0",
    "react": "^19.0.0",
    "effect": "4.0.0-beta.31"
  }
}
```

Peer dependency: `web-tree-sitter@0.25.10` (required by `@opentui/core` for syntax highlighting).

### `@kitz/release`

Add: `"@kitz/tui": "workspace:*"`

## Testing Strategy

**`@kitz/tui`**:
- Unit tests for `Panel`, `StatusBar`, `KeyHints` rendering (snapshot tests against OpenTUI's renderable tree, not ANSI output)
- Integration test for `createApp` lifecycle (mount, render, unmount)

**`@kitz/release` UI**:
- Unit tests for atom derivation logic (given workspace X and lifecycle Y, expect plan Z)
- The atom computation functions are pure Effect pipelines — test them independently of React
- No need to test OpenTUI rendering — that's OpenTUI's job
- Keep existing tests for `doctor-runtime.ts` (unchanged)

## Migration Path

1. Create `@kitz/tui` package with OpenTUI + React + effect-atom
2. Build `Panel`, `StatusBar`, `KeyHints`, `Spinner`, `Badge` components
3. Create `ui-atoms.ts` with the reactive state design
4. Create `ui-components.tsx` with release-specific components
5. Create `ui-app.tsx` root component
6. Rewrite `ui.ts` entry point to use `createApp` from `@kitz/tui`
7. Delete `ui-lib.ts` (rendering functions and reducer — all replaced)
8. Keep `interactive.ts` and `doctor-runtime.ts` unchanged
