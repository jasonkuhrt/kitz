#!/usr/bin/env tsx
/**
 * Syncs package.json scripts across all packages in the monorepo.
 *
 * Convention: Scripts prefixed with "_:" in root package.json are
 * propagated to all packages with the prefix stripped.
 *
 * Example:
 *   Root: "_:build": "tsgo -p tsconfig.build.json"
 *   Package: "build": "tsgo -p tsconfig.build.json"
 *
 * Run with: tsx .claude/skills/authoring-global-scripts/scripts/sync-package-scripts.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT_DIR = path.join(import.meta.dirname, '../../../..')
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages')
const SYNC_PREFIX = '_:'

interface Issue {
  package: string
  type: 'missing' | 'mismatch' | 'extra'
  script: string
  expected?: string
  actual?: string
}

const getPackageScriptsFromRoot = (): Record<string, string> => {
  // oxlint-disable-next-line kitz/schema/no-json-parse
  const rootPackageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'))
  const rootScripts = rootPackageJson.scripts ?? {}

  const syncedScripts: Record<string, string> = {}
  for (const [key, value] of Object.entries(rootScripts)) {
    if (key.startsWith(SYNC_PREFIX)) {
      const scriptName = key.slice(SYNC_PREFIX.length)
      syncedScripts[scriptName] = value as string
    }
  }

  return syncedScripts
}

const getPackageDirs = (): string[] => {
  return fs
    .readdirSync(PACKAGES_DIR)
    .map((name) => path.join(PACKAGES_DIR, name))
    .filter((dir) => fs.statSync(dir).isDirectory())
    .filter((dir) => fs.existsSync(path.join(dir, 'package.json')))
}

const checkPackage = (packageDir: string, syncedScripts: Record<string, string>): Issue[] => {
  const packageJsonPath = path.join(packageDir, 'package.json')
  // oxlint-disable-next-line kitz/schema/no-json-parse
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const name = packageJson.name as string
  const currentScripts = packageJson.scripts ?? {}
  const issues: Issue[] = []

  // Check for missing or mismatched scripts
  for (const [key, value] of Object.entries(syncedScripts)) {
    if (!(key in currentScripts)) {
      issues.push({ package: name, type: 'missing', script: key, expected: value })
    } else if (currentScripts[key] !== value) {
      issues.push({
        package: name,
        type: 'mismatch',
        script: key,
        expected: value,
        actual: currentScripts[key],
      })
    }
  }

  // Check for extra scripts
  const allowedScripts = new Set(Object.keys(syncedScripts))
  for (const key of Object.keys(currentScripts)) {
    if (!allowedScripts.has(key)) {
      issues.push({ package: name, type: 'extra', script: key, actual: currentScripts[key] })
    }
  }

  return issues
}

const syncPackage = (
  packageDir: string,
  syncedScripts: Record<string, string>,
): { name: string; updated: boolean } => {
  const packageJsonPath = path.join(packageDir, 'package.json')
  // oxlint-disable-next-line kitz/schema/no-json-parse
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const name = packageJson.name as string

  const currentScripts = packageJson.scripts ?? {}
  let updated = false

  // Check if scripts need updating
  for (const [key, value] of Object.entries(syncedScripts)) {
    if (currentScripts[key] !== value) {
      updated = true
      break
    }
  }

  // Check for extra scripts (warn only)
  const allowedScripts = new Set(Object.keys(syncedScripts))
  for (const key of Object.keys(currentScripts)) {
    if (!allowedScripts.has(key)) {
      console.warn(`  Warning: ${name} has extra script "${key}"`)
    }
  }

  if (updated) {
    packageJson.scripts = { ...syncedScripts }
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  }

  return { name, updated }
}

const showHelp = () => {
  console.log(`Sync package.json scripts across all packages.

Usage:
  tsx .claude/skills/authoring-global-scripts/scripts/sync-package-scripts.ts
  tsx .claude/skills/authoring-global-scripts/scripts/sync-package-scripts.ts --check
  tsx .claude/skills/authoring-global-scripts/scripts/sync-package-scripts.ts --help

Options:
  --check   Audit mode: check for issues without modifying files (exit 1 if issues found)
  --help    Show this help message

Behavior:
  Scripts prefixed with "_:" in root package.json are propagated
  to all packages with the prefix stripped.

Example:
  Root:    "_:build": "tsgo -p tsconfig.build.json"
  Package: "build": "tsgo -p tsconfig.build.json"`)
}

const main = () => {
  const args = process.argv.slice(2)
  const checkMode = args.includes('--check')
  const helpMode = args.includes('--help') || args.includes('-h')

  if (helpMode) {
    showHelp()
    process.exit(0)
  }

  const syncedScripts = getPackageScriptsFromRoot()

  if (Object.keys(syncedScripts).length === 0) {
    console.log('No _:* scripts found in root package.json')
    return
  }

  const packageDirs = getPackageDirs()

  if (checkMode) {
    // Audit mode
    console.log('Auditing package scripts...\n')
    const allIssues: Issue[] = []

    for (const dir of packageDirs) {
      const issues = checkPackage(dir, syncedScripts)
      allIssues.push(...issues)
    }

    if (allIssues.length === 0) {
      console.log('✓ All packages are in sync!')
      process.exit(0)
    }

    console.log(`Found ${allIssues.length} issue(s):\n`)
    for (const issue of allIssues) {
      if (issue.type === 'missing') {
        console.log(`  ✗ ${issue.package}: missing script "${issue.script}"`)
      } else if (issue.type === 'mismatch') {
        console.log(`  ✗ ${issue.package}: script "${issue.script}" differs from template`)
        console.log(`      Expected: ${issue.expected}`)
        console.log(`      Actual:   ${issue.actual}`)
      } else if (issue.type === 'extra') {
        console.log(`  ⚠ ${issue.package}: extra script "${issue.script}" not in template`)
      }
    }

    process.exit(1)
  } else {
    // Sync mode
    console.log('Syncing package scripts...')
    console.log(`  Scripts to sync: ${Object.keys(syncedScripts).join(', ')}\n`)

    let updatedCount = 0

    for (const dir of packageDirs) {
      const result = syncPackage(dir, syncedScripts)
      if (result.updated) {
        console.log(`  ✓ Updated ${result.name}`)
        updatedCount++
      }
    }

    if (updatedCount === 0) {
      console.log('  All packages are in sync!')
    } else {
      console.log(`\n  Updated ${updatedCount} package(s)`)
    }
  }
}

main()
