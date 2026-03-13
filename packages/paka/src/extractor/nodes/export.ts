import { Fs } from '@kitz/fs'
import { Match, Schema as S } from 'effect'
import { type ExportedDeclarations, Node } from 'ts-morph'
import {
  Docs,
  DocsProvenance,
  type Export,
  JSDocProvenance,
  Module,
  SourceLocation,
  TypeExport,
  ValueExport,
} from '../../schema.js'
import { absoluteToRelative } from '../path-utils.js'
import { categorize } from './categorize.js'
import { parseJSDoc } from './jsdoc.js'
import { extractModule } from './module.js'
import { extractSignature, extractSimpleSignature } from './tsmorph-utils.js'

/**
 * Extract export information from a declaration node.
 *
 * @param name - The export name
 * @param decl - The declaration node
 * @returns Export object with all metadata
 */
export const extractExport = (name: string, decl: ExportedDeclarations): Export => {
  // Get category (level and type)
  const { level, type } = categorize(decl)

  // Extract signature - type signature only, no implementation
  const signature = extractSignature(decl)

  // Extract simple signature if present (from __simpleSignature phantom type)
  const signatureSimple = extractSimpleSignature(decl)

  // Parse JSDoc - use the declaration node directly
  // ts-morph resolves re-exports to the original declaration
  const jsdoc = parseJSDoc(decl)

  // Get source location
  const sourceLocation = new SourceLocation({
    file: S.decodeSync(Fs.Path.RelFile.Schema)(
      absoluteToRelative(decl.getSourceFile().getFilePath()),
    ),
    line: decl.getStartLineNumber(),
  })

  // Base export properties
  const docs =
    jsdoc.description || jsdoc.guide
      ? new Docs({ description: jsdoc.description, guide: jsdoc.guide })
      : undefined

  const docsProvenance =
    jsdoc.description || jsdoc.guide
      ? new DocsProvenance({
          description: jsdoc.description
            ? new JSDocProvenance({ shadowNamespace: false })
            : undefined,
          guide: jsdoc.guide ? new JSDocProvenance({ shadowNamespace: false }) : undefined,
        })
      : undefined

  const baseExport = {
    name,
    signature,
    signatureSimple,
    ...(docs ? { docs } : {}),
    ...(docsProvenance ? { docsProvenance } : {}),
    examples: jsdoc.examples,
    deprecated: jsdoc.deprecated,
    category: jsdoc.category,
    tags: jsdoc.tags,
    sourceLocation,
  }

  // Check if this should be forced to namespace (via @namespace tag)
  // This allows runtime objects to be treated as namespaces in docs
  if (jsdoc.forceNamespace && level === 'value') {
    const location = S.decodeSync(Fs.Path.RelFile.Schema)(
      absoluteToRelative(decl.getSourceFile().getFilePath()),
    )
    return new ValueExport({
      ...baseExport,
      type: 'namespace',
      module: new Module({
        location,
        exports: [],
      }),
    })
  }

  // Handle namespace exports (extract nested module)
  if (level === 'value' && type === 'namespace' && Node.isModuleDeclaration(decl)) {
    const location = S.decodeSync(Fs.Path.RelFile.Schema)(
      absoluteToRelative(decl.getSourceFile().getFilePath()),
    )
    const nestedModule = extractModule(decl, location)

    return new ValueExport({
      ...baseExport,
      type: 'namespace',
      module: nestedModule,
    })
  }

  // Use Match to type-safely create the appropriate export based on level
  return Match.value(level).pipe(
    Match.when(
      'value',
      () =>
        new ValueExport({
          ...baseExport,
          type: type as (typeof ValueExport.Type)['type'],
        }),
    ),
    Match.when(
      'type',
      () =>
        new TypeExport({
          ...baseExport,
          type: type as (typeof TypeExport.Type)['type'],
        }),
    ),
    Match.exhaustive,
  )
}
