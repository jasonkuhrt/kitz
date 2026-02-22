import { Sch } from '@kitz/sch'
import type { Schema } from 'effect'

/**
 * Options for defining a config file.
 */
export interface DefineOptions<S extends Schema.Schema.AnyNoContext> {
  /** Name of the config (e.g., 'release'). Used to derive file patterns. */
  name: string
  /** Schema for validating the config. */
  schema: S
  /**
   * Additional file extensions to search beyond the defaults.
   * @default ['.ts', '.js', '.mjs', '.mts']
   */
  extensions?: string[]
  /**
   * Enable JSON config files.
   * - `true` → `{name}.config.json`
   * - `string` → custom filename
   * - `string[]` → multiple filenames
   * @default false
   */
  json?: boolean | string | string[]
  /**
   * Enable package.json config field.
   * - `true` → field name is `name`
   * - `string` → custom field name
   * - `string[]` → multiple field names
   * @default false
   */
  packageJson?: boolean | string | string[]
  /**
   * Custom import function for loading TS/JS files.
   * Useful for bundlers like Vite that provide their own module resolution.
   */
  importFn?: (url: string) => Promise<unknown>
}

/**
 * Resolved config definition with all options normalized.
 */
export interface ConfigDefinition<S extends Schema.Schema.AnyNoContext> {
  /** Name of the config. */
  readonly name: string
  /** Schema for validating the config. */
  readonly schema: S
  /** File extensions to search for TS/JS configs. */
  readonly extensions: readonly string[]
  /** JSON filenames to search. Empty if JSON disabled. */
  readonly json: readonly string[]
  /** package.json field names to search. Empty if disabled. */
  readonly packageJson: readonly string[]
  /** Custom import function, if provided. */
  readonly importFn?: (url: string) => Promise<unknown>
  /** Whether a config file is required (schema has required fields). */
  readonly required: boolean
}

const DEFAULT_EXTENSIONS = ['.ts', '.js', '.mjs', '.mts'] as const

/**
 * Resolve JSON option to array of filenames.
 */
const resolveJson = (name: string, json: boolean | string | string[] | undefined): string[] => {
  if (!json) return []
  if (json === true) return [`${name}.config.json`]
  if (typeof json === 'string') return [json]
  return json
}

/**
 * Resolve packageJson option to array of field names.
 */
const resolvePackageJson = (name: string, packageJson: boolean | string | string[] | undefined): string[] => {
  if (!packageJson) return []
  if (packageJson === true) return [name]
  if (typeof packageJson === 'string') return [packageJson]
  return packageJson
}

/**
 * Define a config file specification.
 *
 * Normalizes options and computes whether the config is required
 * based on whether the schema has any required fields.
 *
 * @example
 * ```ts
 * const ReleaseConfig = Conf.File.define({
 *   name: 'release',
 *   schema: ReleaseConfigSchema,
 *   json: true,
 *   packageJson: true,
 * })
 * ```
 */
export const define = <S extends Schema.Schema.AnyNoContext>(
  options: DefineOptions<S>,
): ConfigDefinition<S> => {
  const { name, schema, extensions = DEFAULT_EXTENSIONS, importFn } = options

  return {
    name,
    schema,
    extensions,
    json: resolveJson(name, options.json),
    packageJson: resolvePackageJson(name, options.packageJson),
    ...(importFn && { importFn }),
    required: Sch.Struct.hasRequiredFields(schema),
  }
}
