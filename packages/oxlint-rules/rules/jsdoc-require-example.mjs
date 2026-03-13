// @ts-check
// oxlint-disable kitz/jsdoc/require-on-exports, kitz/jsdoc/usage-tags, kitz/jsdoc/require-example

/**
 * Rule: kitz/jsdoc-require-example
 *
 * Exported functions and values must include at least one @example tag.
 * Types and interfaces are exempt — examples are for runnable code.
 */

import { defineExportRule } from '../lib/declarative.mjs'

/** @param {string} filename */
function isBarrelOrNamespaceFile(filename) {
  return /[/\\](__?\.ts|__?\.mts)$/.test(filename)
}

export const jsdocRequireExampleRule = defineExportRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Require an @example tag on exported functions and values.`,
      rationale: `Examples are the most effective form of documentation — they show correct usage directly. Without them, consumers must guess at the API from signatures alone.`,
      fixGuidance: `Add an @example tag with a runnable code snippet showing typical usage.`,
    },
    messages: {
      missingExample: `'{{name}}' needs an @example tag with a usage snippet.`,
    },
  },
  fileFilter: (filename) => !isBarrelOrNamespaceFile(filename),
  where: (fact) => {
    // Only require @example on functions and values, not type-only exports
    if (fact.isTypeOnly) return false
    if (!fact.jsdoc.isPresent) return false
    return !fact.jsdoc.hasTag(`example`)
  },
  findings: (fact) => ({
    messageId: `missingExample`,
    data: { name: fact.name },
  }),
})
