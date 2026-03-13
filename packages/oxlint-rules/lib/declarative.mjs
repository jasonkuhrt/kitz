// @ts-check
// oxlint-disable kitz/jsdoc/usage-tags, kitz/jsdoc/require-example

/**
 * Declarative rule framework for kitz oxlint rules.
 *
 * Inspired by Heartbeat's `component-declarative.ts`, adapted for kitz's
 * export model (_.ts/__.ts barrels, namespace files, package exports).
 *
 * Rules declare `meta`, optional `where` filter, and `findings` callback.
 * The framework handles AST traversal, JSDoc extraction, and fact building.
 */

import { defineRule } from 'oxlint'
import { getJSDocForNode } from './jsdoc.mjs'

/**
 * @typedef {import('oxlint').ESTree.Node} Node
 * @typedef {import('oxlint').ESTree.ExportNamedDeclaration} ExportNamedDeclaration
 * @typedef {import('oxlint').ESTree.ExportDefaultDeclaration} ExportDefaultDeclaration
 */

/**
 * @typedef {object} ExportFact
 * @property {string}                    name      — exported identifier name
 * @property {import('./jsdoc.mjs').JSDocFact} jsdoc    — parsed JSDoc
 * @property {string}                    kind      — 'function' | 'class' | 'type' | 'interface' | 'variable' | 'enum' | 'unknown'
 * @property {Node}                      node      — AST node for location reporting
 * @property {boolean}                   isTypeOnly — true for type/interface exports
 */

/**
 * @typedef {object} Finding
 * @property {string}                     messageId
 * @property {Record<string, string>=}    data
 * @property {Node=}                      node
 */

/**
 * @typedef {object} ExportRuleSpec
 * @property {import('oxlint').RuleMeta}  meta
 * @property {((fact: ExportFact) => boolean)=}  where     — optional filter
 * @property {(fact: ExportFact) => Finding | Finding[] | null | undefined} findings
 * @property {((filename: string) => boolean)=}  fileFilter — optional file-level filter
 */

/**
 * Normalize findings to an array.
 *
 * @param {Finding | Finding[] | null | undefined} result
 * @returns {Finding[]}
 */
function normalizeFindings(result) {
  if (result == null) return []
  if (Array.isArray(result)) return result.filter(Boolean)
  return [result]
}

/**
 * Extract the name from a declaration node.
 *
 * @param {Node} node
 * @returns {string}
 */
function getDeclarationName(node) {
  // @ts-expect-error — id/name may not exist on all node types
  if (node.id?.name) return node.id.name

  // VariableDeclaration → first declarator
  // @ts-expect-error
  if (node.type === `VariableDeclaration` && node.declarations?.[0]?.id?.name) {
    // @ts-expect-error
    return node.declarations[0].id.name
  }

  return `(anonymous)`
}

/**
 * Classify a declaration node into a kind string.
 *
 * @param {Node} node
 * @returns {ExportFact['kind']}
 */
function getDeclarationKind(node) {
  switch (node.type) {
    case `FunctionDeclaration`:
      return `function`
    case `ClassDeclaration`:
      return `class`
    case `TSTypeAliasDeclaration`:
      return `type`
    case `TSInterfaceDeclaration`:
      return `interface`
    case `TSEnumDeclaration`:
      return `enum`
    case `VariableDeclaration`:
      return `variable`
    default:
      return `unknown`
  }
}

/**
 * Check if a declaration is type-only (type alias or interface).
 *
 * @param {Node} node
 * @returns {boolean}
 */
function isTypeOnlyDeclaration(node) {
  return node.type === `TSTypeAliasDeclaration` || node.type === `TSInterfaceDeclaration`
}

/**
 * Build export facts from an ExportNamedDeclaration.
 *
 * @param {import('oxlint').SourceCode} sourceCode
 * @param {ExportNamedDeclaration} exportNode
 * @returns {ExportFact[]}
 */
function factsFromNamedExport(sourceCode, exportNode) {
  // Re-exports like `export { X } from './X'` — skip, they're not own declarations
  if (exportNode.source) return []

  const declaration = /** @type {Node | null} */ (exportNode.declaration)

  if (!declaration) {
    // `export { X, Y }` specifiers — skip, they reference declarations elsewhere
    return []
  }

  // VariableDeclaration can have multiple declarators
  if (declaration.type === `VariableDeclaration`) {
    // @ts-expect-error
    return declaration.declarations.map((declarator) => ({
      name: declarator.id?.name ?? `(anonymous)`,
      jsdoc: getJSDocForNode(sourceCode, exportNode),
      kind: /** @type {const} */ (`variable`),
      node: exportNode,
      isTypeOnly: false,
    }))
  }

  return [
    {
      name: getDeclarationName(declaration),
      jsdoc: getJSDocForNode(sourceCode, exportNode),
      kind: getDeclarationKind(declaration),
      node: exportNode,
      isTypeOnly: isTypeOnlyDeclaration(declaration),
    },
  ]
}

/**
 * Define a rule that operates on exported declarations.
 *
 * The rule visits all `export` statements in a file, builds ExportFacts,
 * applies the optional `where` filter, and reports findings.
 *
 * @param {ExportRuleSpec} spec
 */
export function defineExportRule(spec) {
  return defineRule({
    meta: spec.meta,
    createOnce(context) {
      return {
        before() {
          if (spec.fileFilter) {
            const filename = context.filename || context.getFilename()
            return spec.fileFilter(filename)
          }
          return true
        },

        /** @param {ExportNamedDeclaration} node */
        ExportNamedDeclaration(node) {
          const facts = factsFromNamedExport(context.sourceCode, node)

          for (const fact of facts) {
            if (spec.where && !spec.where(fact)) continue
            for (const finding of normalizeFindings(spec.findings(fact))) {
              context.report({
                messageId: finding.messageId,
                node: finding.node ?? fact.node,
                ...(finding.data ? { data: finding.data } : {}),
              })
            }
          }
        },

        /** @param {ExportDefaultDeclaration} node */
        ExportDefaultDeclaration(node) {
          const declaration = /** @type {Node} */ (node.declaration)
          const fact = {
            name: getDeclarationName(declaration),
            jsdoc: getJSDocForNode(context.sourceCode, node),
            kind: getDeclarationKind(declaration),
            node,
            isTypeOnly: false,
          }

          if (spec.where && !spec.where(fact)) return
          for (const finding of normalizeFindings(spec.findings(fact))) {
            context.report({
              messageId: finding.messageId,
              node: finding.node ?? fact.node,
              ...(finding.data ? { data: finding.data } : {}),
            })
          }
        },
      }
    },
  })
}
