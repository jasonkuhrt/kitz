/**
 * @module cli/commands/ui
 *
 * Open the interactive release dashboard (TUI).
 *
 * The heavy TUI stack (`@kitz/tui`, `react`, opentui, the dashboard component)
 * is loaded via dynamic `import()` inside the handler so the root command tree
 * does not pull it into the module graph of every `release <command>` startup.
 */
import { Effect } from 'effect'
import { Command } from 'effect/unstable/cli'

export const ui = Command.make('ui', {}, () =>
  Effect.gen(function* () {
    const { Tui } = yield* Effect.promise(() => import('@kitz/tui'))
    const { createElement } = yield* Effect.promise(() => import('react'))
    const { Dashboard } = yield* Effect.promise(() => import('./ui-app.js'))
    yield* Tui.runApp(createElement(Dashboard))
  }),
).pipe(Command.withDescription('Open the interactive release dashboard'))
