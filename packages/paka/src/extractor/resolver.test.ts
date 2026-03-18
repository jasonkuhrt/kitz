import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { describe, expect, test } from 'vitest'
import { extract } from './extract.js'
import { getPublicExportTargets } from './resolver.js'

const writeFixture = (root: string, files: Record<string, string | Record<string, unknown>>) => {
  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = join(root, filePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(
      absolutePath,
      typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      'utf-8',
    )
  }
}

const withFixture = <T>(
  files: Record<string, string | Record<string, unknown>>,
  run: (root: string) => T,
): T => {
  const root = mkdtempSync(join(tmpdir(), 'paka-extract-'))
  try {
    writeFixture(root, files)
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('extractor resolver', () => {
  test('selects public ESM targets from conditional exports', () => {
    expect(
      getPublicExportTargets({
        '.': {
          types: './build/_.d.ts',
          import: './build/_.js',
          require: './build/_.cjs',
        },
        './feature': {
          node: {
            import: './build/feature/_.js',
            require: './build/feature/_.cjs',
          },
          default: './fallback/feature.js',
        },
        './blocked': null,
      }),
    ).toEqual({
      '.': './build/_.js',
      './feature': './build/feature/_.js',
    })
  })

  test('extract resolves conditional build exports back to source files without build output', () => {
    const model = withFixture(
      {
        'package.json': {
          name: 'fixture-pkg',
          type: 'module',
          exports: {
            '.': {
              types: './build/_.d.ts',
              import: './build/_.js',
            },
            './util': {
              import: './build/util/__.js',
            },
          },
        },
        'tsconfig.json': {
          compilerOptions: {
            rootDir: 'src',
            outDir: 'build',
          },
          include: ['src'],
        },
        'src/_.ts': `
          /** Root value */
          export const rootValue = 1
        `,
        'src/util/__.ts': `
          /** Util value */
          export const utilValue = 2
        `,
      },
      (projectRoot) => extract({ projectRoot }),
    )

    expect(model.entrypoints.map((entrypoint) => entrypoint.path).sort()).toEqual(['.', './util'])

    const rootEntrypoint = model.entrypoints.find((entrypoint) => entrypoint.path === '.')
    expect(rootEntrypoint?.module.exports.map((exp) => exp.name)).toContain('rootValue')

    const utilEntrypoint = model.entrypoints.find((entrypoint) => entrypoint.path === './util')
    expect(utilEntrypoint?.module.exports.map((exp) => exp.name)).toContain('utilValue')
  })

  test('extract follows package-export namespace re-exports through oxc resolution', () => {
    const model = withFixture(
      {
        'package.json': {
          name: 'fixture-pkg',
          type: 'module',
          exports: {
            '.': './src/_.ts',
          },
        },
        'tsconfig.json': {
          compilerOptions: {
            rootDir: 'src',
            outDir: 'build',
          },
          include: ['src'],
        },
        'src/_.ts': `
          export * as Feature from 'dep-package/feature'
        `,
        'node_modules/dep-package/package.json': {
          name: 'dep-package',
          type: 'module',
          exports: {
            './feature': {
              import: './src/feature.ts',
            },
          },
        },
        'node_modules/dep-package/src/feature.ts': `
          /** Dependency value */
          export const depValue = 1
        `,
      },
      (projectRoot) => extract({ projectRoot }),
    )

    const rootEntrypoint = model.entrypoints.find((entrypoint) => entrypoint.path === '.')
    const featureNamespace = rootEntrypoint?.module.exports.find((exp) => exp.name === 'Feature')

    expect(featureNamespace).toBeDefined()
    expect(featureNamespace?.type).toBe('namespace')

    if (!featureNamespace || featureNamespace.type !== 'namespace' || !featureNamespace.module) {
      throw new Error('Expected Feature namespace export')
    }

    expect(featureNamespace.module.exports.map((exp) => exp.name)).toContain('depValue')
  })
})
