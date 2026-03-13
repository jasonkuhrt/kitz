// @ts-check
// oxlint-disable kitz/jsdoc/require-on-exports, kitz/jsdoc/usage-tags, kitz/jsdoc/require-example

/**
 * Rule: kitz/jsdoc-min-words
 *
 * JSDoc body text must meet a configurable minimum word count.
 * Prevents terse "A string utility" one-liners that provide no real guidance.
 */

import { defineExportRule } from '../lib/declarative.mjs'

const DEFAULT_MIN_WORDS = 5

/** @param {string} filename */
function isBarrelOrNamespaceFile(filename) {
  return /[/\\](__?\.ts|__?\.mts)$/.test(filename)
}

export const jsdocMinWordsRule = defineExportRule({
  meta: {
    type: `problem`,
    schema: [
      {
        type: `object`,
        properties: {
          minWords: { type: `number` },
        },
        additionalProperties: false,
      },
    ],
    docs: {
      description: `Require a minimum word count in JSDoc body text on exported declarations.`,
      rationale: `Terse one-or-two-word JSDoc comments like "A string utility" provide no real guidance; enforcing a minimum word count pushes authors to describe behavior, use cases, and key details.`,
      fixGuidance: `Expand the JSDoc body to describe what the export does, its key behaviors, and when to use it.`,
    },
    messages: {
      weakJsdoc: `JSDoc on '{{name}}' has only {{count}} words (minimum {{min}}). Describe what this does, its key behaviors, and when to use it.`,
    },
  },
  fileFilter: (filename) => !isBarrelOrNamespaceFile(filename),
  where: (fact) => {
    if (!fact.jsdoc.isPresent) return false
    return true
  },
  findings: (fact) => {
    // TODO: access rule options for configurable minWords
    const min = DEFAULT_MIN_WORDS
    const count = fact.jsdoc.wordCount()
    if (count >= min) return null
    return {
      messageId: `weakJsdoc`,
      data: {
        name: fact.name,
        count: String(count),
        min: String(min),
      },
    }
  },
})
