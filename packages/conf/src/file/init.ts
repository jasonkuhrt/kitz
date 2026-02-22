import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Data, Effect, type Schema } from 'effect'
import type { ConfigDefinition } from './define.js'

// ────────────────────────────────────────────────────────────────────────────────
// Init Result
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Result of a config file initialization operation.
 *
 * Tagged union that explicitly represents whether the file was created
 * or already existed.
 */
export type InitResult = Data.TaggedEnum<{
  /** Config file was created at the given path */
  readonly Created: { readonly path: Fs.Path.AbsFile }
  /** Config file already exists, no action taken */
  readonly AlreadyExists: {}
}>

/**
 * Constructors for InitResult tagged union.
 */
export const InitResult = Data.taggedEnum<InitResult>()

/**
 * Options for the defineConfig import in the generated template.
 */
export interface DefineConfigImport {
  /**
   * The module specifier (the string after `from` in an import statement).
   *
   * @example '@kitz/release'
   */
  readonly specifier: string
  /**
   * The named export to import.
   *
   * @example 'defineConfig'
   */
  readonly namedExport: string
}

/**
 * Options for initializing a config file.
 */
export interface InitOptions {
  /**
   * Import configuration for the defineConfig helper.
   *
   * Used to generate the import statement and default export call.
   */
  readonly defineConfigImport: DefineConfigImport
  /**
   * Directory to write the config file to.
   *
   * @default Env.cwd
   */
  readonly directory?: Fs.Path.AbsDir
}

/**
 * Generate the config file template string.
 *
 * The template uses an empty object `{}` as the config value.
 * If the schema has required fields, the generated file will have
 * type errors in the user's IDE, prompting them to fill in the required values.
 */
export const template = (
  definition: ConfigDefinition<Schema.Schema.AnyNoContext>,
  options: InitOptions,
): string => {
  const { namedExport, specifier } = options.defineConfigImport
  return `import { ${namedExport} } from '${specifier}'

export default ${namedExport}({})
`
}

/**
 * Initialize a config file in the target directory.
 *
 * Writes a minimal config file template that imports the defineConfig helper
 * and exports a default config object.
 *
 * Returns a tagged union indicating whether the file was created or already existed.
 *
 * The generated file uses an empty object `{}` as the initial config.
 * If the schema has required fields, the generated file will produce
 * type errors in the user's IDE, prompting them to provide the required values.
 *
 * @example
 * ```ts
 * // In your CLI init command:
 * const result = yield* Conf.File.init(ReleaseConfigFile, {
 *   defineConfigImport: {
 *     specifier: '@kitz/release',
 *     namedExport: 'defineConfig',
 *   },
 * })
 *
 * if (result._tag === 'Created') {
 *   yield* Console.log(`Created ${result.path}`)
 * } else {
 *   yield* Console.log(`Config already exists`)
 * }
 * ```
 */
export const init = <S extends Schema.Schema.AnyNoContext>(
  definition: ConfigDefinition<S>,
  options: InitOptions,
): Effect.Effect<InitResult, PlatformError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function*() {
    const env = yield* Env.Env
    const directory = options.directory ?? env.cwd

    // Build file path using first extension from definition
    const extension = definition.extensions[0] ?? '.ts'
    const filename = `${definition.name}.config${extension}`
    const relFile = Fs.Path.RelFile.fromString(filename)
    // join(AbsDir, RelFile) returns AbsFile
    const filePath: Fs.Path.AbsFile = Fs.Path.join(directory, relFile)

    // Check if file already exists
    const exists = yield* Fs.exists(filePath)
    if (exists) {
      return InitResult.AlreadyExists()
    }

    // Generate and write template
    const content = template(definition, options)
    yield* Fs.write(filePath, content)

    return InitResult.Created({ path: filePath })
  })
