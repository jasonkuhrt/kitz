/**
 * File-based configuration loading.
 *
 * Provides a unified interface for loading configuration from:
 * - TypeScript/JavaScript files (`{name}.config.ts`, etc.)
 * - JSON files (`{name}.config.json`)
 * - package.json fields
 *
 * @example
 * ```ts
 * import { Conf } from '@kitz/conf'
 * import { Schema as S } from 'effect'
 *
 * // Define config schema
 * const ConfigSchema = S.Struct({
 *   port: S.optionalWith(S.Number, { default: () => 3000 }),
 *   host: S.optionalWith(S.String, { default: () => 'localhost' }),
 * })
 *
 * // Define config file specification
 * const AppConfig = Conf.File.define({
 *   name: 'app',
 *   schema: ConfigSchema,
 *   json: true,
 * })
 *
 * // Export typed helper for config files
 * export const defineConfig = Conf.File.createDefineConfig(AppConfig)
 *
 * // Load config
 * const config = yield* Conf.File.load(AppConfig)
 * ```
 *
 * @module
 */
export * from './define-config.js'
export * from './define.js'
export * from './errors.js'
export * from './init.js'
export * from './load.js'
