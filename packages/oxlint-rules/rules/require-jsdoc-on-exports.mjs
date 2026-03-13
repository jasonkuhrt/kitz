// @ts-check
// oxlint-disable kitz/jsdoc/require-on-exports, kitz/jsdoc/usage-tags, kitz/jsdoc/require-example

/**
 * Rule: kitz/require-jsdoc-on-exports
 *
 * Every exported declaration (type or value) must have a JSDoc comment.
 * Re-exports and barrel files are excluded.
 */

import { defineExportRule } from '../lib/declarative.mjs'

/** @param {string} filename */
function isBarrelOrNamespaceFile(filename) {
  return /[/\\](__?\.ts|__?\.mts)$/.test(filename)
}

export const requireJsdocOnExportsRule = defineExportRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Require JSDoc on every exported declaration.`,
      rationale: `Undocumented exports force consumers to read source code. Requiring JSDoc ensures IDE tooltips always provide actionable guidance.`,
      fixGuidance: `Add a /** ... */ comment above the export describing what it does and when to use it.`,
    },
    messages: {
      missingJsdoc: `'{{name}}' is exported without JSDoc. Add /** ... */ describing what it does and when to use it.`,
    },
  },
  fileFilter: (filename) => !isBarrelOrNamespaceFile(filename),
  where: (fact) => !fact.jsdoc.isPresent,
  findings: (fact) => ({
    messageId: `missingJsdoc`,
    data: { name: fact.name },
  }),
})
