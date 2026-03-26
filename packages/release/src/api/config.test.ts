import { describe, expect, test } from 'vitest'
import { Config } from './config.js'

describe('release config package mappings', () => {
  test('supports explicit package path entries', () => {
    const config = Config.decodeSync({
      packages: {
        core: {
          name: '@kitz/core',
          path: './tooling/pkg-core/',
        },
      },
    })

    expect(config.packages).toEqual({
      core: {
        name: '@kitz/core',
        path: './tooling/pkg-core/',
      },
    })
  })

  test('keeps shorthand package-name entries ergonomic', () => {
    const config = Config.decodeSync({
      packages: {
        core: '@kitz/core',
      },
    })

    expect(config.packages).toEqual({
      core: '@kitz/core',
    })
  })
})
