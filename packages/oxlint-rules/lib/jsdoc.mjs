// @ts-check
// oxlint-disable kitz/jsdoc/usage-tags, kitz/jsdoc/require-example

/**
 * JSDoc fact model for oxlint plugin rules.
 *
 * Provides a structured API over raw Comment nodes from OxLint's sourceCode,
 * enabling declarative rules to query tags, body text, and word counts
 * without manual string parsing.
 */

/**
 * @typedef {object} JSDocTag
 * @property {string} name   — tag name without @ (e.g. "example", "param")
 * @property {string} text   — full text after the tag name
 */

/**
 * @typedef {object} JSDocFact
 * @property {boolean}              isPresent  — true when a JSDoc block exists
 * @property {string}               body       — prose before any tags
 * @property {string}               fullText   — entire JSDoc content
 * @property {ReadonlyArray<JSDocTag>} tags    — parsed tags
 * @property {(name: string) => boolean}          hasTag
 * @property {(name: string) => string}           getTagText    — first match
 * @property {(name: string) => ReadonlyArray<string>} getTagTexts — all matches
 * @property {() => number}                       wordCount
 */

const EMPTY_TAGS = /** @type {ReadonlyArray<JSDocTag>} */ ([])

/** @type {JSDocFact} */
const ABSENT_JSDOC = Object.freeze({
  isPresent: false,
  body: ``,
  fullText: ``,
  tags: EMPTY_TAGS,
  hasTag: () => false,
  getTagText: () => ``,
  getTagTexts: () => [],
  wordCount: () => 0,
})

/**
 * Count words in a string. Words are sequences of alphanumeric chars.
 *
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  return text.match(/[A-Za-z0-9_]+/g)?.length ?? 0
}

/**
 * Parse a raw JSDoc comment string into body + tags.
 *
 * Handles the `/** ... * /` wrapper, leading asterisks, and tag extraction.
 *
 * @param {string} raw — the raw comment value (between /* and * /)
 * @returns {{ body: string, tags: JSDocTag[] }}
 */
function parseJSDocContent(raw) {
  // Strip /** and */ wrapper, then leading * on each line
  const lines = raw
    .replace(/^\/\*\*\s*/, ``)
    .replace(/\s*\*\/$/, ``)
    .split(`\n`)
    .map((line) => line.replace(/^\s*\*\s?/, ``))

  const bodyLines = []
  const tags = []
  let currentTag = null

  for (const line of lines) {
    const tagMatch = line.match(/^@(\S+)\s*(.*)$/)

    if (tagMatch) {
      if (currentTag) {
        tags.push(currentTag)
      }
      currentTag = { name: tagMatch[1], text: tagMatch[2] }
      continue
    }

    if (currentTag) {
      // Continuation line of the current tag
      currentTag.text += `\n` + line
      continue
    }

    bodyLines.push(line)
  }

  if (currentTag) {
    tags.push(currentTag)
  }

  // Trim tag texts
  for (const tag of tags) {
    tag.text = tag.text.trim()
  }

  return {
    body: bodyLines.join(`\n`).trim(),
    tags,
  }
}

/**
 * Create a JSDocFact from a raw JSDoc comment string.
 *
 * @param {string} raw — the full comment text including delimiters
 * @returns {JSDocFact}
 */
export function createJSDocFact(raw) {
  const { body, tags } = parseJSDocContent(raw)

  const fullText = [body, ...tags.map((t) => `@${t.name} ${t.text}`)].filter(Boolean).join(`\n`)

  return {
    isPresent: true,
    body,
    fullText,
    tags,
    hasTag(name) {
      return tags.some((t) => t.name === name)
    },
    getTagText(name) {
      const tag = tags.find((t) => t.name === name)
      return tag ? tag.text : ``
    },
    getTagTexts(name) {
      return tags.filter((t) => t.name === name).map((t) => t.text)
    },
    wordCount() {
      return countWords(body)
    },
  }
}

/**
 * Extract the JSDoc fact for a given AST node using OxLint's sourceCode API.
 *
 * Uses `getCommentsBefore` because `getJSDocComment` is not yet implemented
 * in OxLint's JS plugin runtime (throws "not supported at present").
 * Finds the last block comment before the node that looks like a JSDoc comment.
 *
 * @param {import('@oxlint/plugins').SourceCode} sourceCode
 * @param {import('@oxlint/plugins').ESTree.Node} node
 * @returns {JSDocFact}
 */
export function getJSDocForNode(sourceCode, node) {
  const comments = sourceCode.getCommentsBefore(node)

  // Find the last Block comment that starts with * (JSDoc convention)
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i]
    if (comment.type === `Block` && comment.value.startsWith(`*`)) {
      return createJSDocFact(`/*${comment.value}*/`)
    }
  }

  return ABSENT_JSDOC
}

export { ABSENT_JSDOC }
