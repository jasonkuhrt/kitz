import { IndentationText, Node, Project, SyntaxKind } from 'ts-morph'

/**
 * Add word highlights for method names in namespace calls to TypeScript code.
 * Highlights only the method name (e.g., "ensure" in "Arr.ensure()") to avoid
 * Shiki's multi-token issue with dots.
 */
export const addTwoslashAnnotations = (code: string): string => {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
    },
  })
  const sourceFile = project.createSourceFile('temp.ts', code)

  // Format the code using ts-morph's built-in formatter
  sourceFile.formatText()

  const lines = sourceFile.getFullText().split('\n')
  const modifications: Array<{ line: number; text: string; insert?: boolean }> = []

  // Add word highlights for method names in namespace calls
  const highlightModifications = addMethodNameHighlights(lines, sourceFile)
  modifications.push(...highlightModifications)

  // Apply modifications in reverse order (bottom to top) to preserve line numbers
  modifications.sort((a, b) => b.line - a.line)

  for (const mod of modifications) {
    if (mod.insert) {
      // Insert new line before the target line
      lines.splice(mod.line, 0, mod.text)
    } else {
      // Replace the line
      lines[mod.line] = mod.text
    }
  }

  return lines.join('\n')
}

/**
 * Add word highlights for method names in namespace calls (e.g., "ensure" in "Arr.ensure()")
 */
export const addMethodNameHighlights = (
  lines: string[],
  sourceFile: ReturnType<Project['createSourceFile']>,
): Array<{ line: number; text: string; insert: boolean }> => {
  // Track highlights per line to support multiple highlights on same line
  const highlightsByLine = new Map<number, string[]>()

  // Find all PropertyAccessExpressions (both calls and references)
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).forEach((propAccess) => {
    // Skip if this is nested inside another PropertyAccessExpression
    // (e.g., for "Arr.Eq.is", skip the "Arr.Eq" part and only highlight "is" from "Arr.Eq.is")
    const parent = propAccess.getParent()
    if (Node.isPropertyAccessExpression(parent)) {
      return // This is part of a larger property chain, skip it
    }

    // Get just the method/property name (the part after the last dot)
    const methodName = propAccess.getName()

    // Only highlight if this looks like a namespace call (has an identifier before the dot)
    const expression = propAccess.getExpression()
    const isNamespaceCall =
      Node.isPropertyAccessExpression(expression) || Node.isIdentifier(expression)

    if (isNamespaceCall && methodName) {
      const startLine = propAccess.getStartLineNumber() - 1 // 0-indexed

      // Track highlight for this line
      const existing = highlightsByLine.get(startLine) || []
      if (!existing.includes(methodName)) {
        existing.push(methodName)
        highlightsByLine.set(startLine, existing)
      }
    }
  })

  // Convert to modifications array
  const modifications: Array<{ line: number; text: string; insert: boolean }> = []
  for (const [lineNum, highlights] of highlightsByLine.entries()) {
    const lineText = lines[lineNum] || ''
    // Check if previous line doesn't already have word highlight markers
    const prevLine = lineNum > 0 ? (lines[lineNum - 1] ?? '') : ''
    if (!prevLine.includes('[!code word:')) {
      // Insert annotation lines BEFORE the target line
      // Each highlight annotation applies to :1 line (the next line)
      const annotations = highlights.map((h) => `// [!code word:${h}:1]`)
      modifications.push({
        line: lineNum,
        text: annotations.join('\n'),
        insert: true, // Mark this as an insertion, not a replacement
      })
    }
  }

  return modifications
}
