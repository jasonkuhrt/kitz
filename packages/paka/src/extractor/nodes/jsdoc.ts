import {
  TSDocConfiguration,
  TSDocParser,
  TSDocTagDefinition,
  TSDocTagSyntaxKind,
} from '@microsoft/tsdoc'
import { JSDoc, Node } from 'ts-morph'
import { Example } from '../../schema.js'

/**
 * Parsed JSDoc information.
 */
export type JSDocInfo = {
  description: string | undefined
  guide: string | undefined
  examples: Example[]
  deprecated: string | undefined
  category: string | undefined
  tags: Record<string, string>
  /** Force this export to be treated as a namespace */
  forceNamespace?: boolean
  /** Mark this export as a builder pattern entry point */
  isBuilder?: boolean
  /** Mark this export as internal (should not appear in public documentation) */
  internal?: boolean
  /** Parameter descriptions from @param tags (name -> description) */
  params: Record<string, string>
  /** Return value description from @returns tag */
  returns: string | undefined
  /** Error descriptions from @throws tags */
  throws: string[]
}

/**
 * Helper to extract plain text from a TSDoc DocNode tree.
 * Uses only public APIs from @microsoft/tsdoc.
 */
const extractTSDocText = (node: any): string => {
  switch (node.kind) {
    case 'PlainText':
      return node.text || ''

    case 'LinkTag': {
      // Extract link destination as text
      if (node.codeDestination) {
        return node.codeDestination.emitAsTsdoc()
      }
      if (node.urlDestination) {
        return node.urlDestination
      }
      if (node.linkText) {
        return node.linkText
      }
      return ''
    }

    case 'FencedCode':
      return `\`\`\`${node.language || ''}\n${node.code}\n\`\`\``

    case 'CodeSpan':
      return `\`${node.code || ''}\``

    case 'Paragraph':
      // Paragraphs contain inline content that should flow together
      if ('nodes' in node && Array.isArray(node.nodes)) {
        return node.nodes.map((child: any) => extractTSDocText(child)).join('')
      }
      return ''

    case 'Section':
    case 'Block':
      // These are containers - recursively process their nodes
      // Join with double newlines to ensure proper spacing between block-level markdown elements
      if ('nodes' in node && Array.isArray(node.nodes)) {
        return node.nodes.map((child: any) => extractTSDocText(child)).join('\n\n')
      }
      return ''

    case 'SoftBreak':
      return ' '

    default:
      // For unknown node types, try to get child nodes
      if ('nodes' in node && Array.isArray(node.nodes)) {
        return node.nodes.map((child: any) => extractTSDocText(child)).join('')
      }
      return ''
  }
}

/**
 * Parse examples from TSDoc customBlocks.
 */
const parseExamplesFromTSDoc = (customBlocks: readonly any[]): Example[] => {
  const examples: Example[] = []

  for (const block of customBlocks) {
    if (block.blockTag.tagName === '@example') {
      const contentNodes = block.content.nodes

      let title: string | undefined
      let code: string | undefined
      let language = 'typescript' // default
      let twoslashEnabled = true // default

      for (const node of contentNodes) {
        if (node.kind === 'Paragraph' && !title) {
          // Extract title from first paragraph if it's not empty
          const text = extractTSDocText(node).trim()
          if (text) {
            title = text
          }
        } else if (node.kind === 'FencedCode') {
          code = node.code
          language = node.language === 'ts' ? 'typescript' : node.language || 'typescript'

          // Check for twoslash disable
          const codeContent = node.code || ''
          twoslashEnabled =
            !codeContent.includes('// twoslash-disable') &&
            !codeContent.includes('// @twoslash-disable')
        }
      }

      if (code) {
        examples.push(
          new Example({
            code: code.trim(),
            title,
            twoslashEnabled,
            language,
          }),
        )
      }
    }
  }

  return examples
}

/**
 * Parse a raw JSDoc comment string using @microsoft/tsdoc.
 * Returns parsed JSDoc information with proper structure.
 */
const parseJSDocWithTSDoc = (commentText: string): JSDocInfo => {
  // Configure TSDoc to recognize custom tags
  // Note: @throws and @internal are already standard TSDoc tags, no need to add them
  const configuration = new TSDocConfiguration()
  configuration.addTagDefinition(
    new TSDocTagDefinition({
      tagName: '@category',
      syntaxKind: TSDocTagSyntaxKind.BlockTag,
      allowMultiple: false,
    }),
  )
  configuration.addTagDefinition(
    new TSDocTagDefinition({
      tagName: '@builder',
      syntaxKind: TSDocTagSyntaxKind.ModifierTag,
      allowMultiple: false,
    }),
  )
  configuration.addTagDefinition(
    new TSDocTagDefinition({
      tagName: '@guide',
      syntaxKind: TSDocTagSyntaxKind.BlockTag,
      allowMultiple: false,
    }),
  )

  const tsdocParser = new TSDocParser(configuration)
  const parserContext = tsdocParser.parseString(commentText)
  const docComment = parserContext.docComment

  // Extract description from summary section
  const description = extractTSDocText(docComment.summarySection).trim() || undefined

  // Extract examples from custom blocks
  const examples = parseExamplesFromTSDoc(docComment.customBlocks)

  // Extract deprecated message
  const deprecated = docComment.deprecatedBlock
    ? extractTSDocText(docComment.deprecatedBlock.content).trim() || undefined
    : undefined

  // Extract other tags
  const tags: Record<string, string> = {}
  let forceNamespace = false
  let isBuilder = false
  let internal = false
  let category: string | undefined
  let guide: string | undefined

  // Check for @builder and @internal in modifier tags
  for (const tag of docComment.modifierTagSet.nodes) {
    if (tag.tagName === '@builder') {
      isBuilder = true
    } else if (tag.tagName === '@internal') {
      internal = true
    }
  }

  // Check for @namespace in modifier tags or custom blocks
  for (const block of docComment.customBlocks) {
    const tagName = block.blockTag.tagName
    if (tagName === '@namespace') {
      forceNamespace = true
    } else if (tagName === '@category') {
      category = extractTSDocText(block.content).trim() || undefined
    } else if (tagName === '@guide') {
      guide = extractTSDocText(block.content).trim() || undefined
    } else if (tagName !== '@example') {
      // Store other custom tags
      tags[tagName.slice(1)] = extractTSDocText(block.content).trim()
    }
  }

  // Extract @param tags
  const params: Record<string, string> = {}
  for (const paramBlock of docComment.params.blocks) {
    const paramName = paramBlock.parameterName
    const paramDesc = extractTSDocText(paramBlock.content).trim()
    if (paramName && paramDesc) {
      params[paramName] = paramDesc
    }
  }

  // Extract @returns tag
  const returns = docComment.returnsBlock
    ? extractTSDocText(docComment.returnsBlock.content).trim() || undefined
    : undefined

  // Extract @throws tags
  const throws: string[] = []
  for (const block of docComment.customBlocks) {
    if (block.blockTag.tagName === '@throws') {
      const throwsDesc = extractTSDocText(block.content).trim()
      if (throwsDesc) {
        throws.push(throwsDesc)
      }
    }
  }

  return {
    description,
    guide,
    examples,
    deprecated,
    category,
    tags,
    forceNamespace,
    isBuilder,
    internal,
    params,
    returns,
    throws,
  }
}

/**
 * Parse JSDoc from a declaration node.
 *
 * @param decl - The declaration node to extract JSDoc from
 * @returns Parsed JSDoc information
 */
export const parseJSDoc = (decl: Node): JSDocInfo => {
  // Try to get JSDoc using the proper API
  let jsDocs: JSDoc[] = []

  // For VariableDeclaration, JSDoc is on the parent VariableStatement
  let jsdocNode: Node = decl
  if (Node.isVariableDeclaration(decl)) {
    const parent = decl.getParent()
    if (parent && Node.isVariableDeclarationList(parent)) {
      const grandparent = parent.getParent()
      if (grandparent && Node.isVariableStatement(grandparent)) {
        jsdocNode = grandparent
      }
    }
  }

  // Different node types have different ways to get JSDoc
  if ('getJsDocs' in jsdocNode && typeof (jsdocNode as any).getJsDocs === 'function') {
    jsDocs = (jsdocNode as any).getJsDocs()
  }

  // ExportDeclaration nodes don't have getJsDocs(), so parse from leading comments using TSDoc
  if (jsDocs.length === 0 && Node.isExportDeclaration(jsdocNode)) {
    const leadingComments = jsdocNode.getLeadingCommentRanges()
    for (const comment of leadingComments) {
      const commentText = comment.getText()
      // Check if it's a JSDoc comment (/** ... */)
      if (commentText.startsWith('/**') && commentText.endsWith('*/')) {
        // Parse using TSDoc directly
        return parseJSDocWithTSDoc(commentText)
      }
    }
  }

  if (jsDocs.length === 0) {
    return {
      description: undefined,
      guide: undefined,
      examples: [],
      deprecated: undefined,
      category: undefined,
      tags: {},
      forceNamespace: false,
      isBuilder: false,
      internal: false,
      params: {},
      returns: undefined,
      throws: [],
    }
  }

  // Use the first JSDoc block (closest to declaration)
  const jsDoc = jsDocs[0]!

  // Get the full JSDoc comment text and parse with TSDoc
  const fullText = jsDoc.getFullText()
  return parseJSDocWithTSDoc(fullText)
}
