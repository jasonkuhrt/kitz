import { Effect } from 'effect'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Config from '../../api/config.js'

export const noPackagesFoundMessage =
  'No packages found. Check release.config.ts `packages` field ' +
  'or ensure the root package.json defines workspace packages.'

export interface ReadyCommandWorkspace {
  readonly _tag: 'ReadyCommandWorkspace'
  readonly config: Config.ResolvedConfig
  readonly packages: readonly Analyzer.Workspace.Package[]
}

export interface EmptyCommandWorkspace {
  readonly _tag: 'EmptyCommandWorkspace'
  readonly config: Config.ResolvedConfig
}

export type CommandWorkspace = ReadyCommandWorkspace | EmptyCommandWorkspace

export const isReadyCommandWorkspace = (
  workspace: CommandWorkspace,
): workspace is ReadyCommandWorkspace => workspace._tag === 'ReadyCommandWorkspace'

export const loadCommandWorkspaceWith = <E, R>(
  loadConfig: Effect.Effect<Config.ResolvedConfig, E, R>,
) =>
  Effect.gen(function* () {
    const config = yield* loadConfig
    const packages = yield* Analyzer.Workspace.resolvePackages(config.packages)

    return packages.length === 0
      ? ({
          _tag: 'EmptyCommandWorkspace',
          config,
        } satisfies EmptyCommandWorkspace)
      : ({
          _tag: 'ReadyCommandWorkspace',
          config,
          packages,
        } satisfies ReadyCommandWorkspace)
  })

export const loadCommandWorkspace = (options?: Config.LoadOptions) =>
  loadCommandWorkspaceWith(Config.load(options))
