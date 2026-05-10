import { Tui } from '@kitz/tui'
import { ReleaseUiLayer } from './ui-atoms.js'
import {
  dashboardKeyHints,
  DiffPane,
  HelpOverlay,
  LifecycleTabs,
  PackageList,
  TextPane,
} from './ui-components.js'
import {
  dashboardUpdate,
  handleDashboardKey,
  initialDashboardState,
  runDashboardCommand,
  type DashboardAction,
  type DashboardState,
} from './ui-model.js'

function DashboardView({ state }: Tui.ViewProps<DashboardState, DashboardAction>) {
  if (state.workspace._tag === 'Loading') {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <box flexGrow={1}>
          <Tui.Spinner label="Loading workspace..." />
        </box>
      </box>
    )
  }

  if (state.workspace._tag === 'Failure') {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <text content={state.workspace.message} fg="#FF5555" />
      </box>
    )
  }

  const workspace = state.workspace.value
  if (workspace === null) {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <text content="No packages found." fg="#FF5555" />
      </box>
    )
  }

  if (state.showHelp) {
    return <HelpOverlay />
  }

  const draftJson = state.plan._tag === 'Ready' ? state.plan.value.draftJson : undefined
  const planPane =
    state.plan._tag === 'Loading' ? (
      <Tui.Spinner label="Building plan..." />
    ) : state.plan._tag === 'Failure' ? (
      <text content={state.plan.message} fg="#FF5555" />
    ) : state.plan._tag === 'Ready' ? (
      <TextPane content={state.plan.value.text} />
    ) : (
      <text content="No plan data." fg="#666666" />
    )

  const doctorPane =
    state.doctor._tag === 'Loading' ? (
      <Tui.Spinner label="Running doctor..." />
    ) : state.doctor._tag === 'Failure' ? (
      <text content={state.doctor.message} fg="#FF5555" />
    ) : state.doctor._tag === 'Ready' ? (
      <TextPane content={state.doctor.value} />
    ) : (
      <text content="Waiting for plan..." fg="#666666" />
    )

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Tui.StatusBar
        entries={[
          { label: 'Plan', value: workspace.persistedPlanPath },
          { label: 'State', value: workspace.persistedPlanLabel },
        ]}
        message={state.message}
      />
      <LifecycleTabs value={state.lifecycle} />

      <box flexDirection="row" flexGrow={1}>
        <Tui.Panel title="Packages" active={state.focusPane === 'packages'} width="30%">
          <PackageList
            packages={workspace.uiPackages}
            excludedPackages={state.excludedPackages}
            cursor={state.packageCursor}
          />
        </Tui.Panel>

        <box flexDirection="column" flexGrow={1}>
          <Tui.Panel title="Draft Plan" active={state.focusPane === 'plan'} flexGrow={1}>
            {planPane}
          </Tui.Panel>
          <Tui.Panel title="Doctor" active={state.focusPane === 'doctor'} flexGrow={1}>
            {doctorPane}
          </Tui.Panel>
          <Tui.Panel title="Diff" active={state.focusPane === 'diff'} flexGrow={1}>
            {state.plan._tag === 'Loading' ? (
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

export const dashboardProgram = Tui.defineProgramSpec({
  initialState: initialDashboardState,
  initialCommands: [{ _tag: 'LoadWorkspace' }],
  update: dashboardUpdate,
  run: runDashboardCommand,
  onKey: handleDashboardKey,
  view: DashboardView,
})

export function Dashboard() {
  return <Tui.Program spec={dashboardProgram} layer={ReleaseUiLayer} />
}
