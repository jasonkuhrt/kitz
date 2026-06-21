import { type Analysis, type AnalysisDir, type AnalysisFile, analyze } from './codec-string/__.js'

export type { Analyze } from './codec-string/__.js'

/**
 * Path analyzer namespace following Kit naming conventions:
 * - PascalCase = Data/Types (Analysis, AnalysisFile, AnalysisDir)
 * - camelCase = Operations (analyze - both term and type level)
 */
export const PathAnalyzer = {
  // === DATA (PascalCase) ===
  Analysis: undefined as any as Analysis,
  AnalysisFile: undefined as any as AnalysisFile,
  AnalysisDir: undefined as any as AnalysisDir,

  // === OPERATIONS (camelCase) ===
  // Term-level operation
  analyze,
}

// Type exports
export type { Analysis, AnalysisDir, AnalysisFile }
