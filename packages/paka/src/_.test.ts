import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Schema as S } from 'effect'
import { Fs } from '@kitz/fs'
import { IndentationText, Project } from 'ts-morph'
import { describe, expect, test } from 'vitest'
import * as PakaNamespace from './_.js'
import * as Paka from './__.js'
import { extractH1Sections, extractH2Subsections, parseMarkdown, toMarkdown, toPlainText } from './extractor/markdown.js'
import { parseHomePage } from './extractor/home-page.js'
import { extract, extractFromFiles } from './extractor/extract.js'
import { absoluteToRelative, createBuildToSourcePath } from './extractor/path-utils.js'
import { categorize } from './extractor/nodes/categorize.js'
import { extractExport } from './extractor/nodes/export.js'
import { extractModule, extractModuleFromFile } from './extractor/nodes/module.js'
import { extractSignature, extractSimpleSignature } from './extractor/nodes/tsmorph-utils.js'
import { markdownToJsDoc } from './md-to-jsdoc.js'
import { generateSidebar } from './adaptors/vitepress.js'
import { addMethodNameHighlights, addTwoslashAnnotations } from './transformers.js'

const relFile = (path: string) => S.decodeSync(Fs.Path.RelFile.Schema)(path)

const sourceLocation = (file: string, line: number) =>
  Paka.SourceLocation.make({
    file: relFile(file),
    line,
  })

describe('paka', () => {
  test('re-exports package surface and schema helpers', () => {
    expect(PakaNamespace.Paka.markdownToJsDoc).toBe(Paka.markdownToJsDoc)
    expect(PakaNamespace.Paka.Extractor.extract).toBe(Paka.Extractor.extract)
    expect(Paka.Example.make({ code: `x`, twoslashEnabled: true, language: `ts` })).toMatchObject({
      code: `x`,
      twoslashEnabled: true,
      language: `ts`,
    })
    expect(Paka.Feature.make({ title: `Fast`, body: `Great docs` })).toMatchObject({
      title: `Fast`,
      body: `Great docs`,
    })
    expect(
      Paka.Home.make({
        hero: { name: `Paka`, text: `Parser`, tagline: `Docs` },
      }),
    ).toMatchObject({
      hero: { name: `Paka` },
    })
  })

  test('transforms build paths and absolute paths', () => {
    const withConfig = createBuildToSourcePath({
      outDir: `/repo/build`,
      rootDir: `/repo/src`,
      projectRoot: `/repo`,
    })
    expect(withConfig(`./build/arr/__.js`)).toBe(`./src/arr/__.ts`)

    const withoutConfig = createBuildToSourcePath()
    expect(withoutConfig(`./src/arr/__.js`)).toBe(`./src/arr/__.ts`)

    expect(absoluteToRelative(`${process.cwd()}/src/index.ts`)).toBe(`src/index.ts`)
    expect(absoluteToRelative(`/src/index.ts`)).toBe(`src/index.ts`)
    expect(absoluteToRelative(`relative/already.ts`)).toBe(`relative/already.ts`)
  })

  test('parses markdown sections and homepage structures', () => {
    const markdown = `
Intro summary.

# Hero

## Name

Paka

## Text

Ship docs fast.

# Highlights

## Fast

Uses extracted API models.

## Safe

Validates page structure.

# Body

## Overview

Detailed body copy.

## Exports

Generated export listing.
`.trim()

    const ast = parseMarkdown(markdown)
    const sections = extractH1Sections(ast)

    expect(Array.from(sections.keys())).toEqual([`Hero`, `Highlights`, `Body`])
    expect(toPlainText(sections.get(`Hero`) ?? [])).toContain(`Paka`)
    expect(toMarkdown(sections.get(`Highlights`) ?? [])).toContain(`## Fast`)

    const highlights = extractH2Subsections(sections.get(`Highlights`) ?? [])
    expect(highlights).toEqual([
      { heading: `Fast`, content: highlights[0]!.content },
      { heading: `Safe`, content: highlights[1]!.content },
    ])

    const home = parseHomePage(markdown, `docs/home.md`)
    expect(home.hero).toMatchObject({
      name: `Paka`,
      text: `Ship docs fast.`,
    })
    expect(home.highlights).toHaveLength(2)
    expect(home.body).toEqual([
      {
        _tag: `content`,
        title: `Overview`,
        body: `Detailed body copy.`,
      },
      {
        _tag: `exports`,
      },
    ])

    expect(() =>
      extractH1Sections(parseMarkdown(`# Hero\nA\n# Hero\nB`)),
    ).toThrow(`Duplicate section '# Hero' found`)
    expect(() => parseHomePage(`# Unknown\nNope`, `docs/home.md`)).toThrow(`Allowed top-level headings`)
    expect(() => parseHomePage(`# Hero\n## Nope\nBad`, `docs/home.md`)).toThrow(`Allowed subheadings`)
  })

  test('converts markdown guides to generated JSDoc', () => {
    const jsdoc = markdownToJsDoc(
      `
Summary line.

# Description

This module does useful things.

# Remarks

Extra implementation detail.

# Example

## Basic

\`\`\`ts
Arr.ensure(items)
\`\`\`

# See Also

[API Reference](https://example.com/api)
      `.trim(),
      {
        moduleName: `@kitz/paka`,
        generatorPath: { toString: () => `./tools/generate.ts` } as any,
      },
    )

    expect(jsdoc).toContain(`GENERATED FILE - DO NOT EDIT MANUALLY`)
    expect(jsdoc).toContain(`@module @kitz/paka`)
    expect(jsdoc).toContain(`@description`)
    expect(jsdoc).toContain(`@remarks`)
    expect(jsdoc).toContain(`@example Basic`)
    expect(jsdoc).toContain(`@see`)
    expect(jsdoc).toContain(`https://example.com/api`)
  })

  test('adds twoslash method annotations without duplicating nested property highlights', () => {
    const code = `
const ensured = Arr.ensure(items)
const value = Foo.Bar.baz()
    `.trim()

    const annotated = addTwoslashAnnotations(code)
    expect(annotated).toContain(`// [!code word:ensure:1]`)
    expect(annotated).toContain(`// [!code word:baz:1]`)
    expect(annotated).not.toContain(`// [!code word:Bar:1]`)

    const preAnnotatedCode = `
// [!code word:ensure:1]
const ensured = Arr.ensure(items)
const value = Foo.Bar.baz()
    `.trim()
    const project = new Project({
      useInMemoryFileSystem: true,
      manipulationSettings: {
        indentationText: IndentationText.TwoSpaces,
      },
    })
    const sourceFile = project.createSourceFile(`sample.ts`, preAnnotatedCode)
    const lines = preAnnotatedCode.split(`\n`)
    const modifications = addMethodNameHighlights(lines, sourceFile)

    expect(modifications.some((mod) => mod.text.includes(`ensure`))).toBe(false)
    expect(modifications.some((mod) => mod.text.includes(`baz`))).toBe(true)
  })

  test('analyzes declaration categories, signatures, and nested module structures', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), `paka-nodes-`))

    try {
      writeFileSync(
        join(fixtureDir, `main.ts`),
        `
/**
 * Main module description.
 * @guide Prefer the markdown guide.
 * @category Top
 */
export * as Wrapped from './wrapped.js'
export * from './wildcard.js'

/** A function export. */
export function fn<T extends string = 'x'>(value: T = 'x' as T): number {
  return value.length
}

/** Arrow function export. */
export const arrow = (value: number) => value + 1

/** Plain data export. */
export const data = 1

/** @namespace */
export const RuntimeObject = { value: 1 }

/** @builder */
export function createBuilder(): Builder {
  return {} as Builder
}

export interface Builder {
  chain(value: string): Builder
  done(): void
  toOther(): OtherBuilder
}

export interface OtherBuilder {
  finish(): void
}

export class Greeter {
  /** name */
  readonly name?: string

  constructor(name?: string) {
    this.name = name
  }

  /** greet */
  greet(times: number): string {
    return (this.name ?? 'hi').repeat(times)
  }

  static create(name: string): Greeter {
    return new Greeter(name)
  }
}

export interface Shape {
  value: string
}

export type Choice = 'a' | 'b'
export type Combo = { a: 1 } & { b: 2 }
export type Alias = string

export enum Status {
  Ready = 'ready',
}

export namespace Local {
  /** Nested value. */
  export const value = 1
}

export const withSimple = ((value: number) => value) as ((value: number) => number) & {
  __simpleSignature: (value: string) => string
}

/** @internal */
export const hidden = 2
        `.trim(),
      )
      writeFileSync(join(fixtureDir, `main.md`), `# Description\n\nGuide from markdown.\n`)
      writeFileSync(
        join(fixtureDir, `wrapped.ts`),
        `
export * as Thing from './thing.js'
        `.trim(),
      )
      writeFileSync(join(fixtureDir, `wrapped.md`), `# Description\n\nWrapper markdown.\n`)
      writeFileSync(
        join(fixtureDir, `thing.ts`),
        `
/** Thing namespace. */
export const item = 'thing'
        `.trim(),
      )
      writeFileSync(
        join(fixtureDir, `thing.home.md`),
        `
# Hero

## Name

Thing

# Body

## Exports

Thing exports here.
        `.trim(),
      )
      writeFileSync(
        join(fixtureDir, `wildcard.ts`),
        `
export * as Nested from './nested.js'
        `.trim(),
      )
      writeFileSync(
        join(fixtureDir, `nested.ts`),
        `
/** Nested namespace. */
export const nestedValue = true
        `.trim(),
      )

      const project = new Project({
        useInMemoryFileSystem: false,
      })
      project.addSourceFilesAtPaths(join(fixtureDir, `*.ts`))

      const sourceFile = project.getSourceFileOrThrow(join(fixtureDir, `main.ts`))
      const exported = sourceFile.getExportedDeclarations()

      const fnDecl = exported.get(`fn`)?.[0]
      const arrowDecl = exported.get(`arrow`)?.[0]
      const dataDecl = exported.get(`data`)?.[0]
      const runtimeDecl = exported.get(`RuntimeObject`)?.[0]
      const builderDecl = exported.get(`createBuilder`)?.[0]
      const classDecl = exported.get(`Greeter`)?.[0]
      const interfaceDecl = exported.get(`Shape`)?.[0]
      const unionDecl = exported.get(`Choice`)?.[0]
      const intersectionDecl = exported.get(`Combo`)?.[0]
      const aliasDecl = exported.get(`Alias`)?.[0]
      const enumDecl = exported.get(`Status`)?.[0]
      const namespaceDecl = exported.get(`Local`)?.[0]
      const simpleDecl = exported.get(`withSimple`)?.[0]

      expect(fnDecl && categorize(fnDecl)).toEqual({ level: `value`, type: `function` })
      expect(arrowDecl && categorize(arrowDecl)).toEqual({ level: `value`, type: `function` })
      expect(dataDecl && categorize(dataDecl)).toEqual({ level: `value`, type: `const` })
      expect(classDecl && categorize(classDecl)).toEqual({ level: `value`, type: `class` })
      expect(interfaceDecl && categorize(interfaceDecl)).toEqual({ level: `type`, type: `interface` })
      expect(unionDecl && categorize(unionDecl)).toEqual({ level: `type`, type: `union` })
      expect(intersectionDecl && categorize(intersectionDecl)).toEqual({ level: `type`, type: `intersection` })
      expect(aliasDecl && categorize(aliasDecl)).toEqual({ level: `type`, type: `type-alias` })
      expect(enumDecl && categorize(enumDecl)).toEqual({ level: `type`, type: `enum` })
      expect(namespaceDecl && categorize(namespaceDecl)).toEqual({ level: `value`, type: `namespace` })

      const builderSignature = builderDecl && extractSignature(builderDecl)
      expect(builderSignature?._tag).toBe(`BuilderSignatureModel`)

      const classSignature = classDecl && extractSignature(classDecl)
      expect(classSignature?._tag).toBe(`ClassSignatureModel`)

      const runtimeExport = runtimeDecl && extractExport(`RuntimeObject`, runtimeDecl)
      expect(runtimeExport?._tag).toBe(`value`)
      expect(runtimeExport?.type).toBe(`const`)

      const simpleSignature = simpleDecl && extractSimpleSignature(simpleDecl)
      expect(simpleSignature?._tag).toBe(`FunctionSignatureModel`)

      const location = S.decodeSync(Fs.Path.RelFile.Schema)(`./main.ts`)
      const module = extractModuleFromFile(sourceFile, location, {
        filterInternal: true,
        filterUnderscoreExports: true,
      })

      expect(module.docs?.guide).toContain(`Guide from markdown.`)
      expect(module.exports.some((entry) => entry.name === `hidden`)).toBe(false)
      expect(module.exports.some((entry) => entry.name === `Wrapped`)).toBe(true)
      expect(module.exports.some((entry) => entry.name === `Nested`)).toBe(true)

      const localNamespace = sourceFile.getModuleOrThrow(`Local`)
      const namespaceModule = extractModule(
        localNamespace,
        S.decodeSync(Fs.Path.RelFile.Schema)(`./main.ts`),
        { filterInternal: true },
      )

      expect(namespaceModule.exports.some((entry) => entry.name === `value`)).toBe(true)
      expect(namespaceModule.docs).toBeUndefined()
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  test('extracts a real fixture package and generates vitepress docs', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), `paka-fixture-`))
    const originalCwd = process.cwd()

    try {
      mkdirSync(join(fixtureDir, `src`, `utils`), { recursive: true })
      mkdirSync(join(fixtureDir, `build`, `exports`), { recursive: true })

      writeFileSync(
        join(fixtureDir, `package.json`),
        JSON.stringify(
          {
            name: `@example/paka-fixture`,
            version: `1.0.0`,
            exports: {
              '.': `./build/index.js`,
              './utils': `./build/utils/__.js`,
            },
          },
          null,
          2,
        ),
      )
      writeFileSync(
        join(fixtureDir, `tsconfig.build.json`),
        JSON.stringify(
          {
            compilerOptions: {
              rootDir: `./src`,
              outDir: `./build`,
              target: `ESNext`,
              module: `ESNext`,
              moduleResolution: `Bundler`,
            },
          },
          null,
          2,
        ),
      )
      writeFileSync(join(fixtureDir, `build`, `exports`, `index.js`), `export * from "#utils"\n`)
      writeFileSync(
        join(fixtureDir, `src`, `index.ts`),
        `
/**
 * Root namespace wrapper.
 * @category Root
 */
export * as Utils from './utils/__.js'

/** Namespace wrapper docs. */
export namespace Utils {}
        `.trim(),
      )
      writeFileSync(
        join(fixtureDir, `src`, `utils`, `__.ts`),
        `
/**
 * Utility exports.
 */
export const visible = 1

/**
 * Count characters.
 *
 * @example Demo
 * \`\`\`ts
 * doThing('ok')
 * \`\`\`
 * @param value Value to count
 * @returns Character count
 * @throws When value is empty
 */
export function doThing(value: string): number {
  if (value.length === 0) throw new Error('empty')
  return value.length
}

/** @internal */
export const hidden = 2
        `.trim(),
      )
      writeFileSync(
        join(fixtureDir, `src`, `utils`, `README.md`),
        `
# Description

Utilities for fixture extraction.

# Remarks

Used in tests.
        `.trim(),
      )
      writeFileSync(
        join(fixtureDir, `src`, `utils.home.md`),
        `
# Hero

## Name

Utils

# Body

## Exports

Generated exports here.
        `.trim(),
      )

      const model = extract({
        projectRoot: fixtureDir,
        entrypoints: [`.`, `./utils`],
      })

      expect(model.name).toBe(`@example/paka-fixture`)
      expect(model.entrypoints).toHaveLength(2)
      expect(model.entrypoints[0]?.path).toBe(`.`)
      expect(model.entrypoints[1]?.path).toBe(`./utils`)
      expect(model.entrypoints[1]?.module.exports.some((entry) => entry.name === `visible`)).toBe(true)
      expect(model.entrypoints[1]?.module.exports.some((entry) => entry.name === `hidden`)).toBe(false)

      const files = {
        [join(fixtureDir, `package.json`)]: readFileSync(join(fixtureDir, `package.json`), `utf8`),
        [join(fixtureDir, `tsconfig.build.json`)]: readFileSync(join(fixtureDir, `tsconfig.build.json`), `utf8`),
        [join(fixtureDir, `src`, `index.ts`)]: readFileSync(join(fixtureDir, `src`, `index.ts`), `utf8`),
        [join(fixtureDir, `src`, `utils`, `__.ts`)]: readFileSync(
          join(fixtureDir, `src`, `utils`, `__.ts`),
          `utf8`,
        ),
      }
      const inMemoryModel = extractFromFiles({
        projectRoot: fixtureDir,
        files,
        entrypoints: [`.`, `./utils`],
      })
      expect(inMemoryModel.entrypoints).toHaveLength(2)

      process.chdir(fixtureDir)
      const outputDir = join(fixtureDir, `docs`)
      Paka.Adaptors.VitePress.generate(model, {
        outputDir,
        githubUrl: `https://github.com/example/paka-fixture`,
      })

      const sidebar = readFileSync(join(outputDir, `.generated`, `sidebar.ts`), `utf8`)
      const apiIndex = readFileSync(join(outputDir, `api`, `index.md`), `utf8`)
      const rootPage = readFileSync(join(outputDir, `api`, `utils.md`), `utf8`)

      expect(sidebar).toContain(`/api/utils`)
      expect(apiIndex).toContain(`@example/paka-fixture`)
      expect(rootPage).toContain(`visible`)
      expect(rootPage).toContain(`doThing`)
    } finally {
      process.chdir(originalCwd)
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  test('renders schema-driven vitepress docs across wrapper, guide, and landing layouts', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), `paka-vitepress-`))
    const originalCwd = process.cwd()

    try {
      const makeFunctionSignature = (options = {}) =>
        Paka.FunctionSignature.make({
          typeParameters: [],
          parameters: [],
          returnType: `void`,
          throws: [],
          ...options,
        })

      const nestedLeafModule = Paka.Module.make({
        location: relFile(`src/test/__.ts`),
        exports: [
          Paka.ValueExport.make({
            name: `leafValue`,
            signature: Paka.ValueSignatureModel.make({ type: `number` }),
            docs: Paka.Docs.make({ description: `Leaf value.` }),
            examples: [],
            tags: {},
            sourceLocation: sourceLocation(`src/test/__.ts`, 4),
            type: `const`,
          }),
        ],
      })

      const wrapperModule = Paka.Module.make({
        location: relFile(`src/test/$.ts`),
        exports: [
          Paka.ValueExport.make({
            name: `Test`,
            signature: Paka.ValueSignatureModel.make({ type: `typeof Test` }),
            docs: Paka.Docs.make({ description: `Wrapper namespace.` }),
            examples: [],
            tags: {},
            sourceLocation: sourceLocation(`src/test/$.ts`, 2),
            type: `namespace`,
            module: nestedLeafModule,
          }),
        ],
      })

      const nestedNamespaceModule = Paka.Module.make({
        location: relFile(`src/feature-tools/nested.ts`),
        docs: Paka.ModuleDocs.make({ description: `Nested module docs.` }),
        exports: [
          Paka.ValueExport.make({
            name: `nestedValue`,
            signature: Paka.ValueSignatureModel.make({ type: `boolean` }),
            docs: Paka.Docs.make({ description: `Nested value.` }),
            examples: [],
            tags: {},
            sourceLocation: sourceLocation(`src/feature-tools/nested.ts`, 5),
            type: `const`,
          }),
          Paka.ValueExport.make({
            name: `Deeper`,
            signature: Paka.ValueSignatureModel.make({ type: `typeof Deeper` }),
            docs: Paka.Docs.make({ description: `Deeper namespace.` }),
            examples: [],
            tags: {},
            sourceLocation: sourceLocation(`src/feature-tools/nested.ts`, 9),
            type: `namespace`,
            module: Paka.Module.make({
              location: relFile(`src/feature-tools/deeper.ts`),
              exports: [
                Paka.ValueExport.make({
                  name: `deepValue`,
                  signature: Paka.ValueSignatureModel.make({ type: `string` }),
                  docs: Paka.Docs.make({ description: `Deep value.` }),
                  examples: [],
                  tags: {},
                  sourceLocation: sourceLocation(`src/feature-tools/deeper.ts`, 3),
                  type: `const`,
                }),
              ],
            }),
          }),
        ],
      })

      const formatValue = Paka.ValueExport.make({
        name: `formatValue`,
        signature: Paka.FunctionSignatureModel.make({
          overloads: [
            makeFunctionSignature({
              typeParameters: [
                Paka.TypeParameter.make({
                  name: `T`,
                  constraint: `string`,
                  default: `'x'`,
                }),
              ],
              parameters: [
                Paka.Parameter.make({
                  name: `value`,
                  type: `T`,
                  optional: false,
                  rest: false,
                  description: `Value to format`,
                }),
              ],
              returnType: `string`,
              returnDoc: `Formatted output`,
              throws: [`When formatting fails`],
            }),
          ],
        }),
        docs: Paka.Docs.make({
          description: `Formats <value> safely with \`Map<T>\`  - bullet item`,
          guide: `## Details\n\nUse [\`formatValue\`](#) carefully.`,
        }),
        examples: [
          Paka.Example.make({
            title: `Basic`,
            code: `formatValue(value)`,
            twoslashEnabled: true,
            language: `ts`,
          }),
        ],
        category: `Utilities`,
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 10),
        type: `function`,
      })

      const createBuilder = Paka.ValueExport.make({
        name: `createBuilder`,
        signature: Paka.BuilderSignatureModel.make({
          typeName: `Builder`,
          entryPoint: makeFunctionSignature({
            parameters: [
              Paka.Parameter.make({
                name: `seed`,
                type: `string`,
                optional: false,
                rest: false,
                description: `Seed value`,
              }),
            ],
            returnType: `Builder`,
            returnDoc: `Configured builder`,
            throws: [`When the seed is empty`],
          }),
          chainableMethods: [
            Paka.BuilderMethod.make({
              name: `withPrefix`,
              overloads: [
                makeFunctionSignature({
                  typeParameters: [Paka.TypeParameter.make({ name: `R`, constraint: `string` })],
                  parameters: [
                    Paka.Parameter.make({
                      name: `prefix`,
                      type: `R`,
                      optional: false,
                      rest: false,
                    }),
                  ],
                  returnType: `Builder`,
                }),
              ],
              category: `chainable`,
            }),
          ],
          terminalMethods: [
            Paka.BuilderMethod.make({
              name: `done`,
              overloads: [makeFunctionSignature({ returnType: `void` })],
              category: `terminal`,
            }),
          ],
          transformMethods: [
            Paka.BuilderMethod.make({
              name: `toRunner`,
              overloads: [makeFunctionSignature({ returnType: `Runner` })],
              category: `transform`,
              transformsTo: `Runner`,
            }),
          ],
        }),
        signatureSimple: Paka.FunctionSignatureModel.make({
          overloads: [makeFunctionSignature({ returnType: `Builder` })],
        }),
        docs: Paka.Docs.make({ description: `Builder entrypoint.` }),
        examples: [],
        category: `Builders`,
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 20),
        type: `function`,
      })

      const defaultFlag = Paka.ValueExport.make({
        name: `defaultFlag`,
        signature: Paka.ValueSignatureModel.make({ type: `boolean` }),
        docs: Paka.Docs.make({ description: `Default flag value.` }),
        examples: [
          Paka.Example.make({
            title: `Imported`,
            code: `import { defaultFlag } from '@example/ui/feature-tools'\nconsole.log(defaultFlag)`,
            twoslashEnabled: true,
            language: `ts`,
          }),
        ],
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 30),
        type: `const`,
      })

      const worker = Paka.ValueExport.make({
        name: `Worker`,
        signature: Paka.ClassSignatureModel.make({
          ctor: makeFunctionSignature({
            parameters: [
              Paka.Parameter.make({
                name: `id`,
                type: `string`,
                optional: false,
                rest: false,
                description: `Worker identifier`,
              }),
            ],
            returnType: `Worker`,
            throws: [`When worker creation fails`],
          }),
          properties: [
            Paka.ClassProperty.make({
              name: `id`,
              type: `string`,
              optional: false,
              readonly: true,
              static: false,
              description: `Stable identifier`,
            }),
            Paka.ClassProperty.make({
              name: `count`,
              type: `number`,
              optional: false,
              readonly: false,
              static: true,
            }),
          ],
          methods: [
            Paka.ClassMethod.make({
              name: `run`,
              overloads: [makeFunctionSignature({ returnType: `Promise<void>` })],
              static: false,
            }),
            Paka.ClassMethod.make({
              name: `create`,
              overloads: [makeFunctionSignature({ returnType: `Worker` })],
              static: true,
            }),
          ],
        }),
        docs: Paka.Docs.make({ description: `Worker class.` }),
        examples: [],
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 40),
        type: `class`,
      })

      const configType = Paka.TypeExport.make({
        name: `Config`,
        signature: Paka.TypeSignatureModel.make({ text: `{ enabled: boolean }` }),
        docs: Paka.Docs.make({ description: `Configuration shape.` }),
        examples: [],
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 50),
        type: `interface`,
      })

      const modeType = Paka.TypeExport.make({
        name: `Mode`,
        signature: Paka.TypeSignatureModel.make({ text: `'dev' | 'prod'` }),
        examples: [],
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 52),
        type: `type-alias`,
      })

      const statusType = Paka.TypeExport.make({
        name: `Status`,
        signature: Paka.TypeSignatureModel.make({ text: `enum Status { Ready }` }),
        examples: [],
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 54),
        type: `enum`,
      })

      const choiceType = Paka.TypeExport.make({
        name: `Choice`,
        signature: Paka.TypeSignatureModel.make({ text: `'a' | 'b'` }),
        examples: [],
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 56),
        type: `union`,
      })

      const combinedType = Paka.TypeExport.make({
        name: `Combined`,
        signature: Paka.TypeSignatureModel.make({ text: `{ a: 1 } & { b: 2 }` }),
        examples: [],
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 58),
        type: `intersection`,
      })

      const nestedNamespace = Paka.ValueExport.make({
        name: `Nested`,
        signature: Paka.ValueSignatureModel.make({ type: `typeof Nested` }),
        docs: Paka.Docs.make({ description: `Nested namespace docs.` }),
        examples: [],
        category: `Utilities`,
        tags: {},
        sourceLocation: sourceLocation(`src/feature-tools.ts`, 60),
        type: `namespace`,
        module: nestedNamespaceModule,
      })

      const featureModule = Paka.Module.make({
        location: relFile(`src/feature-tools.ts`),
        docs: Paka.ModuleDocs.make({
          description: `Feature docs.`,
          guide: `Extended feature guide.`,
        }),
        exports: [
          formatValue,
          createBuilder,
          defaultFlag,
          worker,
          configType,
          modeType,
          statusType,
          choiceType,
          combinedType,
          nestedNamespace,
        ],
      })

      const guideModule = Paka.Module.make({
        location: relFile(`src/guide.ts`),
        docs: Paka.ModuleDocs.make({
          description: `Guide overview.`,
          guide: `Guide walkthrough.`,
        }),
        docsProvenance: Paka.DocsProvenance.make({
          description: Paka.MdFileProvenance.make({
            filePath: relFile(`src/guide/README.md`),
          }),
        }),
        exports: [
          Paka.ValueExport.make({
            name: `guideFn`,
            signature: Paka.FunctionSignatureModel.make({
              overloads: [makeFunctionSignature({ returnType: `void` })],
            }),
            docs: Paka.Docs.make({ description: `Guide helper.` }),
            examples: [],
            tags: {},
            sourceLocation: sourceLocation(`src/guide.ts`, 7),
            type: `function`,
          }),
        ],
      })

      const landingModule = Paka.Module.make({
        location: relFile(`src/landing-page.ts`),
        docs: Paka.ModuleDocs.make({
          home: Paka.Home.make({
            hero: {
              name: `Landing`,
              text: `Ship docs fast`,
              tagline: `Generated by tests`,
            },
            highlights: [Paka.Feature.make({ title: `Fast`, body: `Quick to render.` })],
            body: [
              { _tag: `content`, title: `Overview`, body: `Landing overview.` },
              { _tag: `exports` },
            ],
          }),
        }),
        exports: [
          Paka.ValueExport.make({
            name: `launch`,
            signature: Paka.FunctionSignatureModel.make({
              overloads: [makeFunctionSignature({ returnType: `void` })],
            }),
            docs: Paka.Docs.make({ description: `Launch the docs.` }),
            examples: [],
            tags: {},
            sourceLocation: sourceLocation(`src/landing-page.ts`, 6),
            type: `function`,
          }),
        ],
      })

      const testEntrypoint = Paka.DrillableNamespaceEntrypoint.make({
        path: `./test`,
        module: wrapperModule,
      })
      const featureEntrypoint = Paka.SimpleEntrypoint.make({
        path: `./feature-tools`,
        module: featureModule,
      })
      const guideEntrypoint = Paka.SimpleEntrypoint.make({
        path: `./guide`,
        module: guideModule,
      })
      const landingEntrypoint = Paka.SimpleEntrypoint.make({
        path: `./landing-page`,
        module: landingModule,
      })

      const model = Paka.Package.make({
        name: `@example/ui`,
        version: `1.0.0`,
        entrypoints: [testEntrypoint, featureEntrypoint, guideEntrypoint, landingEntrypoint],
        metadata: Paka.PackageMetadata.make({
          extractedAt: new Date(`2026-01-01T00:00:00.000Z`),
          extractorVersion: `1.2.3`,
        }),
      })

      expect(Paka.ValueExport.is(formatValue)).toBe(true)
      expect(Paka.TypeExport.is(configType)).toBe(true)
      expect(featureModule.namespaceExports.map((entry) => entry.name)).toEqual([`Nested`])
      expect(featureModule.functionExports.map((entry) => entry.name)).toEqual([
        `formatValue`,
        `createBuilder`,
      ])
      expect(featureModule.constantExports.map((entry) => entry.name)).toEqual([`defaultFlag`])
      expect(featureModule.classExports.map((entry) => entry.name)).toEqual([`Worker`])
      expect(featureModule.typeExports.map((entry) => entry.name)).toEqual([
        `Config`,
        `Mode`,
        `Status`,
        `Choice`,
        `Combined`,
      ])
      expect(featureModule.regularExports).toHaveLength(9)
      expect(featureModule.hasCategories).toBe(true)
      expect(guideModule.hasExternalReadme).toBe(true)
      expect(formatValue.typeIcon).toBe(`F`)
      expect(defaultFlag.typeIcon).toBe(`C`)
      expect(worker.typeIcon).toBe(`Class`)
      expect(nestedNamespace.typeIcon).toBe(`NS`)
      expect(configType.typeIcon).toBe(`I`)
      expect(modeType.typeIcon).toBe(`T`)
      expect(statusType.typeIcon).toBe(`E`)
      expect(choiceType.typeIcon).toBe(`U`)
      expect(combinedType.typeIcon).toBe(`∩`)
      expect(featureEntrypoint.moduleName).toBe(`FeatureTools`)
      expect(featureEntrypoint.kebabName).toBe(`feature-tools`)
      expect(featureEntrypoint.getImportExamples(`@example/ui`, featureEntrypoint.path)[0]?.content).toBe(
        `import * as FeatureTools from '@example/ui/feature-tools'`,
      )
      expect(testEntrypoint.getImportExamples(`@example/ui`, [])).toEqual([])
      expect(testEntrypoint.getImportExamples(`@example/ui`, [`Test`])).toEqual([
        Paka.ImportExample.make({
          label: `Namespace`,
          content: `import { Test } from '@example/ui'`,
        }),
        Paka.ImportExample.make({
          label: `Barrel`,
          content: `import * as Test from '@example/ui/test'`,
        }),
      ])
      expect(testEntrypoint.getImportExamples(`@example/ui`, [`Test`, `Leaf`])[1]?.content).toBe(
        `import { Leaf } from '@example/ui/test'`,
      )

      process.chdir(fixtureDir)
      const fallbackSidebar = generateSidebar(model)
      expect(fallbackSidebar).toHaveLength(1)
      expect(fallbackSidebar[0]?.items).toHaveLength(4)

      mkdirSync(join(fixtureDir, `build`, `exports`), { recursive: true })
      writeFileSync(
        join(fixtureDir, `build`, `exports`, `index.js`),
        `export * from "#test"\nexport * from "#landing-page"\n`,
      )

      const outputDir = join(fixtureDir, `docs`)
      Paka.Adaptors.VitePress.generate(model, {
        outputDir,
        githubUrl: `https://github.com/example/ui`,
        groupByCategory: true,
      })

      const sidebar = readFileSync(join(outputDir, `.generated`, `sidebar.ts`), `utf8`)
      const featurePage = readFileSync(join(outputDir, `api`, `feature-tools.md`), `utf8`)
      const guidePage = readFileSync(join(outputDir, `api`, `guide.md`), `utf8`)
      const guideExportsPage = readFileSync(join(outputDir, `api`, `guide`, `exports.md`), `utf8`)
      const landingPage = readFileSync(join(outputDir, `api`, `landing-page.md`), `utf8`)
      const wrapperPage = readFileSync(join(outputDir, `api`, `test`, `~.md`), `utf8`)
      const nestedPage = readFileSync(join(outputDir, `api`, `feature-tools`, `nested.md`), `utf8`)
      const deepPage = readFileSync(
        join(outputDir, `api`, `feature-tools`, `nested`, `deeper.md`),
        `utf8`,
      )

      expect(sidebar).toContain(`"/feature-tools"`)
      expect(sidebar).toContain(`"/guide"`)
      expect(sidebar).toContain(`/api/test`)
      expect(featurePage).toContain(`## Utilities`)
      expect(featurePage).toContain(`## Builders`)
      expect(featurePage).toContain(`&lt;value&gt;`)
      expect(featurePage).toContain('`Map<T>`')
      expect(featurePage).toContain(
        `<SourceLink inline href="https://github.com/example/ui/blob/main/./src/feature-tools.ts#L10" />`,
      )
      expect(featurePage).toContain(`<summary>Full Signature</summary>`)
      expect(featurePage).toContain(`// Chainable methods:`)
      expect(featurePage).toContain(`**Constructor Parameters:**`)
      expect(featurePage).toContain(`**Throws:**`)
      expect(featurePage).toContain(`// @noErrors`)
      expect(featurePage).toContain(`import { FeatureTools } from '@example/ui/feature-tools'`)
      expect(featurePage).toContain(`## Namespaces`)
      expect(featurePage).toContain(`/api/feature-tools/nested`)
      expect(guidePage).toContain(`# Guide`)
      expect(guidePage).toContain(`Guide walkthrough.`)
      expect(guideExportsPage).toContain(`## Import`)
      expect(landingPage).toContain(`layout: home`)
      expect(landingPage).toContain(`Landing overview.`)
      expect(wrapperPage).toContain(`Namespace`)
      expect(wrapperPage).toContain(`Barrel`)
      expect(nestedPage).toContain(`Nested module docs.`)
      expect(deepPage).toContain(`deepValue`)
    } finally {
      process.chdir(originalCwd)
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  test('extractors handle malformed manifests and drillable namespace edge cases', () => {
    expect(() =>
      extractFromFiles({
        projectRoot: `/broken`,
        files: {},
      }),
    ).toThrow(`package.json not found`)

    expect(() =>
      extractFromFiles({
        projectRoot: `/broken`,
        files: {
          [`/broken/package.json`]: JSON.stringify({ name: `@example/broken`, version: `1.0.0` }),
        },
      }),
    ).toThrow(`missing "exports" field`)

    const inMemoryModel = extractFromFiles({
      projectRoot: `/virtual`,
      entrypoints: [`./widget`, `./missing`],
      matching: { name: `kept` },
      files: {
        [`/virtual/package.json`]: JSON.stringify({
          name: `@example/in-memory`,
          version: `1.0.0`,
          exports: {
            './widget': `./src/widget/__.js`,
            './missing': `./src/missing.js`,
          },
        }),
        [`/virtual/src/widget/__.ts`]: `
export const kept = 1
export const skipped = 2
        `.trim(),
        [`/virtual/src/widget/$.ts`]: `
/**
 * Widget docs.
 * @category Tools
 */
export namespace Widget {}

export * as Widget from './__.js'
        `.trim(),
      },
    })

    expect(inMemoryModel.entrypoints).toHaveLength(1)
    expect(inMemoryModel.entrypoints[0]?._tag).toBe(`DrillableNamespaceEntrypoint`)
    expect(inMemoryModel.entrypoints[0]?.module.docs?.description).toBe(`Widget docs.`)
    expect(inMemoryModel.entrypoints[0]?.module.category).toBe(`Tools`)
    expect(inMemoryModel.entrypoints[0]?.module.exports.map((entry) => entry.name)).toEqual([`kept`])

    const fixtureDir = mkdtempSync(join(tmpdir(), `paka-extract-edges-`))

    try {
      mkdirSync(join(fixtureDir, `src`, `foo-bar`), { recursive: true })
      writeFileSync(
        join(fixtureDir, `package.json`),
        JSON.stringify(
          {
            name: `@example/extracted`,
            version: `1.0.0`,
            exports: {
              './foo-bar': `./src/foo-bar/$.js`,
              './missing': `./src/missing.js`,
            },
          },
          null,
          2,
        ),
      )
      writeFileSync(
        join(fixtureDir, `tsconfig.json`),
        JSON.stringify(
          {
            compilerOptions: {
              target: `ESNext`,
              module: `ESNext`,
              moduleResolution: `Bundler`,
            },
          },
          null,
          2,
        ),
      )
      writeFileSync(
        join(fixtureDir, `src`, `foo-bar`, `$.ts`),
        `
/**
 * FooBar docs.
 * @category Utilities
 */
export * as FooBar from './__.js'
        `.trim(),
      )
      writeFileSync(
        join(fixtureDir, `src`, `foo-bar`, `__.ts`),
        `
export const picked = () => 'ok'
export const ignored = () => 'nope'
        `.trim(),
      )

      const extracted = extract({
        projectRoot: fixtureDir,
        entrypoints: [`./foo-bar`, `./missing`],
        matching: { name: `picked` },
      })

      expect(extracted.entrypoints).toHaveLength(1)
      expect(extracted.entrypoints[0]?._tag).toBe(`DrillableNamespaceEntrypoint`)
      expect(extracted.entrypoints[0]?.module.docs?.description).toBe(`FooBar docs.`)
      expect(extracted.entrypoints[0]?.module.category).toBe(`Utilities`)
      expect(extracted.entrypoints[0]?.module.exports.map((entry) => entry.name)).toEqual([`picked`])
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })
})
