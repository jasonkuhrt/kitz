import { Schema as S } from 'effect'

/**
 * Schema for validating file extensions.
 * POSIX-compliant: extensions can contain any character except / (path separator) and NUL.
 * In JavaScript context, we only need to exclude / since strings can't contain NUL.
 */
export const Extension = S.String.pipe(
  S.pattern(/^\.[^/]+$/),
  // S.brand('Extension'),
  S.annotations({
    identifier: 'Extension',
    description: 'A file extension starting with a dot (POSIX-compliant)',
  }),
)

/**
 * A branded type for file extensions.
 * POSIX-compliant: must start with a dot followed by any characters except /.
 */
export type Extension = typeof Extension.Type

/**
 * Create an Extension from a string.
 *
 * @param ext - The extension string (must start with dot)
 * @returns A branded Extension
 */
export const make = (ext: string): Extension => Extension.make(ext)

/**
 * Common file extensions as branded constants.
 */
export const Extensions = {
  // JavaScript
  js: make('.js'),
  mjs: make('.mjs'),
  cjs: make('.cjs'),
  jsx: make('.jsx'),

  // TypeScript
  ts: make('.ts'),
  mts: make('.mts'),
  cts: make('.cts'),
  tsx: make('.tsx'),
  dts: make('.d.ts'),

  // Build artifacts
  map: make('.map'),

  // Data formats
  json: make('.json'),
  jsonc: make('.jsonc'),
  yaml: make('.yaml'),
  yml: make('.yml'),

  // Markup
  md: make('.md'),
  mdx: make('.mdx'),
  html: make('.html'),

  // GraphQL
  graphql: make('.graphql'),
  gql: make('.gql'),

  // Collections
  buildArtifacts: [make('.map'), make('.d.ts')],
  executable: [
    make('.js'),
    make('.mjs'),
    make('.cjs'),
    make('.jsx'),
    make('.ts'),
    make('.mts'),
    make('.cts'),
    make('.tsx'),
  ],
} as const
