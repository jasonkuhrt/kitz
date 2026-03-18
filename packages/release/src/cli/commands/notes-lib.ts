import { Effect } from 'effect'
import * as Api from '../../api/__.js'

type NotesConfig = Pick<Api.Config.ResolvedConfig, 'packages'>

export const resolveNotesPackages = (configPackages: Api.Analyzer.Workspace.PackageMap) =>
  Effect.gen(function* () {
    return yield* Api.Analyzer.Workspace.resolvePackages(configPackages)
  })

export const loadNotesPackagesWith = <E, R>(loadConfig: Effect.Effect<NotesConfig, E, R>) =>
  Effect.gen(function* () {
    const config = yield* loadConfig
    return yield* resolveNotesPackages(config.packages)
  })

export const loadNotesPackages = loadNotesPackagesWith(Api.Config.load())
