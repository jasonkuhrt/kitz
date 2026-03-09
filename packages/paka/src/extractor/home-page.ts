import type { Content } from 'mdast'
import { BodySection, Feature, Home } from '../schema.js'
import {
  extractH1Sections,
  extractH2Subsections,
  parseMarkdown,
  toMarkdown,
  toPlainText,
} from './markdown.js'

/**
 * Parse home page markdown into structured Home object.
 *
 * @param markdown - Raw markdown content
 * @param filePath - Path to file (for error messages)
 * @returns Parsed Home object
 * @throws Error if markdown structure is invalid
 */
export const parseHomePage = (markdown: string, filePath: string): Home => {
  const ast = parseMarkdown(markdown)
  const sections = extractH1Sections(ast)

  // Validate sections
  validateSections(sections, filePath)

  // Parse each section
  const hero = sections.has('Hero') ? parseHeroSection(sections.get('Hero')!, filePath) : undefined
  const highlights = sections.has('Highlights')
    ? parseHighlightsSection(sections.get('Highlights')!)
    : undefined
  const body = sections.has('Body') ? parseBodySection(sections.get('Body')!) : undefined

  return Home.make({ hero, highlights, body })
}

/**
 * Validate h1 section structure.
 */
const validateSections = (sections: Map<string, Content[]>, filePath: string): void => {
  const allowedH1s = ['Hero', 'Highlights', 'Body']
  const foundH1s = Array.from(sections.keys())

  // Check for unknown h1s
  const unknownH1s = foundH1s.filter((h1) => !allowedH1s.includes(h1))
  if (unknownH1s.length > 0) {
    throw new Error(
      `Invalid heading${unknownH1s.length > 1 ? 's' : ''} in file '${filePath}':\n` +
        unknownH1s.map((h) => `  # ${h}`).join('\n') +
        '\n' +
        `Allowed top-level headings: ${allowedH1s.map((h) => `# ${h}`).join(', ')}`,
    )
  }

  // Check for at least one section
  if (foundH1s.length === 0) {
    throw new Error(
      `No valid sections found in file '${filePath}'\n` +
        `At least one of the following sections is required: ${allowedH1s.map((h) => `# ${h}`).join(', ')}`,
    )
  }
}

/**
 * Parse Hero section into hero object.
 */
const parseHeroSection = (sectionContent: Content[], filePath: string): Home['hero'] => {
  const allowedH2s = ['Name', 'Text', 'Tagline']
  const subsections = extractH2Subsections(sectionContent)

  // Validate h2s
  const foundH2s = subsections.map((s) => s.heading)
  const invalidH2s = foundH2s.filter((h2) => !allowedH2s.includes(h2))

  if (invalidH2s.length > 0) {
    throw new Error(
      `Invalid subheading${invalidH2s.length > 1 ? 's' : ''} under '# Hero' in file '${filePath}':\n` +
        invalidH2s.map((h) => `  ## ${h}`).join('\n') +
        '\n' +
        `Allowed subheadings: ${allowedH2s.map((h) => `## ${h}`).join(', ')}`,
    )
  }

  // Extract content
  const heroData: { name?: string; text?: string; tagline?: string } = {}
  for (const { heading, content } of subsections) {
    const text = toPlainText(content)
    if (heading === 'Name') heroData.name = text
    if (heading === 'Text') heroData.text = text
    if (heading === 'Tagline') heroData.tagline = text
  }

  return Object.keys(heroData).length > 0 ? heroData : undefined
}

/**
 * Parse Highlights section into features array.
 */
const parseHighlightsSection = (sectionContent: Content[]): Feature[] => {
  const subsections = extractH2Subsections(sectionContent)

  return subsections.map(({ heading, content }) =>
    Feature.make({
      title: heading,
      body: toMarkdown(content),
    }),
  )
}

/**
 * Parse Body section into body sections array.
 */
const parseBodySection = (sectionContent: Content[]): BodySection[] => {
  const subsections = extractH2Subsections(sectionContent)

  return subsections.map(({ heading, content }) => {
    if (heading === 'Exports') {
      return { _tag: 'exports' as const }
    } else {
      return {
        _tag: 'content' as const,
        title: heading,
        body: toMarkdown(content),
      }
    }
  })
}
