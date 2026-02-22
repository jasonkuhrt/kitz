#!/usr/bin/env tsx
/**
 * Creates a new package in the monorepo.
 *
 * Usage: tsx .claude/skills/creating-packages/scripts/create-package.ts <name>
 *
 * Example:
 *   tsx .claude/skills/creating-packages/scripts/create-package.ts foo     # Creates @kitz/foo
 *   tsx .claude/skills/creating-packages/scripts/create-package.ts foo-bar # Creates @kitz/foo-bar
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT_DIR = path.join(import.meta.dirname, '../../../..')
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages')

const toPascalCase = (kebab: string): string =>
  kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

const createPackage = (name: string) => {
  const packageDir = path.join(PACKAGES_DIR, name)
  const srcDir = path.join(packageDir, 'src')

  if (fs.existsSync(packageDir)) {
    console.error(`Error: Package directory already exists: ${packageDir}`)
    process.exit(1)
  }

  const pascalName = toPascalCase(name)

  // Create directories
  fs.mkdirSync(srcDir, { recursive: true })

  // package.json
  const packageJson = {
    name: `@kitz/${name}`,
    version: '0.0.0-kitz-release',
    type: 'module',
    sideEffects: false,
    imports: {
      [`#${name}`]: './build/_.js',
      [`#${name}/*`]: './build/*.js',
    },
    exports: {
      '.': './build/_.js',
      './__': './build/__.js',
    },
    files: ['build', 'src'],
    scripts: {
      'build': 'tsgo -p tsconfig.build.json',
      'dev': 'tsgo -p tsconfig.build.json --watch',
      'check:types': 'tsgo --noEmit',
      'check:lint': 'oxlint --config ../../oxlint.json src/',
      'check:package': 'publint && attw --pack',
    },
    dependencies: {
      '@kitz/core': 'workspace:*',
    },
  }
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
  )

  // tsconfig.json
  const tsconfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      rootDir: './src',
      outDir: './build',
      tsBuildInfoFile: './node_modules/.cache/.tsbuildinfo',
      allowImportingTsExtensions: true,
      noEmit: true,
      paths: {
        [`#${name}`]: ['./src/_.ts'],
        [`#${name}/*`]: ['./src/*.ts'],
      },
    },
    include: ['src/**/*.ts'],
    exclude: ['build', 'node_modules', '**/*.bench-d.ts', '**/*.test.ts', '**/*.test-d.ts'],
  }
  fs.writeFileSync(
    path.join(packageDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2) + '\n',
  )

  // tsconfig.build.json
  const tsconfigBuild = {
    extends: './tsconfig.json',
    compilerOptions: {
      composite: true,
      noEmit: false,
      allowImportingTsExtensions: false,
      declaration: true,
      declarationMap: true,
      rewriteRelativeImportExtensions: true,
    },
    exclude: ['build', 'node_modules', '**/*.test.ts', '**/*.test-d.ts', '**/*.bench-d.ts'],
  }
  fs.writeFileSync(
    path.join(packageDir, 'tsconfig.build.json'),
    JSON.stringify(tsconfigBuild, null, 2) + '\n',
  )

  // src/_.ts (namespace file)
  fs.writeFileSync(
    path.join(srcDir, '_.ts'),
    `export * as ${pascalName} from './__.js'\n`,
  )

  // src/__.ts (barrel file)
  fs.writeFileSync(
    path.join(srcDir, '__.ts'),
    `// Export functions and types here\n`,
  )

  console.log(`Created @kitz/${name}`)
  console.log(`\nNext steps:`)
  console.log(`  1. Run: pnpm install`)
  console.log(`  2. Add exports to: packages/${name}/src/__.ts`)
  console.log(`  3. Build: pnpm turbo run build --filter=@kitz/${name}`)
}

const showHelp = () => {
  console.log(`Create a new package in the monorepo.

Usage:
  tsx .claude/skills/creating-packages/scripts/create-package.ts <name>
  tsx .claude/skills/creating-packages/scripts/create-package.ts --help

Arguments:
  name    Package name (lowercase, letters/numbers/hyphens)

Examples:
  tsx .claude/skills/creating-packages/scripts/create-package.ts foo       # Creates @kitz/foo
  tsx .claude/skills/creating-packages/scripts/create-package.ts foo-bar   # Creates @kitz/foo-bar

Creates:
  packages/<name>/
  ├── src/_.ts, __.ts
  ├── package.json
  ├── tsconfig.json
  └── tsconfig.build.json`)
}

const main = () => {
  const arg = process.argv[2]

  if (arg === '--help' || arg === '-h') {
    showHelp()
    process.exit(0)
  }

  if (!arg) {
    console.error('Usage: tsx .claude/skills/creating-packages/scripts/create-package.ts <name>')
    console.error('Run with --help for more information.')
    process.exit(1)
  }

  const name = arg

  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(
      'Error: Package name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens',
    )
    process.exit(1)
  }

  createPackage(name)
}

main()
