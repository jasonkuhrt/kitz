import { createTemplate } from 'bingo'
import { z } from 'zod'

const toPascalCase = (kebab: string): string =>
  kebab
    .split('-')
    .map((word) => (word[0]?.toUpperCase() ?? '') + word.slice(1))
    .join('')

export default createTemplate({
  about: {
    name: '@kitz/generator-package',
    description: 'Scaffold a new @kitz package (a concept) on the kitz toolchain.',
  },

  options: {
    name: z
      .string()
      .describe('Package name without the @kitz/ scope (e.g. "color" -> @kitz/color)'),
    description: z.string().optional().describe('One-line package description'),
  },

  async produce({ options }) {
    const name = options.name
    const namespace = toPascalCase(name)
    const description = options.description ?? `TODO: describe @kitz/${name}`

    const packageJson = {
      name: `@kitz/${name}`,
      version: '0.0.0',
      description,
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
        '@vitest/coverage-v8': '4.1.9',
        effect: 'catalog:',
      },
      peerDependencies: { effect: '^4.0.0-beta.85' },
    }

    const tsconfig = {
      extends: '../../tsconfig.template.topology.solution.json',
      references: [{ path: './tsconfig.development.json' }, { path: './tsconfig.production.json' }],
    }

    const tsconfigDevelopment = {
      extends: ['../../tsconfig.template.stage.development.json'],
      compilerOptions: {
        tsBuildInfoFile: `../../.tsbuild/${name}/tsconfig.development.tsbuildinfo`,
      },
      references: [
        { path: './tsconfig.production.json' },
        { path: '../vitest/tsconfig.production.json' },
      ],
    }

    const tsconfigProduction = {
      extends: [
        '../../tsconfig.template.stage.production.json',
        '../../tsconfig.template.topology.imported.json',
      ],
      compilerOptions: {
        outDir: 'build',
        tsBuildInfoFile: `../../.tsbuild/${name}/tsconfig.production.tsbuildinfo`,
      },
    }

    return {
      files: {
        'package.json': JSON.stringify(packageJson, null, 2) + '\n',
        'README.md': `# @kitz/${name}\n\n${description}\n`,
        'tsconfig.json': JSON.stringify(tsconfig, null, 2) + '\n',
        'tsconfig.development.json': JSON.stringify(tsconfigDevelopment, null, 2) + '\n',
        'tsconfig.production.json': JSON.stringify(tsconfigProduction, null, 2) + '\n',
        src: {
          '_.ts': `export * as ${namespace} from './__.js'\n`,
          '__.ts': `// Implementation for the ${namespace} namespace.\nexport {}\n`,
        },
      },

      suggestions: [
        `Wire packages/${name} into the root solution: add { "path": "./packages/${name}/tsconfig.development.json" } to tsconfig.development.json "references", and the matching tsconfig.production.json entry.`,
        `Run \`pnpm install\` to link @kitz/${name} into the workspace.`,
      ],
    }
  },
})
