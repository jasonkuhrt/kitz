// @ts-check
// oxlint-disable kitz/jsdoc/require-on-exports, kitz/jsdoc/usage-tags, kitz/jsdoc/require-example

/**
 * Rule: kitz/jsdoc-no-name-restate
 *
 * JSDoc must not restate the symbol name in the first sentence.
 * The name is already visible in IDE tooltips — lead with what it does.
 */

import { defineExportRule } from '../lib/declarative.mjs'

/** @param {string} filename */
function isBarrelOrNamespaceFile(filename) {
  return /[/\\](__?\.ts|__?\.mts)$/.test(filename)
}

/**
 * @param {string} body
 * @param {string} name
 * @returns {boolean}
 */
function restatesName(body, name) {
  if (!body || name === `(anonymous)`) return false
  const firstSentence = body.split(/[.\n]/)[0] ?? ``
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)
  return new RegExp(`\\b${escaped}\\b`, `i`).test(firstSentence)
}

export const jsdocNoNameRestateRule = defineExportRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Forbid JSDoc from restating the export name in the first sentence.`,
      rationale: `The symbol name is already visible in the IDE tooltip header; restating it wastes the most prominent line of documentation on redundant information.`,
      fixGuidance: `Start the JSDoc with what the export does or provides, not its name. For example, instead of "filter filters an array...", write "Keeps elements matching a predicate...".`,
    },
    messages: {
      nameRestate: `JSDoc on '{{name}}' restates the symbol name. Lead with what it does, not what it's called.`,
    },
  },
  fileFilter: (filename) => !isBarrelOrNamespaceFile(filename),
  where: (fact) => fact.jsdoc.isPresent && restatesName(fact.jsdoc.body, fact.name),
  findings: (fact) => ({
    messageId: `nameRestate`,
    data: { name: fact.name },
  }),
})
