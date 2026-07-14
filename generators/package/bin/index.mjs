#!/usr/bin/env node
// Dependency-free scaffolder for a new @kitz package.
//
// This is a plain `node` bin — no bingo, no zod, no framework. `vp create`
// runs a local template by executing its package.json `bin` (`node <bin>
// <args>`); a bin without a `bingo` dependency is a first-class non-bingo
// template. It also runs standalone: `node generators/package/bin/index.mjs
// <name> [--description "..."]`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { argv, exit, stdin, stdout } from 'node:process'
import { fileURLToPath } from 'node:url'

// Root is derived from this file's own location (<root>/generators/package/bin/
// index.mjs), so scaffolding targets the right place regardless of the cwd vp
// invokes us with.
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const toPascalCase = (kebab) =>
  kebab
    .split('-')
    .map((word) => (word[0]?.toUpperCase() ?? '') + word.slice(1))
    .join('')

const parseArgs = (args) => {
  const positionals = []
  let description
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--description' || arg === '-d') description = args[++i]
    else if (arg.startsWith('--description=')) description = arg.slice('--description='.length)
    else if (!arg.startsWith('-')) positionals.push(arg)
  }
  return { name: positionals[0], description }
}

let { name, description } = parseArgs(argv.slice(2))

if (!name) {
  const rl = createInterface({ input: stdin, output: stdout })
  name = (await rl.question('Package name (without the @kitz/ scope, e.g. "color"): ')).trim()
  if (!description) {
    const answer = (await rl.question('One-line description (optional): ')).trim()
    description = answer || undefined
  }
  rl.close()
}

if (!name) {
  console.error('A package name is required.')
  exit(1)
}

const namespace = toPascalCase(name)
const resolvedDescription = description ?? `TODO: describe @kitz/${name}`
const packageDir = join(workspaceRoot, 'packages', name)

if (existsSync(packageDir)) {
  console.error(`packages/${name} already exists — refusing to overwrite.`)
  exit(1)
}

const json = (value) => JSON.stringify(value, null, 2) + '\n'

const files = {
  'package.json': json({
    name: `@kitz/${name}`,
    version: '0.0.0',
    description: resolvedDescription,
    keywords: ['effect', 'effect-ts', 'typescript'],
    homepage: `https://github.com/jasonkuhrt/kitz/tree/main/packages/${name}#readme`,
    bugs: { url: 'https://github.com/jasonkuhrt/kitz/issues' },
    license: 'MIT',
    author: { name: 'Jason Kuhrt', url: 'https://kuhrt.me' },
    repository: {
      type: 'git',
      url: 'git+https://github.com/jasonkuhrt/kitz.git',
      directory: `packages/${name}`,
    },
    files: ['build', 'src'],
    type: 'module',
    sideEffects: false,
    // Live types: dev resolves the .ts source; publishConfig swaps to built
    // .js + .d.ts at publish (pnpm-only — see the npm/npx block).
    exports: { '.': './src/_.ts' },
    scripts: { prepack: 'tsc -b tsconfig.production.json' },
    publishConfig: {
      access: 'public',
      exports: { '.': { types: './build/_.d.ts', default: './build/_.js' } },
    },
    devDependencies: {
      '@kitz/vitest': 'workspace:*',
      '@vitest/coverage-v8': '4.1.10',
      effect: 'catalog:',
    },
    peerDependencies: { effect: '^4.0.0-beta.85' },
  }),
  'README.md': `# @kitz/${name}\n\n${resolvedDescription}\n`,
  'tsconfig.json': json({
    extends: '../../tsconfig.template.topology.solution.json',
    references: [{ path: './tsconfig.development.json' }, { path: './tsconfig.production.json' }],
  }),
  'tsconfig.development.json': json({
    extends: [
      '../../tsconfig.template.stage.development.json',
      '../../tsconfig.template.effect.json',
    ],
    compilerOptions: {
      tsBuildInfoFile: `../../.tsbuild/${name}/tsconfig.development.tsbuildinfo`,
    },
    references: [
      { path: './tsconfig.production.json' },
      { path: '../vitest/tsconfig.production.json' },
    ],
  }),
  'tsconfig.production.json': json({
    extends: [
      '../../tsconfig.template.stage.production.json',
      '../../tsconfig.template.topology.imported.json',
      '../../tsconfig.template.effect.json',
    ],
    compilerOptions: {
      outDir: 'build',
      tsBuildInfoFile: `../../.tsbuild/${name}/tsconfig.production.tsbuildinfo`,
    },
  }),
  'src/_.ts': `export * as ${namespace} from './__.js'\n`,
  'src/__.ts': `// Implementation for the ${namespace} namespace.\nexport {}\n`,
}

for (const [relativePath, content] of Object.entries(files)) {
  const target = join(packageDir, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

console.log(`Created packages/${name} (@kitz/${name}).`)
console.log('Next:')
console.log(
  `  • Add { "path": "./packages/${name}/tsconfig.development.json" } to the root tsconfig.development.json "references" (and the matching tsconfig.production.json entry).`,
)
console.log('  • Run `pnpm install` to link @kitz/' + name + ' into the workspace.')
