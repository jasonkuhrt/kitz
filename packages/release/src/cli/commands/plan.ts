/**
 * @module cli/commands/plan
 *
 * Generate a release plan based on conventional commits since the last release.
 *
 * Supports three release lifecycles:
 * - `official` — Standard semver release
 * - `candidate` — Pre-release to the `next` dist-tag
 * - `ephemeral` — Per-PR integration release
 *
 * The plan is written to `.release/plan.json` by default and can be executed with `release apply`.
 */
import { Str } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag, Prompt } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'

const lifecycleChoices = [
  {
    title: 'official',
    value: 'official' as const,
    description: 'Publish semver releases to the default npm dist-tag.',
  },
  {
    title: 'candidate',
    value: 'candidate' as const,
    description: 'Publish a pre-release to the `next` dist-tag.',
  },
  {
    title: 'ephemeral',
    value: 'ephemeral' as const,
    description: 'Publish a per-PR integration release.',
  },
]

export const plan = Command.make(
  'plan',
  {
    lifecycle: Flag.choice('lifecycle', ['official', 'candidate', 'ephemeral']).pipe(
      Flag.withAlias('l'),
      Flag.withDescription('Release lifecycle: official, candidate, or ephemeral'),
      Flag.optional,
    ),
    pkg: Flag.string('pkg').pipe(
      Flag.withAlias('p'),
      Flag.withDescription('Only include specific package(s)'),
      Flag.atLeast(0),
    ),
    exclude: Flag.string('exclude').pipe(
      Flag.withAlias('x'),
      Flag.withDescription('Exclude package(s)'),
      Flag.atLeast(0),
    ),
    out: Flag.string('out').pipe(
      Flag.withAlias('o'),
      Flag.withDescription('Write the generated plan to a specific file path'),
      Flag.optional,
    ),
  },
  ({ lifecycle, pkg, exclude, out }) =>
    Effect.gen(function* () {
      const git = yield* Git.Git

      const workspace = yield* loadCommandWorkspace()
      if (!isReadyCommandWorkspace(workspace)) {
        yield* Console.log(noPackagesFoundMessage)
        return
      }
      const { packages } = workspace

      const resolvedLifecycle = Option.isSome(lifecycle)
        ? lifecycle.value
        : yield* Prompt.select({ message: 'Select release lifecycle', choices: lifecycleChoices })

      const filterPackages = pkg.length > 0 ? [...pkg] : undefined
      const excludePackages = exclude.length > 0 ? [...exclude] : undefined

      // Build release options
      const options = {
        ...(filterPackages && { packages: filterPackages }),
        ...(excludePackages && { exclude: excludePackages }),
      }

      // Generate plan based on type
      const header = Str.Builder()
      header`Generating ${resolvedLifecycle} release plan...`
      header``
      yield* Console.log(header.render())

      const tags = yield* git.getTags()
      const analysis = yield* Api.Analyzer.analyze({
        packages,
        tags,
        filter: filterPackages,
        exclude: excludePackages,
        resolvedConventionalCommitTypes: workspace.config.resolvedConventionalCommitTypes,
        commitOverrides: workspace.config.commitOverrides,
      })
      const ctx = { packages }

      const rawPlan = yield* resolvedLifecycle === 'official'
        ? Api.Planner.official(analysis, ctx, options)
        : resolvedLifecycle === 'candidate'
          ? Api.Planner.candidate(analysis, ctx, options)
          : Api.Planner.ephemeral(analysis, ctx, options)

      const plan = yield* Api.Planner.attachPublishContract({
        plan: rawPlan,
        config: workspace.config,
      })

      if (plan.releases.length === 0) {
        yield* Console.log('No releases planned - no unreleased changes found.')
        return
      }

      // Display plan
      yield* Console.log(Api.Renderer.renderPlan(plan))

      const outPath = Option.getOrUndefined(out)
      const planPath = outPath !== undefined ? Fs.Path.fromString(outPath) : undefined
      const planLocation = yield* Api.Planner.Store.resolvePlanLocation(planPath)

      yield* Api.Planner.Store.write(plan, planPath)

      const releaseCommand = workspace.config.operator.releaseCommand
      const done = Str.Builder()
      done`Plan written to ${Fs.Path.toString(planLocation.file)}`
      done`Run '${releaseCommand} prove${outPath ? ` --from ${outPath}` : ''}' to write plan-bound proof.`
      done`Run '${releaseCommand} rehearse${outPath ? ` --from ${outPath}` : ''}' to build exact artifacts.`
      done`Run '${releaseCommand} apply${outPath ? ` --from ${outPath}` : ''}' to execute.`
      yield* Console.log(done.render())
    }),
).pipe(
  Command.withDescription('Generate a release plan'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer, Git.GitLive)),
)
