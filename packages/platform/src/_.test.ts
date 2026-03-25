import { describe, expect, test } from 'vitest'
import * as PlatformModule from './_.js'
import * as PublicPlatform from './__.js'
import * as NodePlatform from './effect-platform.node.js'

describe('platform', () => {
  test('exports the Platform namespace', () => {
    expect(PlatformModule.Platform.Runtime).toBe(PublicPlatform.Runtime)
  })

  test('re-exports the node runtime implementation used by Vitest', () => {
    expect(NodePlatform.Runtime).toBeDefined()
    expect(NodePlatform.FileSystem).toBeDefined()
  })
})
