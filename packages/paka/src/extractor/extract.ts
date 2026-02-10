import { Pat, Str } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Schema as S } from 'effect'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { Project } from 'ts-morph'
import {
  Docs,
  DocsProvenance,
  DrillableNamespaceEntrypoint,
  type Entrypoint,
  type Export,
  type InterfaceModel,
  JSDocProvenance,
  Module,
  ModuleDocs,
  Package,
  PackageMetadata,
  SimpleEntrypoint,
} from '../schema.js'
import { parseJSDoc } from './nodes/jsdoc.js'
import { extractModuleFromFile } from './nodes/module.js'
import { createBuildToSourcePath } from './path-utils.js'

/**
 * Pure extraction function that processes files without I/O.
 * Takes all files as input and returns the extracted model.
 *
 * @param params - Extraction parameters including files layout
 * @returns Complete interface model
 *
 * @example
 * ```ts
 * const layout = Fs.Builder.spec('/')
 *   .add('package.json', { name: 'x', exports: { './foo': './build/foo/_.js' } })
 *   .add('src/foo/$.ts', 'export const bar = () => {}')
 *   .toLayout()
 *
 * const model = extractFromFiles({ files: layout })
 * ```
 */
export const extractFromFiles = (params: {
  projectRoot?: string
  files: Fs.Builder.Layout
  entrypoints?: string[]
  extractorVersion?: string
  matching?: Pat.PatternForType<Export>
  /** @deprecated Use `matching` instead */
  filterUnderscoreExports?: boolean
}): InterfaceModel => {
  const {
    projectRoot = '/',
    files,
    entrypoints: targetEntrypoints,
    extractorVersion = '0.1.0',
    matching,
    filterUnderscoreExports = false,
  } = params

  // Load package.json
  const packageJsonPath = join(projectRoot, 'package.json')
  const packageJsonContent = files[packageJsonPath]
  if (!packageJsonContent) {
    throw new Error(`package.json not found at ${packageJsonPath}`)
  }
  const packageJson = JSON.parse(
    typeof packageJsonContent === 'string' ? packageJsonContent : new TextDecoder().decode(packageJsonContent),
  )

  // Create in-memory TypeScript project
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99, // ESNext
      module: 99, // ESNext
      moduleResolution: 3, // Bundler
    },
  })

  // Load all files into ts-morph
  for (const [filePath, content] of Object.entries(files)) {
    if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
      const contentStr = typeof content === 'string' ? content : new TextDecoder().decode(content)
      project.createSourceFile(filePath, contentStr)
    }
  }

  // Check if files layout includes a tsconfig and extract outDir/rootDir
  const tsconfigBuildPath = join(projectRoot, 'tsconfig.build.json')
  const tsconfigPath = join(projectRoot, 'tsconfig.json')

  let buildToSourcePath: (path: string) => string

  if (files[tsconfigBuildPath] || files[tsconfigPath]) {
    // Parse tsconfig from files (simple JSON parse - no extends resolution needed for tests)
    const tsconfigContent = files[tsconfigBuildPath] || files[tsconfigPath]
    const tsconfig = JSON.parse(
      typeof tsconfigContent === 'string' ? tsconfigContent : new TextDecoder().decode(tsconfigContent),
    )

    const { outDir, rootDir } = tsconfig.compilerOptions || {}

    buildToSourcePath = createBuildToSourcePath(
      outDir && rootDir
        ? {
          outDir: join(projectRoot, outDir),
          rootDir: join(projectRoot, rootDir),
          projectRoot,
        }
        : undefined,
    )
  } else {
    // No tsconfig - just extension transformation
    buildToSourcePath = createBuildToSourcePath()
  }

  // Determine which entrypoints to extract
  const exportsField = packageJson.exports as Record<string, string> | undefined
  if (!exportsField) {
    throw new Error('package.json missing "exports" field')
  }

  const entrypointsToExtract = targetEntrypoints
    ? Object.entries(exportsField).filter(([key]) => targetEntrypoints.includes(key))
    : Object.entries(exportsField) // Extract ALL by default

  // Extract each entrypoint
  const extractedEntrypoints: Entrypoint[] = []

  for (const [packagePath, buildPath] of entrypointsToExtract) {
    // Resolve build path to source path
    const sourcePath = buildToSourcePath(buildPath)
    const absoluteSourcePath = join(projectRoot, sourcePath)

    // Get source file
    const sourceFile = project.getSourceFile(absoluteSourcePath)
    if (!sourceFile) {
      console.warn(`Warning: Could not find source file for ${packagePath} at ${sourcePath}`)
      continue
    }

    // Check for Drillable Namespace Pattern
    let actualSourceFile = sourceFile
    let namespaceDescription: string | undefined
    let namespaceCategory: string | undefined
    let isDrillableNamespace = false

    if (packagePath === '.') {
      const exportDeclarations = sourceFile.getExportDeclarations()

      for (const exportDecl of exportDeclarations) {
        const namespaceExport = exportDecl.getNamespaceExport()
        if (!namespaceExport) continue

        // Get namespace name (PascalCase, e.g., 'A')
        const nsName = namespaceExport.getName()

        // Convert to kebab-case (e.g., 'A' -> 'a', 'FooBar' -> 'foo-bar')
        const kebabName = Str.Case.kebab(nsName)
        const subpathKey = `./${kebabName}`

        // Check if matching subpath exists in exports
        if (!(subpathKey in exportsField)) continue

        // Resolve the file that the namespace export points to
        const nsReferencedFile = exportDecl.getModuleSpecifierSourceFile()
        if (!nsReferencedFile) continue

        const nsFilePath = nsReferencedFile.getFilePath()

        // Resolve the file that the subpath export points to
        const subpathBuildPath = exportsField[subpathKey]
        if (!subpathBuildPath) continue
        const subpathSourcePath = buildToSourcePath(subpathBuildPath)
        const subpathAbsolutePath = join(projectRoot, subpathSourcePath)
        const subpathFile = project.getSourceFile(subpathAbsolutePath)
        if (!subpathFile) continue

        const subpathFilePath = subpathFile.getFilePath()

        // If both resolve to the same file, it's drillable!
        if (nsFilePath === subpathFilePath) {
          isDrillableNamespace = true
          actualSourceFile = nsReferencedFile
          // Extract JSDoc: prefer namespace declaration (better IDE experience) over export declaration (fallback)
          const namespaceDecl = sourceFile.getModules().find((m) => m.getName() === nsName)
          if (namespaceDecl) {
            const jsdoc = parseJSDoc(namespaceDecl)
            namespaceDescription = jsdoc.description
            namespaceCategory = jsdoc.category
          } else {
            // Fallback: read JSDoc from export * as declaration
            const jsdoc = parseJSDoc(exportDecl)
            namespaceDescription = jsdoc.description
            namespaceCategory = jsdoc.category
          }
          break
        }
      }
    } else {
      // For subpath entrypoints, detect drillable namespace pattern in two ways:
      //
      // Pattern A: Entrypoint file itself has namespace export pointing to barrel
      // Example: './test' → 'test/$.ts' with 'export * as Test from './__.js''
      //
      // Pattern B: Another file in same directory has namespace export pointing to entrypoint
      // Example: './arr' → 'arr/$$.ts', and 'arr/$.ts' has 'export * as Arr from './__.js''

      const sourceFileDir = sourceFile.getDirectory()
      const expectedNsName = Str.Case.pascal(packagePath.replace(/^\.\//, ''))

      // Pattern A: Check if entrypoint file has namespace export pointing elsewhere
      const entrypointExports = sourceFile.getExportDeclarations()
      for (const exportDecl of entrypointExports) {
        const namespaceExport = exportDecl.getNamespaceExport()
        if (!namespaceExport) continue

        const nsName = namespaceExport.getName()
        if (nsName.toLowerCase() === expectedNsName.toLowerCase()) {
          const nsReferencedFile = exportDecl.getModuleSpecifierSourceFile()
          if (nsReferencedFile && nsReferencedFile.getFilePath() !== sourceFile.getFilePath()) {
            isDrillableNamespace = true
            actualSourceFile = nsReferencedFile
            const namespaceDecl = sourceFile.getModules().find((m) => m.getName() === nsName)
            if (namespaceDecl) {
              const jsdoc = parseJSDoc(namespaceDecl)
              namespaceDescription = jsdoc.description
              namespaceCategory = jsdoc.category
            } else {
              const jsdoc = parseJSDoc(exportDecl)
              namespaceDescription = jsdoc.description
              namespaceCategory = jsdoc.category
            }
            break
          }
        }
      }

      // Pattern B: Check if other files in directory have namespace export pointing to entrypoint
      if (!isDrillableNamespace) {
        for (const siblingFile of sourceFileDir.getSourceFiles()) {
          if (siblingFile.getFilePath() === sourceFile.getFilePath()) continue

          const siblingExports = siblingFile.getExportDeclarations()
          for (const exportDecl of siblingExports) {
            const namespaceExport = exportDecl.getNamespaceExport()
            if (!namespaceExport) continue

            const nsName = namespaceExport.getName()
            if (nsName.toLowerCase() === expectedNsName.toLowerCase()) {
              const nsReferencedFile = exportDecl.getModuleSpecifierSourceFile()
              if (nsReferencedFile && nsReferencedFile.getFilePath() === sourceFile.getFilePath()) {
                isDrillableNamespace = true
                // Keep actualSourceFile as the barrel (entrypoint), use sibling's JSDoc
                const namespaceDecl = siblingFile.getModules().find((m) => m.getName() === nsName)
                if (namespaceDecl) {
                  const jsdoc = parseJSDoc(namespaceDecl)
                  namespaceDescription = jsdoc.description
                  namespaceCategory = jsdoc.category
                } else {
                  const jsdoc = parseJSDoc(exportDecl)
                  namespaceDescription = jsdoc.description
                  namespaceCategory = jsdoc.category
                }
                break
              }
            }
          }
          if (isDrillableNamespace) break
        }
      }
    }

    // Extract module
    // For drillable namespaces, use the barrel file path; otherwise use the main entrypoint path
    const locationPath = isDrillableNamespace
      ? actualSourceFile.getFilePath().replace(projectRoot, '').replace(/^\//, '')
      : sourcePath
    const relativeSourcePath = locationPath.replace(/^\.\//, '')
    let module = extractModuleFromFile(
      actualSourceFile,
      S.decodeSync(Fs.Path.RelFile.Schema)(relativeSourcePath),
      { filterInternal: true, filterUnderscoreExports },
    )

    // Apply pattern matching filter if provided
    if (matching) {
      const filteredExports = module.exports.filter(exp => Pat.isMatch(exp, matching))
      module = Module.make({
        ...module,
        exports: filteredExports,
      })
    }

    // Override module description and category with namespace export JSDoc if available
    if (namespaceDescription || namespaceCategory) {
      module = Module.make({
        location: module.location,
        exports: module.exports,
        docs: namespaceDescription
          ? ModuleDocs.make({
            description: namespaceDescription,
            guide: module.docs?.guide,
          })
          : module.docs,
        docsProvenance: namespaceDescription
          ? DocsProvenance.make({
            description: JSDocProvenance.make({ shadowNamespace: true }),
            guide: module.docsProvenance?.guide,
          })
          : module.docsProvenance,
        category: namespaceCategory ?? module.category,
      })
    }

    // Create appropriate entrypoint type
    if (isDrillableNamespace) {
      extractedEntrypoints.push(DrillableNamespaceEntrypoint.make({
        path: packagePath,
        module,
      }))
    } else {
      extractedEntrypoints.push(SimpleEntrypoint.make({
        path: packagePath,
        module,
      }))
    }
  }

  return Package.make({
    name: packageJson.name,
    version: packageJson.version,
    entrypoints: extractedEntrypoints,
    metadata: PackageMetadata.make({
      extractedAt: new Date(),
      extractorVersion,
    }),
  })
}

/**
 * Configuration for extraction.
 */
export type ExtractConfig = {
  /** Project root directory */
  projectRoot: string
  /** Path to tsconfig.json */
  tsconfigPath?: string
  /** Specific entrypoints to extract (if not specified, extracts all from package.json) */
  entrypoints?: string[]
  /** Extractor version */
  extractorVersion?: string
  /** Pattern for exports to include. Exports not matching this pattern are filtered out. */
  matching?: Pat.PatternForType<Export>
  /** @deprecated Use `matching` instead. Filter exports that start with underscore `_` prefix (default: false) */
  filterUnderscoreExports?: boolean
}

/**
 * Extract documentation model from TypeScript source files.
 *
 * @param config - Extraction configuration
 * @returns Complete interface model
 */
export const extract = (config: ExtractConfig): InterfaceModel => {
  const {
    projectRoot,
    tsconfigPath,
    entrypoints: targetEntrypoints,
    extractorVersion = '0.1.0',
    matching,
    filterUnderscoreExports = false,
  } = config

  // Load package.json
  const packageJsonPath = join(projectRoot, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

  // Detect tsconfig with preference for build config
  const resolvedTsconfigPath = tsconfigPath ?? (() => {
    const buildConfigPath = join(projectRoot, 'tsconfig.build.json')
    const regularConfigPath = join(projectRoot, 'tsconfig.json')

    // Prefer tsconfig.build.json (contains outDir/rootDir for builds)
    if (existsSync(buildConfigPath)) {
      return buildConfigPath
    }

    // Fallback to tsconfig.json
    if (existsSync(regularConfigPath)) {
      return regularConfigPath
    }

    // Let ts-morph throw its native error for missing config
    return regularConfigPath
  })()

  // Create TypeScript project
  const project = new Project({
    tsConfigFilePath: resolvedTsconfigPath,
  })

  // Get compiler options (may have outDir/rootDir or not)
  const compilerOptions = project.getCompilerOptions()

  // Create transformer (conditional on tsconfig having outDir/rootDir)
  const buildToSourcePath = createBuildToSourcePath(
    compilerOptions.outDir && compilerOptions.rootDir
      ? {
        outDir: compilerOptions.outDir,
        rootDir: compilerOptions.rootDir,
        projectRoot,
      }
      : undefined, // No transformation, just extension change
  )

  // Determine which entrypoints to extract
  const exportsField = packageJson.exports as Record<string, string> | undefined
  if (!exportsField) {
    throw new Error('package.json missing "exports" field')
  }

  const entrypointsToExtract = targetEntrypoints
    ? Object.entries(exportsField).filter(([key]) => targetEntrypoints.includes(key))
    : Object.entries(exportsField) // Extract ALL by default

  // Extract each entrypoint
  const extractedEntrypoints: Entrypoint[] = []

  for (const [packagePath, buildPath] of entrypointsToExtract) {
    // Resolve build path to source path
    const sourcePath = buildToSourcePath(buildPath)
    const absoluteSourcePath = join(projectRoot, sourcePath)

    // Get source file
    const sourceFile = project.getSourceFile(absoluteSourcePath)
    if (!sourceFile) {
      console.warn(`Warning: Could not find source file for ${packagePath} at ${sourcePath}`)
      continue
    }

    // Check for Drillable Namespace Pattern
    // Detection criteria vary by entrypoint type:
    //
    // For main entrypoint '.':
    // 1. Main entrypoint has namespace export: export * as Name from './path'
    // 2. Namespace name (PascalCase) converts to kebab-case
    // 3. Subpath export ./kebab-name exists in package.json
    // 4. Both namespace export and subpath export resolve to same source file
    //
    // For subpath entrypoints (e.g., './arr'):
    // 1. Check if sibling $.ts file exists (e.g., arr/$.ts when entrypoint points to arr/$$.ts)
    // 2. Check if $.ts has namespace export matching the entrypoint name
    // 3. Check if namespace export points to the entrypoint's target file
    // 4. If so, use $.ts as source and mark as drillable
    let actualSourceFile = sourceFile
    let namespaceDescription: string | undefined
    let namespaceCategory: string | undefined
    let isDrillableNamespace = false

    if (packagePath === '.') {
      const exportDeclarations = sourceFile.getExportDeclarations()

      for (const exportDecl of exportDeclarations) {
        const namespaceExport = exportDecl.getNamespaceExport()
        if (!namespaceExport) continue

        // Get namespace name (PascalCase, e.g., 'A')
        const nsName = namespaceExport.getName()

        // Convert to kebab-case (e.g., 'A' -> 'a', 'FooBar' -> 'foo-bar')
        const kebabName = Str.Case.kebab(nsName)
        const subpathKey = `./${kebabName}`

        // Check if matching subpath exists in exports
        if (!(subpathKey in exportsField)) continue

        // Resolve the file that the namespace export points to
        const nsReferencedFile = exportDecl.getModuleSpecifierSourceFile()
        if (!nsReferencedFile) continue

        const nsFilePath = nsReferencedFile.getFilePath()

        // Resolve the file that the subpath export points to
        const subpathBuildPath = exportsField[subpathKey]
        if (!subpathBuildPath) continue
        const subpathSourcePath = buildToSourcePath(subpathBuildPath)
        const subpathAbsolutePath = join(projectRoot, subpathSourcePath)
        const subpathFile = project.getSourceFile(subpathAbsolutePath)
        if (!subpathFile) continue

        const subpathFilePath = subpathFile.getFilePath()

        // If both resolve to the same file, it's drillable!
        if (nsFilePath === subpathFilePath) {
          isDrillableNamespace = true
          actualSourceFile = nsReferencedFile
          // Extract JSDoc: prefer namespace declaration (better IDE experience) over export declaration (fallback)
          const namespaceDecl = sourceFile.getModules().find((m) => m.getName() === nsName)
          if (namespaceDecl) {
            const jsdoc = parseJSDoc(namespaceDecl)
            namespaceDescription = jsdoc.description
            namespaceCategory = jsdoc.category
          } else {
            // Fallback: read JSDoc from export * as declaration
            const jsdoc = parseJSDoc(exportDecl)
            namespaceDescription = jsdoc.description
            namespaceCategory = jsdoc.category
          }
          break
        }
      }
    } else {
      // For subpath entrypoints, detect drillable namespace pattern in two ways:
      //
      // Pattern A: Entrypoint file itself has namespace export pointing to barrel
      // Example: './test' → 'test/$.ts' with 'export * as Test from './__.js''
      //
      // Pattern B: Another file in same directory has namespace export pointing to entrypoint
      // Example: './arr' → 'arr/$$.ts', and 'arr/$.ts' has 'export * as Arr from './__.js''

      const sourceFileDir = sourceFile.getDirectory()
      const expectedNsName = Str.Case.pascal(packagePath.replace(/^\.\//, ''))

      // Pattern A: Check if entrypoint file has namespace export pointing elsewhere
      const entrypointExports = sourceFile.getExportDeclarations()
      for (const exportDecl of entrypointExports) {
        const namespaceExport = exportDecl.getNamespaceExport()
        if (!namespaceExport) continue

        const nsName = namespaceExport.getName()
        if (nsName.toLowerCase() === expectedNsName.toLowerCase()) {
          const nsReferencedFile = exportDecl.getModuleSpecifierSourceFile()
          if (nsReferencedFile && nsReferencedFile.getFilePath() !== sourceFile.getFilePath()) {
            isDrillableNamespace = true
            actualSourceFile = nsReferencedFile
            const namespaceDecl = sourceFile.getModules().find((m) => m.getName() === nsName)
            if (namespaceDecl) {
              const jsdoc = parseJSDoc(namespaceDecl)
              namespaceDescription = jsdoc.description
              namespaceCategory = jsdoc.category
            } else {
              const jsdoc = parseJSDoc(exportDecl)
              namespaceDescription = jsdoc.description
              namespaceCategory = jsdoc.category
            }
            break
          }
        }
      }

      // Pattern B: Check if other files in directory have namespace export pointing to entrypoint
      if (!isDrillableNamespace) {
        for (const siblingFile of sourceFileDir.getSourceFiles()) {
          if (siblingFile.getFilePath() === sourceFile.getFilePath()) continue

          const siblingExports = siblingFile.getExportDeclarations()
          for (const exportDecl of siblingExports) {
            const namespaceExport = exportDecl.getNamespaceExport()
            if (!namespaceExport) continue

            const nsName = namespaceExport.getName()
            if (nsName.toLowerCase() === expectedNsName.toLowerCase()) {
              const nsReferencedFile = exportDecl.getModuleSpecifierSourceFile()
              if (nsReferencedFile && nsReferencedFile.getFilePath() === sourceFile.getFilePath()) {
                isDrillableNamespace = true
                // Keep actualSourceFile as the barrel (entrypoint), use sibling's JSDoc
                const namespaceDecl = siblingFile.getModules().find((m) => m.getName() === nsName)
                if (namespaceDecl) {
                  const jsdoc = parseJSDoc(namespaceDecl)
                  namespaceDescription = jsdoc.description
                  namespaceCategory = jsdoc.category
                } else {
                  const jsdoc = parseJSDoc(exportDecl)
                  namespaceDescription = jsdoc.description
                  namespaceCategory = jsdoc.category
                }
                break
              }
            }
          }
          if (isDrillableNamespace) break
        }
      }
    }

    // Extract module (no longer needs module name)
    // For drillable namespaces, use the barrel file path; otherwise use the main entrypoint path
    const locationPath = isDrillableNamespace
      ? actualSourceFile.getFilePath().replace(projectRoot, '').replace(/^\//, '')
      : sourcePath
    const relativeSourcePath = locationPath.replace(/^\.\//, '')
    let module = extractModuleFromFile(
      actualSourceFile,
      S.decodeSync(Fs.Path.RelFile.Schema)(relativeSourcePath),
      { filterInternal: true, filterUnderscoreExports },
    )

    // Apply pattern matching filter if provided
    if (matching) {
      const filteredExports = module.exports.filter(exp => Pat.isMatch(exp, matching))
      module = Module.make({
        ...module,
        exports: filteredExports,
      })
    }

    // Override module description and category with namespace export JSDoc if available
    if (namespaceDescription || namespaceCategory) {
      module = Module.make({
        location: module.location,
        exports: module.exports,
        docs: namespaceDescription
          ? ModuleDocs.make({
            description: namespaceDescription,
            guide: module.docs?.guide,
          })
          : module.docs,
        docsProvenance: namespaceDescription
          ? DocsProvenance.make({
            description: JSDocProvenance.make({ shadowNamespace: true }),
            guide: module.docsProvenance?.guide,
          })
          : module.docsProvenance,
        category: namespaceCategory ?? module.category,
      })
    }

    // Create appropriate entrypoint type
    if (isDrillableNamespace) {
      extractedEntrypoints.push(DrillableNamespaceEntrypoint.make({
        path: packagePath,
        module,
      }))
    } else {
      extractedEntrypoints.push(SimpleEntrypoint.make({
        path: packagePath,
        module,
      }))
    }
  }

  return Package.make({
    name: packageJson.name,
    version: packageJson.version,
    entrypoints: extractedEntrypoints,
    metadata: PackageMetadata.make({
      extractedAt: new Date(),
      extractorVersion,
    }),
  })
}
