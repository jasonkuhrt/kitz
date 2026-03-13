// @ts-check
// oxlint-disable kitz/jsdoc/require-on-exports, kitz/jsdoc/usage-tags, kitz/jsdoc/require-example

/**
 * Rule: kitz/jsdoc-no-weasel-words
 *
 * Ban hedging and weasel words from public documentation.
 * These words add no information and undermine confidence in the API.
 */

import { defineExportRule } from '../lib/declarative.mjs'

/** @param {string} filename */
function isBarrelOrNamespaceFile(filename) {
  return /[/\\](__?\.ts|__?\.mts)$/.test(filename)
}

const WEASEL_WORDS = [
  `basically`,
  `simply`,
  `just`,
  `obviously`,
  `clearly`,
  `of course`,
  `naturally`,
  `trivially`,
  `merely`,
  `easy`,
  `easily`,
  `straightforward`,
]

const WEASEL_PATTERN = new RegExp(`\\b(${WEASEL_WORDS.join(`|`)})\\b`, `i`)

export const jsdocNoWeaselWordsRule = defineExportRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Ban hedging and weasel words from public JSDoc.`,
      rationale: `Words like "simply", "just", "obviously" add no information and can patronize readers who find the API non-obvious. They also signal that the doc author skipped writing a real explanation.`,
      fixGuidance: `Remove the weasel word and, if the sentence becomes empty, write a concrete explanation instead.`,
    },
    messages: {
      weaselWord: `JSDoc on '{{name}}' contains '{{word}}'. Remove it and write a concrete explanation instead.`,
    },
  },
  fileFilter: (filename) => !isBarrelOrNamespaceFile(filename),
  where: (fact) => fact.jsdoc.isPresent,
  findings: (fact) => {
    const match = WEASEL_PATTERN.exec(fact.jsdoc.fullText)
    if (!match) return null
    return {
      messageId: `weaselWord`,
      data: { name: fact.name, word: match[1] },
    }
  },
})
