import { NodeFileSystem } from '@effect/platform-node'

export const loadRuntime = () => NodeFileSystem.layer
