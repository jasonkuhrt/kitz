/**
 * @module cli/commands/explain
 *
 * Explain why a package is primary, cascade, or unchanged in the current release state.
 */
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Console, Effect, Layer, Option } from 'effect'
import { Argument, Command, Flag, Prompt } from 'effect/unstable/cli'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Planner from '../../api/planner/__.js'
import * as Renderer from '../../api/renderer/__.js'
import { FileSystemLayer } from '../../platform.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'
import { createPackagePickerOptions } from './explain-lib.js'

export const explain = Command.make(
  'explain',
  {
    pkg: Argument.string('pkg').pipe(
      Argument.withDescription('Package scope or full package name to explain'),
      Argument.optional,
    ),
    format: Flag.choice('format', ['text', 'json']).pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Output format'),
      Flag.withDefault('text'),
    ),
  },
  ({ pkg, format }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const git = yield* Git.Git
      const workspace = yield* loadCommandWorkspace()

      if (!isReadyCommandWorkspace(workspace)) {
        yield* Console.log(noPackagesFoundMessage)
        return
      }

      // #215: pkg is a positional argument. When omitted, prompt interactively
      // (effect cli's Prompt handles non-TTY by failing, replacing the hand-rolled
      // Cli.Picker TTY-capability machinery).
      const requestedPackage = Option.isSome(pkg)
        ? pkg.value
        : yield* Prompt.select({
            message: 'Select package to explain',
            choices: createPackagePickerOptions(workspace.packages).map((option) => ({
              title: option.label,
              value: option.value,
              description: option.detail,
            })),
          })

      const tags = yield* git.getTags()
      const explanation = yield* Planner.explain(
        yield* Analyzer.analyze({
          packages: [...workspace.packages],
          tags,
          resolvedConventionalCommitTypes: workspace.config.resolvedConventionalCommitTypes,
          commitOverrides: workspace.config.commitOverrides,
        }),
        {
          packages: workspace.packages,
          requestedPackage,
        },
      )

      const output =
        format === 'json'
          ? JSON.stringify(explanation, null, 2)
          : Renderer.renderExplanation(explanation)

      if (explanation.decision === 'missing') {
        yield* Console.error(output)
        return env.exit(1)
      }

      yield* Console.log(output)
    }),
).pipe(
  Command.withDescription('Explain why a package is primary, cascade, or unchanged'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer, Git.GitLive)),
)
