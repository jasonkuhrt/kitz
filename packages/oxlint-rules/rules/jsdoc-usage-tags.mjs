// @ts-check
// oxlint-disable kitz/jsdoc/require-on-exports, kitz/jsdoc/usage-tags, kitz/jsdoc/require-example

/**
 * Rule: kitz/jsdoc-usage-tags
 *
 * Exported functions must include the usage-intent tag rubric:
 *   @purpose     — what problem this solves
 *   @useWhen     — when to reach for this
 *   @useInstead  — the alternative and when to prefer it
 *
 * Types/interfaces are exempt. These tags enable both humans and AI agents
 * to make correct choices about which export to use.
 */

import { defineExportRule } from '../lib/declarative.mjs'

/** @param {string} filename */
function isBarrelOrNamespaceFile(filename) {
  return /[/\\](__?\.ts|__?\.mts)$/.test(filename)
}

const REQUIRED_TAGS = [`purpose`, `useWhen`, `useInstead`]

const TAG_DESCRIPTIONS = {
  purpose: `what this is for`,
  useWhen: `when a consumer should reach for this`,
  useInstead: `name the alternative and when to prefer it`,
}

export const jsdocUsageTagsRule = defineExportRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Require @purpose, @useWhen, and @useInstead JSDoc tags on exported functions and values.`,
      rationale: `Usage-intent tags prevent API proliferation by making each export's niche explicit, so consumers know which export to reach for without trial and error.`,
      fixGuidance: `Add @purpose (what this is for), @useWhen (when to reach for it), and @useInstead (name the alternative and when to prefer it) JSDoc tags.`,
    },
    messages: {
      missingPurpose: `'{{name}}' must document @purpose — what this is for.`,
      missingUseWhen: `'{{name}}' must document @useWhen — when a consumer should reach for this.`,
      missingUseInstead: `'{{name}}' must document @useInstead — name the alternative and when to prefer it.`,
    },
  },
  fileFilter: (filename) => !isBarrelOrNamespaceFile(filename),
  where: (fact) => {
    if (fact.isTypeOnly) return false
    if (!fact.jsdoc.isPresent) return false
    return true
  },
  findings: (fact) => {
    /** @type {import('../lib/declarative.mjs').Finding[]} */
    const findings = []

    if (!fact.jsdoc.hasTag(`purpose`)) {
      findings.push({
        messageId: `missingPurpose`,
        data: { name: fact.name },
      })
    }

    if (!fact.jsdoc.hasTag(`useWhen`)) {
      findings.push({
        messageId: `missingUseWhen`,
        data: { name: fact.name },
      })
    }

    if (!fact.jsdoc.hasTag(`useInstead`)) {
      findings.push({
        messageId: `missingUseInstead`,
        data: { name: fact.name },
      })
    }

    return findings
  },
})
