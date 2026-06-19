/**
 * @module cli/commands/explain
 *
 * Explain why a package is primary, cascade, or unchanged in the current release state.
 */
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { FileSystemLayer, TerminalLayer } from '../../platform.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'
import { createPackagePickerOptions, resolveExplainPackage } from './explain-lib.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Explain why a package is primary, cascade, or unchanged')
  .parameter(
    'pkg',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Package scope or full package name to explain' }),
    ),
  )
  .parameter(
    'format f',
    Schema.UndefinedOr(Schema.Literals(['text', 'json']))
      .pipe(
        Schema.decodeTo(Schema.Literals(['text', 'json']), {
          decode: SchemaGetter.transform((value) => value ?? 'text'),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(Schema.annotate({ description: 'Output format', default: 'text' })),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer, TerminalLayer, Git.GitLive))(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const git = yield* Git.Git
    const terminal = Cli.Picker.resolveInteractiveTerminalCapabilities({ env: env.vars })
    const workspace = yield* loadCommandWorkspace()

    if (!isReadyCommandWorkspace(workspace)) {
      yield* Console.log(noPackagesFoundMessage)
      return
    }

    const packageOptions = createPackagePickerOptions(workspace.packages)
    const requestedPackageSelection = yield* resolveExplainPackage({
      pkg: args.pkg,
      terminal,
      pickPackage: () =>
        Cli.Picker.pickOption({
          title: 'Select package to explain',
          hint: 'Choose the package whose release outcome you want to inspect.',
          options: packageOptions,
          color: terminal.color,
        }),
    })

    if (requestedPackageSelection._tag === 'missing') {
      yield* Console.error(requestedPackageSelection.message)
      return env.exit(1)
    }
    const requestedPackage = requestedPackageSelection.value

    const tags = yield* git.getTags()
    const explanation = yield* Api.Planner.explain(
      yield* Api.Analyzer.analyze({
        packages: [...workspace.packages],
        tags,
        resolvedConventionalCommitTypes: workspace.config.resolvedConventionalCommitTypes,
      }),
      {
        packages: workspace.packages,
        requestedPackage,
      },
    )

    const output =
      args.format === 'json'
        ? JSON.stringify(explanation, null, 2)
        : Api.Renderer.renderExplanation(explanation)

    if (explanation.decision === 'missing') {
      yield* Console.error(output)
      return env.exit(1)
    }

    yield* Console.log(output)
  }),
)
