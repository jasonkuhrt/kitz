import { useKeyboard, useRenderer } from '@opentui/react'
import { useCallback, useEffect, useState } from 'react'
import { Tui } from '@kitz/tui'
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
  LifecycleTabs,
  PackageList,
  TextPane,
} from './ui-components.js'

const focusOrder: readonly FocusPane[] = ['packages', 'plan', 'doctor', 'diff']

function runEffect<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  return Effect.runPromise(Effect.provide(effect, ReleaseUiLayer) as unknown as Effect.Effect<A>)
}

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
  }, [])

  // ─── Build plan when dependencies change ──────────────────────────
  const rebuildPlan = useCallback(async () => {
    if (!workspace) return
    setPlanLoading(true)
    setPlanError(undefined)
    try {
      const p = await runEffect(buildPlan(workspace, lifecycle, selectionMode, selectedPackages))
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
  }, [workspace, lifecycle, selectionMode, selectedPackages])

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
    setDoctorError(undefined)
    void runEffect(buildDoctorReport(workspace, plan))
      .then((text) => {
        setDoctorText(text)
        setDoctorLoading(false)
        return undefined
      })
      .catch((error) => {
        setDoctorError(error instanceof Error ? error.message : String(error))
        setDoctorLoading(false)
      })
  }, [workspace, plan])

  // ─── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])
  useEffect(() => {
    rebuildPlan()
  }, [rebuildPlan])

  // ─── Keyboard handling ────────────────────────────────────────────
  useKeyboard(
    useCallback(
      (event: { name: string; ctrl?: boolean }) => {
        if (event.name === 'q' || event.name === 'escape' || (event.name === 'c' && event.ctrl)) {
          renderer.destroy()
          return
        }
        if (event.name === 'o') {
          setLifecycle('official')
          return
        }
        if (event.name === 'c') {
          setLifecycle('candidate')
          return
        }
        if (event.name === 'e') {
          setLifecycle('ephemeral')
          return
        }
        if (event.name === 'a') {
          setSelectionMode('all')
          setSelectedPackages([])
          return
        }
        if (event.name === 'i') {
          setSelectionMode('include')
          return
        }
        if (event.name === 'x') {
          setSelectionMode('exclude')
          return
        }
        if (event.name === 'tab') {
          setFocusPane((c) => focusOrder[(focusOrder.indexOf(c) + 1) % focusOrder.length]!)
          return
        }
        if ((event.name === 'up' || event.name === 'k') && focusPane === 'packages' && workspace) {
          setPackageCursor((c) =>
            workspace.uiPackages.length <= 0
              ? 0
              : (c - 1 + workspace.uiPackages.length) % workspace.uiPackages.length,
          )
          return
        }
        if (
          (event.name === 'down' || event.name === 'j') &&
          focusPane === 'packages' &&
          workspace
        ) {
          setPackageCursor((c) =>
            workspace.uiPackages.length <= 0 ? 0 : (c + 1) % workspace.uiPackages.length,
          )
          return
        }
        if (event.name === 't' || (event.name === 'return' && focusPane === 'packages')) {
          if (!workspace) return
          const pkg = workspace.uiPackages[packageCursor]
          if (!pkg) return
          setSelectedPackages((prev) =>
            prev.includes(pkg.scope) ? prev.filter((s) => s !== pkg.scope) : [...prev, pkg.scope],
          )
          return
        }
        if (event.name === 'p') {
          if (!plan) {
            setMessage('Nothing to persist.')
            return
          }
          const planned = plan.releases.length + plan.cascades.length
          const persist =
            planned === 0 ? Api.Planner.Store.deleteActive : Api.Planner.Store.writeActive(plan)
          void runEffect(persist)
            .then(() => {
              setMessage(planned === 0 ? 'Cleared the plan.' : 'Persisted the draft.')
              loadWorkspace()
              return undefined
            })
            .catch((err) =>
              setMessage(`Persist failed: ${err instanceof Error ? err.message : String(err)}`),
            )
          return
        }
        if (event.name === 'r') {
          loadWorkspace()
          setMessage('Refreshing...')
          return
        }
      },
      [focusPane, workspace, packageCursor, plan, loadWorkspace, renderer],
    ),
  )

  // ─── Render ───────────────────────────────────────────────────────
  if (workspaceLoading) {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <box flexGrow={1}>
          <Tui.Spinner label="Loading workspace..." />
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
      <Tui.StatusBar
        entries={[
          { label: 'Plan', value: workspace.persistedPlanPath },
          { label: 'State', value: workspace.persistedPlanLabel },
        ]}
        message={message}
      />
      <LifecycleTabs value={lifecycle} />

      <box flexDirection="row" flexGrow={1}>
        <Tui.Panel title="Packages" active={focusPane === 'packages'} width="30%">
          <PackageList
            packages={workspace.uiPackages}
            selectedPackages={selectedPackages}
            cursor={packageCursor}
            selectionMode={selectionMode}
          />
        </Tui.Panel>

        <box flexDirection="column" flexGrow={1}>
          <Tui.Panel title="Draft Plan" active={focusPane === 'plan'} flexGrow={1}>
            {planLoading ? (
              <Tui.Spinner label="Building plan..." />
            ) : planError ? (
              <text content={planError} fg="#FF5555" />
            ) : planText ? (
              <TextPane content={planText} />
            ) : (
              <text content="No plan data." fg="#666666" />
            )}
          </Tui.Panel>
          <Tui.Panel title="Doctor" active={focusPane === 'doctor'} flexGrow={1}>
            {doctorLoading ? (
              <Tui.Spinner label="Running doctor..." />
            ) : doctorError ? (
              <text content={doctorError} fg="#FF5555" />
            ) : doctorText ? (
              <TextPane content={doctorText} />
            ) : (
              <text content="Waiting for plan..." fg="#666666" />
            )}
          </Tui.Panel>
          <Tui.Panel title="Diff" active={focusPane === 'diff'} flexGrow={1}>
            {planLoading ? (
              <Tui.Spinner label="Computing diff..." />
            ) : (
              <DiffPane persistedText={workspace.persistedPlanText} draftText={draftJson} />
            )}
          </Tui.Panel>
        </box>
      </box>

      <Tui.KeyHints hints={dashboardKeyHints} />
    </box>
  )
}
