import type { Schema } from 'effect'
import type { ConfigDefinition } from './define.js'

/**
 * Create a typed config helper function for use in config files.
 *
 * The returned function provides TypeScript inference and validation
 * for the config schema, making config files type-safe.
 *
 * @example
 * ```ts
 * // In your library
 * export const defineConfig = Conf.File.createDefineConfig(ReleaseConfig)
 *
 * // In user's release.config.ts
 * import { defineConfig } from '@kitz/release'
 *
 * export default defineConfig({
 *   trunk: 'main',
 *   // TypeScript provides autocomplete and type checking
 * })
 * ```
 */
export const createDefineConfig = <S extends Schema.Schema.AnyNoContext>(
  definition: ConfigDefinition<S>,
): (config: Schema.Schema.Type<S>) => Schema.Schema.Type<S> => {
  // Simple identity function that provides type inference
  // The actual validation happens in load()
  void definition // Used for type inference only
  return (config) => config
}
