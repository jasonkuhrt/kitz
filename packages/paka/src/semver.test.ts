import { Fs } from '@kitz/fs'
import { describe, expect, test } from 'vitest'
import { extractFromFiles } from './extractor/__.js'
import { analyzeSemverImpact } from './semver.js'

type Fixture = {
  readonly version?: string
  readonly exports?: Record<string, string>
  readonly root: string
  readonly files?: Record<string, string>
}

const createLayout = (fixture: Fixture): Fs.Builder.Layout => {
  let spec = Fs.Builder.spec('/pkg').file('package.json', {
    name: 'fixture-pkg',
    version: fixture.version ?? '1.0.0',
    exports: {
      '.': './src/__.js',
      ...(fixture.exports ?? {}),
    },
  })

  spec = spec.file('src/__.ts', fixture.root)

  for (const [path, content] of Object.entries(fixture.files ?? {})) {
    spec = spec.file(Fs.Path.RelFile.fromString(path), content)
  }

  return spec.toLayout()
}

const extractFixture = (fixture: Fixture) =>
  extractFromFiles({
    projectRoot: '/pkg',
    files: createLayout(fixture),
    extractorVersion: 'test',
  })

describe('analyzeSemverImpact', () => {
  test('returns no impact when the public interface is unchanged', () => {
    const previous = extractFixture({
      root: `
        export const greet = (name: string): string => \`hello \${name}\`
        export type Greeting = { readonly value: string }
      `,
    })
    const next = extractFixture({
      root: `
        export const greet = (name: string): string => \`hello \${name}\`
        export type Greeting = { readonly value: string }
      `,
    })

    const result = analyzeSemverImpact({ previous, next })

    expect(result.impact).toBe('none')
    expect(result.changes).toEqual([])
    expect(result.releaseBump).toBeUndefined()
  })

  test('classifies added exports as minor', () => {
    const previous = extractFixture({
      root: `export const greet = (name: string): string => \`hello \${name}\``,
    })
    const next = extractFixture({
      root: `
        export const greet = (name: string): string => \`hello \${name}\`
        export const part = (name: string): string => \`bye \${name}\`
      `,
    })

    const result = analyzeSemverImpact({ previous, next })

    expect(result.impact).toBe('minor')
    expect(result.changes).toMatchObject([
      {
        kind: 'export-added',
        impact: 'minor',
        selector: { entrypoint: '.', path: ['part'] },
      },
    ])
  })

  test('classifies removed exports as major', () => {
    const previous = extractFixture({
      root: `
        export const greet = (name: string): string => \`hello \${name}\`
        export const part = (name: string): string => \`bye \${name}\`
      `,
    })
    const next = extractFixture({
      root: `export const greet = (name: string): string => \`hello \${name}\``,
    })

    const result = analyzeSemverImpact({ previous, next })

    expect(result.impact).toBe('major')
    expect(result.changes).toMatchObject([
      {
        kind: 'export-removed',
        impact: 'major',
        selector: { entrypoint: '.', path: ['part'] },
      },
    ])
  })

  test('classifies changed signatures as major', () => {
    const previous = extractFixture({
      root: `export const parse = (value: string): number => Number.parseInt(value, 10)`,
    })
    const next = extractFixture({
      root: `export const parse = (value: number): string => value.toString()`,
    })

    const result = analyzeSemverImpact({ previous, next })

    expect(result.impact).toBe('major')
    expect(result.changes).toMatchObject([
      {
        kind: 'export-changed',
        impact: 'major',
        selector: { entrypoint: '.', path: ['parse'] },
      },
    ])
    expect(result.changes[0]?.previous?.signature).toContain('(value: string) => number')
    expect(result.changes[0]?.next?.signature).toContain('(value: number) => string')
  })

  test('classifies nested namespace additions as minor', () => {
    const previous = extractFixture({
      root: `export * as Math from './math/__.js'`,
      files: {
        'src/math/__.ts': `export const add = (left: number, right: number): number => left + right`,
      },
    })
    const next = extractFixture({
      root: `export * as Math from './math/__.js'`,
      files: {
        'src/math/__.ts': `
          export const add = (left: number, right: number): number => left + right
          export const subtract = (left: number, right: number): number => left - right
        `,
      },
    })

    const result = analyzeSemverImpact({ previous, next })

    expect(result.impact).toBe('minor')
    expect(result.changes).toMatchObject([
      {
        kind: 'export-added',
        impact: 'minor',
        selector: { entrypoint: '.', path: ['Math', 'subtract'] },
      },
    ])
  })

  test('handles namespace exports whose nested modules carry module docs', () => {
    const previous = extractFixture({
      root: `export * as Math from './math/__.js'`,
      files: {
        'src/math/__.ts': `
          /**
           * Math helpers.
           */
          export const add = (left: number, right: number): number => left + right
        `,
      },
    })
    const next = extractFixture({
      root: `export * as Math from './math/__.js'`,
      files: {
        'src/math/__.ts': `
          /**
           * Math helpers.
           */
          export const add = (left: number, right: number): number => left + right
        `,
      },
    })

    const result = analyzeSemverImpact({ previous, next })

    expect(result.impact).toBe('none')
    expect(result.changes).toEqual([])
  })

  test('classifies added entrypoints as minor', () => {
    const previous = extractFixture({
      root: `export const greet = (name: string): string => \`hello \${name}\``,
    })
    const next = extractFixture({
      root: `export const greet = (name: string): string => \`hello \${name}\``,
      exports: {
        './cli': './src/cli/__.js',
      },
      files: {
        'src/cli/__.ts': `export const run = (): void => undefined`,
      },
    })

    const result = analyzeSemverImpact({ previous, next })

    expect(result.impact).toBe('minor')
    expect(result.changes).toMatchObject([
      {
        kind: 'entrypoint-added',
        impact: 'minor',
        selector: { entrypoint: './cli', path: [] },
      },
    ])
  })

  test('maps impact through the initial-development release phase', () => {
    const previous = extractFixture({
      root: `export const parse = (value: string): number => Number.parseInt(value, 10)`,
    })
    const next = extractFixture({
      root: `export const parse = (value: number): string => value.toString()`,
    })

    const result = analyzeSemverImpact({
      previous,
      next,
      currentVersion: '0.5.0',
    })

    expect(result.impact).toBe('major')
    expect(result.releasePhase).toBe('initial')
    expect(result.releaseBump).toBe('minor')
    expect(result.nextVersion).toBe('0.6.0')
  })
})
