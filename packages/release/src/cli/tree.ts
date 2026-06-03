/**
 * @module cli/tree
 *
 * The root `release` command tree. Defined separately from the entry point
 * (`cli.ts`) so it can be imported for introspection — e.g. the CLI-reference
 * doc generator walks this tree — without executing `runMain`.
 */
import { Command } from 'effect/unstable/cli'
import { apply } from './commands/apply.js'
import { archive } from './commands/archive.js'
import { conformance } from './commands/conformance.js'
import { doctor } from './commands/doctor.js'
import { explain } from './commands/explain.js'
import { forecast } from './commands/forecast.js'
import { git } from './commands/git.js'
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

export const release = Command.make('release').pipe(
  Command.withDescription('Kitz release toolkit'),
  Command.withSubcommands([
    apply,
    archive,
    conformance,
    doctor,
    explain,
    forecast,
    git,
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
