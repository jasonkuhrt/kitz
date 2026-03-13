// Preset/config module — JSDoc usage tags and examples don't apply to config objects.
// oxlint-disable kitz/jsdoc/usage-tags, kitz/jsdoc/require-example, kitz/jsdoc/no-name-restate, kitz/jsdoc/min-words
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { fileURLToPath } from 'node:url'

/**
 * Supported Oxlint severity levels.
 */
export type Severity = `off` | `warn` | `error`

/**
 * A single rule setting in an Oxlint config.
 */
export type RuleSetting = Severity | readonly [Severity, Record<string, unknown>]

/**
 * A JS plugin declaration in an Oxlint config.
 */
export interface JsPlugin {
  readonly name: string
  readonly specifier: string
}

/**
 * The subset of the Oxlint config model that this package authors directly.
 *
 * Oxlint `1.34.x` does not currently export the linter config type from its public
 * TypeScript surface, so this package carries an explicit contract for its own preset
 * objects rather than depending on an internal upstream type.
 */
export interface OxlintConfig {
  readonly plugins?: readonly string[]
  readonly jsPlugins?: readonly (string | JsPlugin)[]
  readonly categories?: Readonly<Record<string, Severity>>
  readonly rules?: Readonly<Record<string, RuleSetting>>
  readonly ignorePatterns?: readonly string[]
}

/**
 * The stable alias used by the published Kitz Oxlint plugin.
 */
export const pluginAlias = `kitz` as const

/**
 * The shared built-in Oxlint plugins that complement the Kitz ruleset.
 */
export const builtinPlugins = [`typescript`, `import`, `vitest`, `promise`] as const

/**
 * Default category severities used by the Kitz agent-engineering preset.
 */
export const categories = {
  correctness: `error`,
  suspicious: `warn`,
  perf: `warn`,
} as const satisfies NonNullable<OxlintConfig[`categories`]>

/**
 * Default paths ignored by the Kitz agent-engineering preset.
 */
export const ignorePatterns = [
  `**/build/**`,
  `**/node_modules/**`,
  `**/*.d.ts`,
  `**/__examples__/**`,
] as const satisfies NonNullable<OxlintConfig[`ignorePatterns`]>

const pluginPath = fileURLToPath(new URL(`../plugin.mjs`, import.meta.url))

/**
 * The JS plugin entry used by `oxlint.config.ts` consumers.
 *
 * The specifier is resolved to an absolute installed package path at runtime so the
 * config object remains relocatable when imported from another project.
 */
export const jsPlugin = {
  name: pluginAlias,
  specifier: pluginPath,
} as const satisfies NonNullable<OxlintConfig[`jsPlugins`]>[number]

/**
 * Warning-level rule defaults for Kitz-first agent engineering.
 */
export const recommendedRules = {
  'eslint/no-unused-vars': `off`,
  'eslint/no-unused-expressions': [`error`, { allowTaggedTemplates: true }],
  'eslint/no-control-regex': `off`,
  'typescript/no-explicit-any': `off`,
  'typescript/no-unsafe-type-assertion': `off`,
  'typescript/no-unnecessary-type-assertion': `warn`,
  'eslint-plugin-import/no-unassigned-import': `off`,
  'eslint-plugin-promise/no-new-statics': `warn`,
  'eslint-plugin-promise/no-callback-in-promise': `warn`,
  'eslint-plugin-promise/prefer-await-to-then': `off`,
  'kitz/schema/no-json-parse': `warn`,
  'kitz/error/no-try-catch': `off`,
  'kitz/effect/no-native-promise-construction': `warn`,
  'kitz/ts/no-type-assertion': `off`,
  'kitz/domain/no-native-map-set': `warn`,
  'kitz/module/no-nodejs-builtins': `warn`,
  'kitz/module/resolver-platform-dispatch': `warn`,
  'kitz/schema/schema-parsing-contract': `warn`,
  'kitz/error/no-throw': `off`,
  'kitz/effect/no-promise-then-chain': `warn`,
  'kitz/effect/no-effect-run-in-library-code': `warn`,
  'kitz/error/require-typed-effect-errors': `warn`,
  'kitz/schema/require-schema-decode': `warn`,
  'kitz/domain/no-process-env': `warn`,
  'kitz/domain/no-date-now': `warn`,
  'kitz/domain/no-math-random': `warn`,
  'kitz/domain/no-console': `warn`,
  'kitz/error/require-tagged-error-types': `warn`,
  'kitz/module/namespace-file-conventions': `warn`,
  'kitz/module/barrel-file-conventions': `warn`,
  'kitz/module/module-structure-conventions': `warn`,
  'kitz/module/no-deep-imports': `warn`,
  'kitz/module/prefer-subpath-imports': `warn`,
  'kitz/module/subpath-imports-integrity': [
    `warn`,
    { requiredEntryPatterns: [`src/*/_.ts`, `src/*/core/_.ts`] },
  ],
  'kitz/jsdoc/require-on-exports': `warn`,
  'kitz/jsdoc/min-words': [`warn`, { minWords: 5 }],
  'kitz/jsdoc/no-name-restate': `warn`,
  'kitz/jsdoc/require-example': `warn`,
  'kitz/jsdoc/usage-tags': `warn`,
  'kitz/jsdoc/no-weasel-words': `warn`,
} as const satisfies NonNullable<OxlintConfig[`rules`]>

/**
 * Error-level overrides for teams that want the Kitz ruleset to gate CI.
 */
export const strictRuleOverrides = {
  'kitz/schema/no-json-parse': `error`,
  'kitz/effect/no-native-promise-construction': `error`,
  'kitz/domain/no-native-map-set': `error`,
  'kitz/module/no-nodejs-builtins': `error`,
  'kitz/module/resolver-platform-dispatch': `error`,
  'kitz/schema/schema-parsing-contract': `error`,
  'kitz/effect/no-promise-then-chain': `error`,
  'kitz/effect/no-effect-run-in-library-code': `error`,
  'kitz/error/require-typed-effect-errors': `error`,
  'kitz/schema/require-schema-decode': `error`,
  'kitz/domain/no-process-env': `error`,
  'kitz/domain/no-date-now': `error`,
  'kitz/domain/no-math-random': `error`,
  'kitz/domain/no-console': `error`,
  'kitz/error/require-tagged-error-types': `error`,
  'kitz/module/namespace-file-conventions': `error`,
  'kitz/module/barrel-file-conventions': `error`,
  'kitz/module/module-structure-conventions': `error`,
  'kitz/module/no-deep-imports': `error`,
  'kitz/module/prefer-subpath-imports': `error`,
  'kitz/module/subpath-imports-integrity': [
    `error`,
    { requiredEntryPatterns: [`src/*/_.ts`, `src/*/core/_.ts`] },
  ],
  'kitz/jsdoc/require-on-exports': `error`,
  'kitz/jsdoc/min-words': [`error`, { minWords: 5 }],
  'kitz/jsdoc/no-name-restate': `error`,
  'kitz/jsdoc/require-example': `error`,
  'kitz/jsdoc/usage-tags': `error`,
  'kitz/jsdoc/no-weasel-words': `error`,
} as const satisfies NonNullable<OxlintConfig[`rules`]>

/**
 * The warning-level Kitz agent-engineering preset as a typed config object.
 *
 * @example
 * ```ts
 * import { OxlintRules } from '@kitz/oxlint-rules'
 *
 * const config = {
 *   ...OxlintRules.recommendedConfig,
 * }
 * ```
 */
export const recommendedConfig = {
  plugins: [...builtinPlugins],
  jsPlugins: [jsPlugin],
  categories,
  rules: recommendedRules,
  ignorePatterns: [...ignorePatterns],
} as const satisfies OxlintConfig

/**
 * The error-level Kitz agent-engineering preset as a typed config object.
 *
 * @example
 * ```ts
 * import { OxlintRules } from '@kitz/oxlint-rules'
 *
 * const config = {
 *   ...OxlintRules.strictConfig,
 * }
 * ```
 */
export const strictConfig = {
  ...recommendedConfig,
  rules: {
    ...recommendedRules,
    ...strictRuleOverrides,
  },
} as const satisfies OxlintConfig
