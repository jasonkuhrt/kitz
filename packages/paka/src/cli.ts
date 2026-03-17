#!/usr/bin/env bun
import { Effect, Result, Schema as S } from 'effect'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { VitePress } from './adaptors/__.js'
import { extract } from './extractor/__.js'
import {
  analyzeSemverImpactFromProjectRoots,
  renderSemverReport,
  SemverReportSchema,
} from './semver.js'
import { addTwoslashAnnotations } from './transformers.js'

/**
 * Get dprint formatter for markdown.
 */
type MarkdownFormatter = {
  formatText: (fileText: string) => string
}

const getMarkdownFormatter = async (): Promise<MarkdownFormatter | null> => {
  const loadResult = await Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const { createFromBuffer } = await import('@dprint/formatter')
        const { getPath } = await import('@dprint/markdown')
        const buffer = await readFile(getPath())
        const formatter = createFromBuffer(buffer)
        return {
          formatText: (fileText: string) =>
            formatter.formatText({
              filePath: 'file.md',
              fileText,
              overrideConfig: {},
            }),
        } satisfies MarkdownFormatter
      },
      catch: (error) => error,
    }).pipe(
      Effect.match({
        onFailure: (error) => ({ _tag: 'load-failed' as const, error }),
        onSuccess: (formatter) => ({ _tag: 'loaded' as const, formatter }),
      }),
    ),
  )

  if (loadResult._tag === 'load-failed') {
    console.warn('Warning: Could not load dprint formatter:', loadResult.error)
    return null
  }

  return loadResult.formatter
}

/**
 * Recursively find all .md files in a directory.
 */
const findMarkdownFiles = (dir: string): string[] => {
  const results: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath))
    } else if (entry.endsWith('.md')) {
      results.push(fullPath)
    }
  }

  return results
}

/**
 * CLI for generating documentation.
 */
const main = async () => {
  const command = process.argv[2]
  const args = process.argv.slice(3)

  if (command === 'generate' || !command) {
    await generateDocs()
  } else if (command === 'semver') {
    runSemver(args)
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printUsage()
  } else {
    console.error(`Unknown command: ${command}`)
    printUsage()
    process.exit(1)
  }
}

type SemverCommandOptions = {
  previousProjectRoot: string
  nextProjectRoot: string
  currentVersion?: string
  json: boolean
}

const printUsage = () => {
  console.log(`Usage:
  paka generate
  paka semver <previous-project-root> <next-project-root> [--current-version <version>] [--json]`)
}

const parseSemverCommandOptions = (args: string[]): SemverCommandOptions => {
  const positional: string[] = []
  let json = false
  let currentVersion: string | undefined

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (!arg) continue

    if (arg === '--json') {
      json = true
      continue
    }

    if (arg === '--current-version') {
      const value = args[index + 1]
      if (!value) {
        throw new Error('Missing value for --current-version')
      }
      currentVersion = value
      index++
      continue
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`)
    }

    positional.push(arg)
  }

  const [previousProjectRoot, nextProjectRoot] = positional
  if (!previousProjectRoot || !nextProjectRoot) {
    throw new Error(
      'Expected two positional package roots: paka semver <previous-project-root> <next-project-root>',
    )
  }

  return {
    previousProjectRoot,
    nextProjectRoot,
    json,
    ...(currentVersion ? { currentVersion } : {}),
  }
}

const runSemver = (args: string[]) => {
  const options = parseSemverCommandOptions(args)
  const report = analyzeSemverImpactFromProjectRoots({
    previousProjectRoot: resolve(options.previousProjectRoot),
    nextProjectRoot: resolve(options.nextProjectRoot),
    ...(options.currentVersion ? { currentVersion: options.currentVersion } : {}),
  })

  if (options.json) {
    console.log(JSON.stringify(S.encodeSync(SemverReportSchema)(report), null, 2))
    return
  }

  console.log(renderSemverReport(report))
}

/**
 * Generate documentation from source code.
 */
const generateDocs = async () => {
  console.log('Extracting documentation from source files...')

  const projectRoot = process.cwd()

  // Extract interface model
  const model = extract({
    projectRoot,
    entrypoints: [
      // Testing & TypeScript
      './test',
      './ts',
      // Core data structures
      './arr',
      './obj',
      './str',
      './fn',
      './num',
      // Practical utilities
      './err',
      './html',
      './json',
      './paka',
      './prom',
      './rec',
      './value',
    ],
    // Only include exports with JSDoc descriptions
    matching: {
      docs: {
        description: { $not: undefined },
      },
    },
  })

  console.log(`Extracted ${model.entrypoints.length} entrypoints`)

  // Save intermediate JSON model
  const modelPath = join(projectRoot, 'docs/.generated/interface.json')
  writeFileSync(modelPath, JSON.stringify(model, null, 2), 'utf-8')
  console.log(`Saved interface model to ${modelPath}`)

  // Generate VitePress markdown
  const docsDir = join(projectRoot, 'docs')
  VitePress.generate(model, {
    outputDir: docsDir,
    githubUrl: 'https://github.com/jasonkuhrt/kitz',
  })

  // Format and post-process markdown files
  console.log('Formatting documentation with dprint...')
  const formatter = await getMarkdownFormatter()
  const mdFiles = findMarkdownFiles(join(docsDir, 'api'))
  let formattedCount = 0
  let highlightedCount = 0

  for (const file of mdFiles) {
    let content = readFileSync(file, 'utf-8')
    const original = content

    // 1. Format with dprint
    if (formatter) {
      const formattedResult = Result.try({
        try: () => formatter.formatText(content),
        catch: (error) => error,
      })
      if (Result.isSuccess(formattedResult)) {
        content = formattedResult.success
      } else {
        console.warn(`Warning: Failed to format ${file}:`, formattedResult.failure)
      }
    }

    // 2. Remove leading semicolons from TypeScript code blocks
    // dprint's ASI mode adds semicolons to parenthesized expressions
    content = content.replace(/(```typescript\n);(\s*[(<])/g, '$1$2')

    // 3. Format TypeScript code blocks and add method name highlights
    content = content.replace(
      /```typescript( twoslash)?\n([\s\S]*?)```/g,
      (match, twoslash, code) => {
        const processedResult = Result.try({
          try: () => addTwoslashAnnotations(code),
          catch: (error) => error,
        })
        if (Result.isSuccess(processedResult)) {
          const processed = processedResult.success
          return `\`\`\`typescript${twoslash || ''}\n${processed}\`\`\``
        }
        // If AST parsing fails, render as vanilla TypeScript (remove twoslash)
        console.warn(
          'Warning: Failed to parse TypeScript code block, rendering as vanilla:',
          processedResult.failure,
        )
        return `\`\`\`typescript\n${code}\`\`\``
      },
    )

    if (content !== original) {
      writeFileSync(file, content, 'utf-8')
      formattedCount++
      if (content.includes('[!code word:')) highlightedCount++
    }
  }

  console.log(`✅ Formatted ${formattedCount} file(s)`)
  if (highlightedCount > 0) {
    console.log(`✅ Added method name highlights to ${highlightedCount} file(s)`)
  }

  console.log('✅ Documentation generated successfully')
}

void Promise.resolve(main()).then(
  () => undefined,
  (error) => {
    console.error('paka failed:', error)
    process.exit(1)
  },
)
