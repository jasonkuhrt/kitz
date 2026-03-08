import { describe, expect, test } from 'vitest'
import {
  findBuildRuntimeTargets,
  isRuntimeTargetSourceOriented,
  rewriteRuntimeTargetsToBuild,
  rewriteRuntimeTargetsToSource,
} from './runtime-targets.js'

describe('Pkg.Manifest runtime targets', () => {
  test('rewrites runtime targets between source and build paths without touching types', () => {
    const source = {
      '.': {
        types: './build/_.d.ts',
        default: './src/_.ts',
      },
      './feature': {
        browser: './src/feature.browser.ts',
        default: './src/feature.node.ts',
      },
    }

    expect(rewriteRuntimeTargetsToBuild(source)).toEqual({
      '.': {
        types: './build/_.d.ts',
        default: './build/_.js',
      },
      './feature': {
        browser: './build/feature.browser.js',
        default: './build/feature.node.js',
      },
    })

    expect(
      rewriteRuntimeTargetsToSource({
        '.': {
          types: './build/_.d.ts',
          default: './build/_.js',
        },
      }),
    ).toEqual({
      '.': {
        types: './build/_.d.ts',
        default: './src/_.ts',
      },
    })
  })

  test('detects build-oriented runtime targets while ignoring types declarations', () => {
    const runtimeTargets = {
      '#pkg': {
        types: './build/_.d.ts',
        default: './build/_.js',
      },
      '#pkg/*': {
        browser: './src/*.browser.ts',
        default: './build/*.node.js',
      },
    }

    expect(findBuildRuntimeTargets(runtimeTargets)).toEqual(['./build/_.js', './build/*.node.js'])
    expect(isRuntimeTargetSourceOriented(runtimeTargets)).toBe(false)
    expect(
      isRuntimeTargetSourceOriented({
        '#pkg': {
          types: './build/_.d.ts',
          default: './src/_.ts',
        },
      }),
    ).toBe(true)
  })
})
