#!/usr/bin/env node
/**
 * Release CLI entry point.
 *
 * Builds a single root `Command` tree from `effect/unstable/cli` and runs it.
 * Each command in `commands/` exports a `Command` value; the root composes them
 * via `withSubcommands`. The framework owns argument parsing, `-h`/`--help`,
 * version, and shell completions. Each command provides its own domain services
 * (via `Command.provide`); the root provides the CLI `Environment` (filesystem,
 * path, terminal, stdio, child-process spawner) that the framework and any
 * interactive prompts require.
 */
import { Platform } from '@kitz/platform'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import { apply } from './commands/apply.js'
import { archive } from './commands/archive.js'
import { conformance } from './commands/conformance.js'
import { doctor } from './commands/doctor.js'
import { explain } from './commands/explain.js'
import { forecast } from './commands/forecast.js'
import { graph } from './commands/graph.js'
import { history } from './commands/history.js'
import { init } from './commands/init.js'
import { inspect } from './commands/inspect.js'
import { matrix } from './commands/matrix.js'
import { notes } from './commands/notes.js'
import { plan } from './commands/plan.js'
import { pr } from './commands/pr.js'
import { preview } from './commands/preview.js'
import { prove } from './commands/prove.js'
import { prune } from './commands/prune.js'
import { reconcile } from './commands/reconcile.js'
import { rehearse } from './commands/rehearse.js'
import { repair } from './commands/repair.js'
import { resume } from './commands/resume.js'
import { status } from './commands/status.js'
import { trust } from './commands/trust.js'
import { ui } from './commands/ui.js'
import { validateSetup } from './commands/validate-setup.js'

const release = Command.make('release').pipe(
  Command.withDescription('Kitz release toolkit'),
  Command.withSubcommands([
    apply,
    archive,
    conformance,
    doctor,
    explain,
    forecast,
    graph,
    history,
    init,
    inspect,
    matrix,
    notes,
    plan,
    preview,
    pr,
    prove,
    prune,
    reconcile,
    rehearse,
    repair,
    resume,
    status,
    trust,
    ui,
    validateSetup,
  ]),
)

const CliEnvironment = Layer.mergeAll(
  Platform.FileSystem.layer,
  Platform.Path.layer,
  Platform.Terminal.layer,
  Platform.Stdio.layer,
  Platform.ChildProcessSpawner.layer.pipe(
    Layer.provide(Platform.FileSystem.layer),
    Layer.provide(Platform.Path.layer),
  ),
)

Platform.Runtime.runMain(
  Command.run(release, { version: '0.0.0-kitz-release' }).pipe(Effect.provide(CliEnvironment)),
)
