import type { Content, Heading, Root } from 'mdast'
import { toString } from 'mdast-util-to-string'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

/**
 * Parse markdown string to AST.
 */
export const parseMarkdown = (markdown: string): Root => {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown)
}

/**
 * Convert AST nodes back to markdown string.
 */
export const toMarkdown = (nodes: Content[]): string => {
  const tree: Root = { type: 'root', children: nodes }
  return unified().use(remarkStringify).use(remarkGfm).stringify(tree).trim()
}

/**
 * Extract plain text content from AST nodes (strips formatting).
 */
export const toPlainText = (nodes: Content[]): string => {
  const tree: Root = { type: 'root', children: nodes }
  return toString(tree).trim()
}

/**
 * Extract top-level sections grouped by h1 headings.
 *
 * @returns Map of heading text → content nodes under that heading
 * @throws Error if duplicate h1 headings found
 */
export const extractH1Sections = (ast: Root): Map<string, Content[]> => {
  const sections = new Map<string, Content[]>()
  let currentHeading: string | null = null
  let currentContent: Content[] = []

  for (const node of ast.children) {
    if (node.type === 'heading' && node.depth === 1) {
      // Save previous section
      if (currentHeading !== null) {
        if (sections.has(currentHeading)) {
          throw new Error(`Duplicate section '# ${currentHeading}' found`)
        }
        sections.set(currentHeading, currentContent)
      }

      // Start new section
      currentHeading = toString(node)
      currentContent = []
    } else if (currentHeading !== null) {
      // Add content to current section
      currentContent.push(node)
    }
    // Ignore content before first h1
  }

  // Save final section
  if (currentHeading !== null) {
    if (sections.has(currentHeading)) {
      throw new Error(`Duplicate section '# ${currentHeading}' found`)
    }
    sections.set(currentHeading, currentContent)
  }

  return sections
}

/**
 * Extract h2 subsections with their content.
 *
 * @param sectionContent - Content nodes from an h1 section
 * @returns Array of { heading, content } for each h2
 */
export const extractH2Subsections = (
  sectionContent: Content[],
): Array<{ heading: string; content: Content[] }> => {
  const subsections: Array<{ heading: string; content: Content[] }> = []
  let currentHeading: string | null = null
  let currentContent: Content[] = []

  for (const node of sectionContent) {
    if (node.type === 'heading' && node.depth === 2) {
      // Save previous subsection
      if (currentHeading !== null) {
        subsections.push({ heading: currentHeading, content: currentContent })
      }

      // Start new subsection
      currentHeading = toString(node)
      currentContent = []
    } else if (currentHeading !== null) {
      // Add content to current subsection
      currentContent.push(node)
    }
    // Ignore content before first h2
  }

  // Save final subsection
  if (currentHeading !== null) {
    subsections.push({ heading: currentHeading, content: currentContent })
  }

  return subsections
}
