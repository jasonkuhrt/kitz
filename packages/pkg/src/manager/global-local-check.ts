import { FileSystem } from '@effect/platform'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Option, Schema as S } from 'effect'

interface GlobalLocalCheckOptions {
  /**
   * The package name to check for (e.g., 'polen', 'eslint', etc.)
   */
  packageName: string
  /**
   * The current executable path (typically process.argv[1])
   */
  currentExecutablePath: string
  /**
   * The flag name to bypass the check (default: '--allow-global')
   */
  allowGlobalFlag?: string
  /**
   * Custom error message template
   */
  errorMessageTemplate?: {
    title?: string
    explanation?: string
    solutions?: string[]
    bypassInstructions?: string
  }
}

const DependencyMapSchema = S.Record({ key: S.String, value: S.String })
const PackageJsonSchema = S.Struct({
  dependencies: S.optionalWith(DependencyMapSchema, { default: () => ({}) }),
  devDependencies: S.optionalWith(DependencyMapSchema, { default: () => ({}) }),
  peerDependencies: S.optionalWith(DependencyMapSchema, { default: () => ({}) }),
})
const decodePackageJson = S.decodeUnknownOption(S.parseJson(PackageJsonSchema))

/**
 * Check if a package exists in any package.json from the current directory up to root
 */
const findPackageInAncestors = (
  packageName: string,
): Effect.Effect<string | null, Error, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const env = yield* Env.Env
    const currentDir = env.cwd
    const packageJsonRel = S.decodeSync(Fs.Path.RelFile.Schema)('package.json')

    // Start with package.json in current directory
    let packageJsonPath = Fs.Path.join(currentDir, packageJsonRel)

    while (true) {
      const packageJsonPathString = packageJsonPath.toString()
      const pkg = yield* fs.readFileString(packageJsonPathString).pipe(
        Effect.option,
        Effect.map(Option.flatMap(decodePackageJson)),
      )

      if (Option.isSome(pkg)) {
        const packageJson = pkg.value
        if (
          packageJson.dependencies[packageName]
          || packageJson.devDependencies[packageName]
          || packageJson.peerDependencies[packageName]
        ) {
          // Return the directory containing this package.json
          const dir = Fs.Path.up(packageJsonPath)
          return dir.toString()
        }
      }

      // Check if we're at root
      if (Fs.Path.isRoot(packageJsonPath)) {
        break
      }

      // Move package.json up one directory
      packageJsonPath = Fs.Path.up(packageJsonPath)
    }

    return null
  })

/**
 * Create a descriptive error for global vs local package conflicts
 */
function createGlobalLocalConflictError(
  packageName: string,
  projectDir: string,
  template?: GlobalLocalCheckOptions['errorMessageTemplate'],
): Error {
  const defaultSolutions = [
    `pnpm exec ${packageName} <command>`,
    `npx ${packageName} <command>`,
    `./node_modules/.bin/${packageName} <command>`,
  ]

  const title = template?.title || `Global ${packageName} running in project with local ${packageName}`
  const explanation = template?.explanation
    || `This project has ${packageName} in its package.json at ${projectDir}, but you're using a global ${packageName} installation. `
      + `This can cause version mismatches and unexpected behavior.`
  const solutions = template?.solutions || defaultSolutions
  const bypassInstructions = template?.bypassInstructions || `${packageName} <command> --allow-global`

  const message = `
${title}

${explanation}

To use the project's ${packageName}:
${solutions.map(s => `  • ${s}`).join('\n')}

To bypass this check:
  • ${bypassInstructions}
`.trim()

  return new Error(message)
}

/**
 * Check if a globally installed package is being run in a project that has the package installed locally.
 * This helps prevent version conflicts and confusion.
 *
 * @example
 * ```typescript
 * // In your CLI entry point
 * await Effect.runPromise(
 *   Effect.provide(
 *     checkGlobalVsLocal({
 *       packageName: 'my-cli',
 *       currentExecutablePath: process.argv[1]
 *     }),
 *     NodeFileSystem.layer
 *   )
 * )
 * ```
 */
export const checkGlobalVsLocal = (
  options: GlobalLocalCheckOptions,
): Effect.Effect<void, Error, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function*() {
    const {
      packageName,
      currentExecutablePath,
      allowGlobalFlag = '--allow-global',
    } = options

    // Check if running from global install
    // Common global installation patterns:
    // - pnpm: /Users/.../Library/pnpm/packagename
    // - npm: /usr/local/lib/node_modules/packagename
    // - yarn: /Users/.../config/yarn/global/node_modules/packagename
    const isGlobalInstall = currentExecutablePath.includes('pnpm/global')
      || currentExecutablePath.includes('.npm/global')
      || currentExecutablePath.includes('yarn/global')
      || currentExecutablePath.includes(`/Library/pnpm/${packageName}`)
      || currentExecutablePath.includes('/usr/local/lib/node_modules/')
      || currentExecutablePath.includes('/usr/lib/node_modules/')
      || !currentExecutablePath.includes(`node_modules/${packageName}`)

    if (!isGlobalInstall) {
      // Running from local install, all good
      return
    }

    // Check for bypass flag
    if (process.argv.includes(allowGlobalFlag)) {
      return
    }

    // Check if package exists in any ancestor package.json
    const projectDir = yield* findPackageInAncestors(packageName)

    if (projectDir) {
      return yield* Effect.fail(createGlobalLocalConflictError(packageName, projectDir, options.errorMessageTemplate))
    }
  })

/**
 * Legacy Promise-based wrapper for backward compatibility.
 * Note: Requires providing a FileSystem implementation when running.
 * @deprecated Use the Effect-based version with appropriate Effect runtime
 *
 * @example
 * ```ts
 * // You'll need to provide the FileSystem layer when using this
 * // This is just the type signature - actual usage requires the layer
 * ```
 */
export const checkGlobalVsLocalAsync = (
  options: GlobalLocalCheckOptions,
): Effect.Effect<void, Error, FileSystem.FileSystem | Env.Env> => {
  return checkGlobalVsLocal(options)
}
