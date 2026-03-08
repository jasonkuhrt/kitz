import { Layer } from 'effect'
import { Platform } from '@kitz/platform'

export const FileSystemLayer = Platform.FileSystem.layer
export const ContextLayer = Platform.Context.layer
export const TerminalLayer = Platform.Terminal.layer
export const CommandExecutorLayer = Platform.CommandExecutor.layer.pipe(
  Layer.provide(Platform.FileSystem.layer),
)
