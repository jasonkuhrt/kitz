#!/usr/bin/env tsx
/**
 * Generates documentation tables for README.md
 *
 * 1. Package table: Reads package.json files from packages directory
 * 2. Core namespace index: Parses _.ts files from core package modules
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '../../../..')
const packagesDir = path.join(rootDir, 'packages')
const corePackageSrcDir = path.join(packagesDir, 'core', 'src')
const readmePath = path.join(rootDir, 'README.md')

// --- Package Table ---

interface PackageInfo {
  name: string
  dirName: string
  description: string
}

const getPackages = (): PackageInfo[] => {
  const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  const packages: PackageInfo[] = []

  for (const dirName of dirs) {
    const pkgJsonPath = path.join(packagesDir, dirName, 'package.json')
    if (!fs.existsSync(pkgJsonPath)) continue

    // oxlint-disable-next-line kitz/schema/no-json-parse
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
    packages.push({
      name: pkgJson.name ?? dirName,
      dirName,
      description: pkgJson.description ?? '',
    })
  }

  return packages
}

const generatePackagesTable = (packages: PackageInfo[]): string => {
  const lines: string[] = ['| Package | Description |', '| ------- | ----------- |']

  for (const pkg of packages) {
    const link = `[\`${pkg.name}\`](./packages/${pkg.dirName})`
    const desc = pkg.description || '_No description_'
    lines.push(`| ${link} | ${desc} |`)
  }

  return lines.join('\n')
}

// --- Core Namespace Index ---

interface ModuleInfo {
  namespace: string
  dirName: string
  description: string
}

/**
 * Parse core/src/index.ts to extract namespace exports.
 * Pattern: `export { Namespace } from './dir/_.js'`
 */
const getCoreModules = (): ModuleInfo[] => {
  const indexPath = path.join(corePackageSrcDir, 'index.ts')
  const content = fs.readFileSync(indexPath, 'utf-8')

  const modules: ModuleInfo[] = []
  const regex = /export\s*\{\s*(\w+)\s*\}\s*from\s*'\.\/(\w+)\/_.js'/g

  let match
  while ((match = regex.exec(content)) !== null) {
    const namespace = match[1]
    const dirName = match[2]

    const description = getModuleDescription(dirName)

    modules.push({ namespace, dirName, description })
  }

  return modules
}

/**
 * Extract description from module's _.ts file.
 * Tries: JSDoc on namespace, then JSDoc on `export * as`.
 */
const getModuleDescription = (dirName: string): string => {
  const filePath = path.join(corePackageSrcDir, dirName, '_.ts')
  if (!fs.existsSync(filePath)) return ''

  const content = fs.readFileSync(filePath, 'utf-8')

  // Try JSDoc on `export namespace`
  const namespaceMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\*\/\s*\nexport\s+namespace/)
  if (namespaceMatch) {
    return extractFirstJsDocLine(namespaceMatch[1])
  }

  // Try JSDoc on `export * as`
  const exportAsMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\*\/\s*\nexport\s+\*\s+as/)
  if (exportAsMatch) {
    return extractFirstJsDocLine(exportAsMatch[1])
  }

  return ''
}

const extractFirstJsDocLine = (jsdocBody: string): string => {
  const lines = jsdocBody
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@'))

  return lines[0] ?? ''
}

const generateCoreNamespaceTable = (modules: ModuleInfo[]): string => {
  const lines: string[] = ['| Module | Description |', '| ------ | ----------- |']

  for (const mod of modules) {
    const desc = mod.description || '_No description_'
    lines.push(`| \`${mod.namespace}\` | ${desc} |`)
  }

  return lines.join('\n')
}

// --- README Update ---

const PACKAGES_START = '<!-- PACKAGES_TABLE_START -->'
const PACKAGES_END = '<!-- PACKAGES_TABLE_END -->'
const CORE_START = '<!-- CORE_NAMESPACE_INDEX_START -->'
const CORE_END = '<!-- CORE_NAMESPACE_INDEX_END -->'

const updateSection = (
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string,
): string => {
  const startIdx = content.indexOf(startMarker)
  const endIdx = content.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1) {
    return content // Skip if markers not found
  }

  const before = content.slice(0, startIdx + startMarker.length)
  const after = content.slice(endIdx)

  return `${before}\n\n${newContent}\n\n${after}`
}

const updateReadme = (packagesTable: string, coreTable: string): void => {
  let readme = fs.readFileSync(readmePath, 'utf-8')

  // Check for required markers
  const missingMarkers: string[] = []
  if (!readme.includes(PACKAGES_START) || !readme.includes(PACKAGES_END)) {
    missingMarkers.push(`${PACKAGES_START} ... ${PACKAGES_END}`)
  }
  if (!readme.includes(CORE_START) || !readme.includes(CORE_END)) {
    missingMarkers.push(`${CORE_START} ... ${CORE_END}`)
  }

  if (missingMarkers.length > 0) {
    console.error('Error: README.md missing required markers:')
    for (const marker of missingMarkers) {
      console.error(`  ${marker}`)
    }
    process.exit(1)
  }

  readme = updateSection(readme, PACKAGES_START, PACKAGES_END, packagesTable)
  readme = updateSection(readme, CORE_START, CORE_END, coreTable)

  fs.writeFileSync(readmePath, readme)
}

// --- Main ---

const showHelp = () => {
  console.log(`Refresh README.md documentation tables.

Usage:
  tsx .claude/skills/refreshing-docs/scripts/docs-refresh.ts
  tsx .claude/skills/refreshing-docs/scripts/docs-refresh.ts --help

Generates:
  - Package table from packages/*/package.json
  - Core namespace index from core/src/*/_.ts

Updates sections between marker comments in README.md.`)
}

const main = () => {
  const arg = process.argv[2]

  if (arg === '--help' || arg === '-h') {
    showHelp()
    process.exit(0)
  }

  const packages = getPackages()
  const packagesTable = generatePackagesTable(packages)

  const coreModules = getCoreModules()
  const coreTable = generateCoreNamespaceTable(coreModules)

  updateReadme(packagesTable, coreTable)

  console.log(`✓ Updated README.md:`)
  console.log(`  - ${packages.length} packages`)
  console.log(`  - ${coreModules.length} core modules`)
}

main()
