import { describe, expect, test } from 'vitest'
import {
  findBuildRuntimeTargets,
  isRuntimeTargetSourceOriented,
  rewriteRuntimeTargetsToBuild,
  rewriteRuntimeTargetsToSource,
} from './runtime-targets.js'

describe('Pkg.Manifest runtime targets', () => {
  test('rewrites runtime targets between source and build paths', () => {
    const source = {
      '.': './src/_.ts',
      './feature': {
        browser: './src/feature.browser.ts',
        default: './src/feature.node.ts',
      },
    }

    expect(rewriteRuntimeTargetsToBuild(source)).toEqual({
      '.': './build/_.js',
      './feature': {
        browser: './build/feature.browser.js',
        default: './build/feature.node.js',
      },
    })

    expect(
      rewriteRuntimeTargetsToSource({
        '.': './build/_.js',
      }),
    ).toEqual({ '.': './src/_.ts' })
  })

  test('detects build-oriented runtime targets', () => {
    const runtimeTargets = {
      '#pkg': './build/_.js',
      '#pkg/*': {
        browser: './src/*.browser.ts',
        default: './build/*.node.js',
      },
    }

    expect(findBuildRuntimeTargets(runtimeTargets)).toEqual(['./build/_.js', './build/*.node.js'])
    expect(isRuntimeTargetSourceOriented(runtimeTargets)).toBe(false)
    expect(isRuntimeTargetSourceOriented({ '#pkg': './src/_.ts' })).toBe(true)
  })

  test('rewrites nested arrays and leaves non-string leaves alone', () => {
    const targets = {
      '.': ['./src/_.ts', { browser: './src/feature.browser.ts', count: 2, active: true }],
      nullish: null,
    }

    expect(rewriteRuntimeTargetsToBuild(targets)).toEqual({
      '.': ['./build/_.js', { browser: './build/feature.browser.js', count: 2, active: true }],
      nullish: null,
    })

    expect(
      rewriteRuntimeTargetsToSource({
        '.': ['./build/_.js', { default: './build/feature.node.js', count: 2, active: true }],
        nullish: null,
      }),
    ).toEqual({
      '.': ['./src/_.ts', { default: './src/feature.node.ts', count: 2, active: true }],
      nullish: null,
    })

    expect(
      findBuildRuntimeTargets({
        '.': ['./build/_.js', { nested: './build/feature.node.js', ignored: false }],
      }),
    ).toEqual(['./build/_.js', './build/feature.node.js'])
  })
})
