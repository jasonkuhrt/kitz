#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { generate } from './adaptors/vitepress.js'
import { extract } from './extractor/extract.js'
import { addTwoslashAnnotations } from './transformers.js'

/**
 * Get dprint formatter for markdown.
 */
const getMarkdownFormatter = async () => {
  try {
    const { createFromBuffer } = await import('@dprint/formatter')
    const { getPath } = await import('@dprint/markdown')
    const buffer = await readFile(getPath())
    const formatter = createFromBuffer(buffer as any)

    return {
      formatText: (fileText: string) => {
        return formatter.formatText({
          filePath: 'file.md',
          fileText,
          overrideConfig: {},
        })
      },
    }
  } catch (error) {
    console.warn('Warning: Could not load dprint formatter:', error)
    return null
  }
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

  if (command === 'generate' || !command) {
    await generateDocs()
  } else {
    console.error(`Unknown command: ${command}`)
    console.log('Usage: paka generate')
    process.exit(1)
  }
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
  generate(model, {
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
      try {
        content = formatter.formatText(content)
      } catch (error) {
        console.warn(`Warning: Failed to format ${file}:`, error)
      }
    }

    // 2. Remove leading semicolons from TypeScript code blocks
    // dprint's ASI mode adds semicolons to parenthesized expressions
    content = content.replace(
      /(```typescript\n);(\s*[(<])/g,
      '$1$2',
    )

    // 3. Format TypeScript code blocks and add method name highlights
    content = content.replace(
      /```typescript( twoslash)?\n([\s\S]*?)```/g,
      (match, twoslash, code) => {
        try {
          const processed = addTwoslashAnnotations(code)
          return `\`\`\`typescript${twoslash || ''}\n${processed}\`\`\``
        } catch (error) {
          // If AST parsing fails, render as vanilla TypeScript (remove twoslash)
          console.warn('Warning: Failed to parse TypeScript code block, rendering as vanilla:', error)
          return `\`\`\`typescript\n${code}\`\`\``
        }
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

main().catch((error) => {
  console.error('Error generating documentation:', error)
  process.exit(1)
})
