import { Err, Str } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'conf', 'file'] as const

/**
 * Config file not found at any of the expected locations.
 */
export const NotFoundError = Err.TaggedContextualError(
  'KitConfFileNotFoundError',
  baseTags,
  {
    context: S.Struct({
      /** Name of the config (e.g., 'release') */
      name: S.String,
      /** Directory that was searched */
      cwd: S.String,
      /** File patterns that were searched */
      patterns: S.Array(S.String),
    }),
    message: (ctx) => `Config file not found: ${ctx.name}`,
  },
)

export type NotFoundError = InstanceType<typeof NotFoundError>

/**
 * Generate a helpful hint for NotFoundError.
 */
export const notFoundHint = (error: NotFoundError): string => {
  const { name, cwd, patterns } = error.context
  const b = Str.Builder()
  b`No config file found for "${name}" in ${cwd}`
  b()
  b`Searched for:`
  for (const p of patterns) {
    b`  - ${p}`
  }
  b()
  b`Create one of these files to configure ${name}.`
  return b.render()
}

/**
 * Config file exists but has invalid or missing default export.
 */
export const InvalidExportError = Err.TaggedContextualError(
  'KitConfFileInvalidExportError',
  baseTags,
  {
    context: S.Struct({
      /** Path to the config file */
      path: S.String,
      /** What was found instead of expected export */
      found: S.String,
    }),
    message: (ctx) => `Invalid config export in ${ctx.path}`,
  },
)

export type InvalidExportError = InstanceType<typeof InvalidExportError>

/**
 * Generate a helpful hint for InvalidExportError.
 */
export const invalidExportHint = (error: InvalidExportError): string => {
  const { path, found } = error.context
  const b = Str.Builder()
  b`Config file at ${path} has invalid export.`
  b()
  b`Expected: default export with config object`
  b`Found: ${found}`
  b()
  b`Example:`
  b`  export default {`
  b`    // your config here`
  b`  }`
  b()
  b`Or use defineConfig for type safety:`
  b`  import { defineConfig } from 'your-tool'`
  b`  export default defineConfig({ ... })`
  return b.render()
}
