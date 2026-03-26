import { Effect } from 'effect'
import * as Api from '../../api/__.js'

export const noPackagesFoundMessage =
  'No packages found. Check release.config.ts `packages` field ' +
  'or ensure the root package.json defines workspace packages.'

export interface ReadyCommandWorkspace {
  readonly _tag: 'ReadyCommandWorkspace'
  readonly config: Api.Config.ResolvedConfig
  readonly packages: readonly Api.Analyzer.Workspace.Package[]
}

export interface EmptyCommandWorkspace {
  readonly _tag: 'EmptyCommandWorkspace'
  readonly config: Api.Config.ResolvedConfig
}

export type CommandWorkspace = ReadyCommandWorkspace | EmptyCommandWorkspace

export const isReadyCommandWorkspace = (
  workspace: CommandWorkspace,
): workspace is ReadyCommandWorkspace => workspace._tag === 'ReadyCommandWorkspace'

export const loadCommandWorkspaceWith = <E, R>(
  loadConfig: Effect.Effect<Api.Config.ResolvedConfig, E, R>,
) =>
  Effect.gen(function* () {
    const config = yield* loadConfig
    const packages = yield* Api.Analyzer.Workspace.resolvePackages(config.packages)

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

export const loadCommandWorkspace = (options?: Api.Config.LoadOptions) =>
  loadCommandWorkspaceWith(Api.Config.load(options))
