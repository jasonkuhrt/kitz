#!/usr/bin/env tsx
/**
 * Syncs tsconfig.json paths from package.json imports across all packages.
 *
 * Transforms package.json imports to tsconfig paths:
 *   "#pkg": "./build/_.js"  →  "#pkg": ["./src/_.js"]
 *
 * Run with: tsx .claude/skills/syncing-tsconfig-paths/scripts/sync-tsconfig-paths.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT_DIR = path.join(import.meta.dirname, '../../../..')
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages')

interface Issue {
  package: string
  type: 'missing' | 'mismatch' | 'extra'
  path: string
  expected?: string[]
  actual?: string[]
}

const getPackageDirs = (): string[] => {
  return fs
    .readdirSync(PACKAGES_DIR)
    .map((name) => path.join(PACKAGES_DIR, name))
    .filter((dir) => fs.statSync(dir).isDirectory())
    .filter((dir) => fs.existsSync(path.join(dir, 'package.json')))
}

const transformImportsToPaths = (
  imports: Record<string, string | object>,
  packageName: string,
): Record<string, string[]> => {
  const paths: Record<string, string[]> = {}

  for (const [key, value] of Object.entries(imports)) {
    // Skip #kitz/* patterns - these are manually maintained for circular devDep workaround
    // See .claude/rules/circular-devdep-workaround.md
    if (key.startsWith('#kitz/')) {
      continue
    }

    // Skip conditional imports (objects with browser/default/etc conditions)
    if (typeof value !== 'string') {
      console.warn(`  Warning: ${packageName} has conditional import "${key}", skipping`)
      continue
    }

    // Transform ./build/ to ./src/ (keep .js - TS resolves to .ts with nodenext)
    const srcPath = value.replace(/^\.\/build\//, './src/')
    paths[key] = [srcPath]
  }

  return paths
}

const checkPackage = (packageDir: string): Issue[] => {
  const packageJsonPath = path.join(packageDir, 'package.json')
  const tsconfigPath = path.join(packageDir, 'tsconfig.json')

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const name = packageJson.name as string
  const imports = packageJson.imports as Record<string, string> | undefined

  if (!imports) {
    return []
  }

  if (!fs.existsSync(tsconfigPath)) {
    return []
  }

  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'))
  const expectedPaths = transformImportsToPaths(imports, name)
  const currentPaths = (tsconfig.compilerOptions?.paths ?? {}) as Record<string, string[]>
  const issues: Issue[] = []

  // Check for missing or mismatched paths
  for (const [key, value] of Object.entries(expectedPaths)) {
    if (!(key in currentPaths)) {
      issues.push({ package: name, type: 'missing', path: key, expected: value })
    } else if (JSON.stringify(currentPaths[key]) !== JSON.stringify(value)) {
      issues.push({
        package: name,
        type: 'mismatch',
        path: key,
        expected: value,
        actual: currentPaths[key],
      })
    }
  }

  // Check for extra paths (skip #kitz/* - manually maintained for circular devDep workaround)
  for (const key of Object.keys(currentPaths)) {
    if (key.startsWith('#kitz/')) {
      continue
    }
    if (!(key in expectedPaths)) {
      issues.push({ package: name, type: 'extra', path: key, actual: currentPaths[key] })
    }
  }

  return issues
}

const syncPackage = (packageDir: string): { name: string; updated: boolean } => {
  const packageJsonPath = path.join(packageDir, 'package.json')
  const tsconfigPath = path.join(packageDir, 'tsconfig.json')

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const name = packageJson.name as string
  const imports = packageJson.imports as Record<string, string> | undefined

  if (!imports) {
    return { name, updated: false }
  }

  if (!fs.existsSync(tsconfigPath)) {
    console.warn(`  Warning: ${name} has no tsconfig.json`)
    return { name, updated: false }
  }

  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'))
  const newPaths = transformImportsToPaths(imports, name)
  const currentPaths = (tsconfig.compilerOptions?.paths ?? {}) as Record<string, string[]>

  // Preserve existing #kitz/* paths (manually maintained for circular devDep workaround)
  const preservedPaths: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(currentPaths)) {
    if (key.startsWith('#kitz/')) {
      preservedPaths[key] = value
    }
  }

  // Merge: new synced paths + preserved #kitz/* paths
  const mergedPaths = { ...newPaths, ...preservedPaths }

  // Check if update needed
  const mergedPathsJson = JSON.stringify(mergedPaths, null, 2)
  const currentPathsJson = JSON.stringify(currentPaths, null, 2)

  if (mergedPathsJson === currentPathsJson) {
    return { name, updated: false }
  }

  // Update tsconfig
  tsconfig.compilerOptions = tsconfig.compilerOptions ?? {}
  tsconfig.compilerOptions.paths = mergedPaths

  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n')

  return { name, updated: true }
}

const showHelp = () => {
  console.log(`Sync tsconfig.json paths from package.json imports.

Usage:
  tsx .claude/skills/syncing-tsconfig-paths/scripts/sync-tsconfig-paths.ts
  tsx .claude/skills/syncing-tsconfig-paths/scripts/sync-tsconfig-paths.ts --check
  tsx .claude/skills/syncing-tsconfig-paths/scripts/sync-tsconfig-paths.ts --help

Options:
  --check   Audit mode: check for issues without modifying files (exit 1 if issues found)
  --help    Show this help message

Behavior:
  Transforms package.json imports to tsconfig paths:
    "#pkg": "./build/_.js"  →  "#pkg": ["./src/_.js"]

  Conditional imports (browser/default conditions) are skipped.`)
}

const main = () => {
  const args = process.argv.slice(2)
  const checkMode = args.includes('--check')
  const helpMode = args.includes('--help') || args.includes('-h')

  if (helpMode) {
    showHelp()
    process.exit(0)
  }

  const packageDirs = getPackageDirs()

  if (checkMode) {
    // Audit mode
    console.log('Auditing tsconfig paths...\n')
    const allIssues: Issue[] = []

    for (const dir of packageDirs) {
      const issues = checkPackage(dir)
      allIssues.push(...issues)
    }

    if (allIssues.length === 0) {
      console.log('✓ All tsconfig paths are in sync!')
      process.exit(0)
    }

    console.log(`Found ${allIssues.length} issue(s):\n`)
    for (const issue of allIssues) {
      if (issue.type === 'missing') {
        console.log(`  ✗ ${issue.package}: missing path "${issue.path}"`)
        console.log(`      Expected: ${JSON.stringify(issue.expected)}`)
      } else if (issue.type === 'mismatch') {
        console.log(`  ✗ ${issue.package}: path "${issue.path}" differs`)
        console.log(`      Expected: ${JSON.stringify(issue.expected)}`)
        console.log(`      Actual:   ${JSON.stringify(issue.actual)}`)
      } else if (issue.type === 'extra') {
        console.log(`  ⚠ ${issue.package}: extra path "${issue.path}" not in imports`)
      }
    }

    process.exit(1)
  } else {
    // Sync mode
    console.log('Syncing tsconfig paths from package.json imports...\n')

    let updatedCount = 0

    for (const dir of packageDirs) {
      const result = syncPackage(dir)
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
