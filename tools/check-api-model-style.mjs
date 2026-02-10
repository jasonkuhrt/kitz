#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()

/**
 * @typedef {{
 *   file: string
 *   line: number
 *   column: number
 *   message: string
 * }} Violation
 */

/** @type {Violation[]} */
const violations = []

const listFiles = (dir) => {
  /** @type {string[]} */
  const files = []
  for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
    const next = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFiles(next))
      continue
    }
    if (entry.isFile()) files.push(next)
  }
  return files
}

const getLineAndColumn = (content, index) => {
  const before = content.slice(0, index)
  const lines = before.split('\n')
  const lastLine = lines[lines.length - 1] ?? ''
  return {
    line: lines.length,
    column: lastLine.length + 1,
  }
}

const addRegexViolations = (file, content, pattern, message) => {
  const matches = content.matchAll(pattern)
  for (const match of matches) {
    if (match.index === undefined) continue
    const position = getLineAndColumn(content, match.index)
    violations.push({ file, ...position, message })
  }
}

const releaseApiFiles = listFiles('packages/release/src/api').filter((file) =>
  file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.test-d.ts')
)

for (const file of releaseApiFiles) {
  const content = readFileSync(join(repoRoot, file), 'utf8')
  addRegexViolations(
    file,
    content,
    /\b(?:parse|decode)ExactReleaseTag\b/g,
    'Avoid ad-hoc exact release tag parsers; decode with Pkg.Pin.Exact.FromString.',
  )
  addRegexViolations(
    file,
    content,
    /(?:lastIndexOf|split)\('@'\)/g,
    "Do not parse tags via '@' string splitting; decode with Pkg.Pin.Exact.FromString.",
  )
  addRegexViolations(
    file,
    content,
    /Semver\.fromString\(\s*`/g,
    'Avoid Semver.fromString on template literals; use Semver combinators and structured data.',
  )
}

const packageTsFiles = listFiles('packages').filter((file) =>
  file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.test-d.ts')
)

for (const file of packageTsFiles) {
  const content = readFileSync(join(repoRoot, file), 'utf8')
  const topLevelLiteralAwareFromString =
    /export const fromString\s*=\s*<const\s+([A-Za-z_$][\w$]*)\s+extends\s+string>\s*\([\s\S]{0,300}?\)\s*:\s*([^=\n]+?)=>/g

  for (const match of content.matchAll(topLevelLiteralAwareFromString)) {
    const genericName = match[1]
    const returnType = match[2] ?? ''
    if (!genericName || !returnType.includes(`<${genericName}>`)) continue
    if (/export const fromLiteral\s*=/.test(content)) continue
    if (match.index === undefined) continue
    const position = getLineAndColumn(content, match.index)
    violations.push({
      file,
      ...position,
      message: 'Literal-aware parser exports must provide `fromLiteral` alongside `fromString`.',
    })
  }

  const classLiteralAwareFromString =
    /static fromString\s*=\s*<const\s+([A-Za-z_$][\w$]*)\s+extends\s+string>\s*\([\s\S]{0,300}?Analyze<\1>[\s\S]{0,300}?\)\s*=>/g
  const hasClassLiteralAwareFromString = classLiteralAwareFromString.test(content)

  if (hasClassLiteralAwareFromString && !/static fromLiteral\s*=/.test(content)) {
    const match = content.match(/static fromString\s*=\s*<const\s+[A-Za-z_$][\w$]*\s+extends\s+string>/)
    const at = match?.index ?? 0
    const position = getLineAndColumn(content, at)
    violations.push({
      file,
      ...position,
      message: 'Class literal-aware parser APIs must expose `static fromLiteral` as the canonical literal parser name.',
    })
  }
}

const pinFile = 'packages/pkg/src/pin/pin.ts'
const pinContent = readFileSync(join(repoRoot, pinFile), 'utf8')

if (!pinContent.includes('static FromString: S.Schema<Exact, string>')) {
  violations.push({
    file: pinFile,
    line: 1,
    column: 1,
    message: 'Pin.Exact must expose a FromString schema codec.',
  })
}

if (!/export const fromLiteral[\s\S]*fromString\(input\)/m.test(pinContent)) {
  violations.push({
    file: pinFile,
    line: 1,
    column: 1,
    message: 'Pin module must expose fromLiteral as the literal-parser API.',
  })
}

if (violations.length > 0) {
  console.error('API model-style check failed:')
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line}:${violation.column} ${violation.message}`)
  }
  console.error('')
  console.error('See docs/schema-parsing-contract.md for the contract.')
  process.exit(1)
}

console.log(
  `API model-style check passed (${releaseApiFiles.length} release API files and ${packageTsFiles.length} package files checked).`,
)
