import { Layer } from 'effect'
import { Platform } from '@kitz/platform'

export const FileSystemLayer = Platform.FileSystem.layer
export const ServicesLayer = Platform.Services.layer
export const TerminalLayer = Platform.Terminal.layer
export const ChildProcessSpawnerLayer = Platform.ChildProcessSpawner.layer.pipe(
  Layer.provide(Platform.FileSystem.layer),
  Layer.provide(Platform.Path.layer),
)
