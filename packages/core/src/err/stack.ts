import { Str } from '#str'
import type { Context } from './types.js'

/**
 * Options for cleaning and formatting stack traces.
 *
 * @category Stack Traces
 */
export interface StackOptions {
  /**
   * Remove internal library frames from the stack trace.
   * @default true
   */
  removeInternal?: boolean

  /**
   * Patterns to filter out from stack traces.
   * @default ['node_modules', 'node:internal']
   */
  filterPatterns?: string[]

  /**
   * Maximum number of frames to show.
   * @default 10
   */
  maxFrames?: number

  /**
   * Include source code context around error location.
   * @default false
   */
  includeSource?: boolean

  /**
   * Number of source lines to show before and after error.
   * @default 2
   */
  sourceContext?: number
}

/**
 * Parsed stack frame information.
 *
 * @category Stack Traces
 */
export interface StackFrame {
  /**
   * Function name or <anonymous>
   */
  function: string

  /**
   * File path
   */
  file: string

  /**
   * Line number
   */
  line: number

  /**
   * Column number
   */
  column: number

  /**
   * Whether this is internal to the library
   */
  isInternal: boolean

  /**
   * Whether this is a native V8 frame
   */
  isNative: boolean

  /**
   * Raw frame string
   */
  raw: string
}

/**
 * Parse a stack trace string into structured frames.
 *
 * @category Stack Traces
 */
export const parseStack = (stack: string): StackFrame[] => {
  const lines = Str.Text.lines(stack)
  const frames: StackFrame[] = []

  // Skip first line (error message)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line.startsWith('at ')) continue

    // Parse different stack frame formats:
    // at functionName (file:line:col)
    // at file:line:col
    // at async functionName (file:line:col)
    // at new ClassName (file:line:col)

    // First try to match with function name
    let match = line.match(/at\s+(?:async\s+)?(?:new\s+)?([^\s(]+)\s+\((.*?):(\d+):(\d+)\)/)

    if (match) {
      const [, fnName, file, lineStr, colStr] = match
      frames.push({
        function: fnName!,
        file: file!,
        line: parseInt(lineStr!, 10),
        column: parseInt(colStr!, 10),
        isInternal: isInternalFrame(file!),
        isNative: file!.includes('[native code]') || file!.startsWith('node:'),
        raw: line,
      })
      continue
    }

    // Try to match without function name (anonymous)
    match = line.match(/at\s+(.*?):(\d+):(\d+)/)
    if (match) {
      const [, file, lineStr, colStr] = match
      frames.push({
        function: '<anonymous>',
        file: file!,
        line: parseInt(lineStr!, 10),
        column: parseInt(colStr!, 10),
        isInternal: isInternalFrame(file!),
        isNative: file!.includes('[native code]') || file!.startsWith('node:'),
        raw: line,
      })
    }
  }

  return frames
}

/**
 * Check if a frame is internal to our library.
 */
const isInternalFrame = (file: string): boolean => {
  // Frames from our error handling utilities
  const internalPatterns = [
    '/err/wrap.',
    '/err/try.',
    '/err/stack.',
    '/fn/curry.', // Our curry utilities used by wrapWith
  ]

  return internalPatterns.some((pattern) => file.includes(pattern))
}

/**
 * Statistics about stack trace filtering.
 * Provides detailed information about what was filtered during stack cleaning.
 *
 * @example
 * ```ts
 * const result = cleanStackWithStats(error.stack)
 * console.log(`Filtered ${result.stats.filteredFrames} frames`)
 * console.log(`Showing ${result.stats.shownFrames} of ${result.stats.totalFrames} total`)
 * ```
 *
 * @category Stack Traces
 */
export interface StackCleanStats {
  /**
   * Total number of frames before filtering.
   */
  totalFrames: number

  /**
   * Number of frames filtered out.
   */
  filteredFrames: number

  /**
   * Number of node_modules frames filtered.
   */
  nodeModulesFrames: number

  /**
   * Number of internal frames filtered.
   */
  internalFrames: number

  /**
   * Number of frames shown.
   */
  shownFrames: number

  /**
   * Whether the output was truncated due to maxFrames.
   */
  wasTruncated: boolean
}

/**
 * Result of cleaning a stack trace.
 * Contains both the cleaned stack string and statistics about what was filtered.
 *
 * @see {@link cleanStackWithStats}
 *
 * @category Stack Traces
 */
export interface CleanStackResult {
  /**
   * The cleaned stack trace string.
   */
  stack: string

  /**
   * Statistics about what was filtered.
   */
  stats: StackCleanStats
}

/**
 * Clean a stack trace by removing internal frames and applying filters.
 * Returns both the cleaned stack and detailed statistics about filtering.
 *
 * @param stack - The raw stack trace string to clean
 * @param options - Optional configuration for filtering and formatting
 * @returns Object containing cleaned stack and filtering statistics
 *
 * @example
 * ```ts
 * const error = new Error('Something failed')
 * const result = cleanStackWithStats(error.stack, {
 *   removeInternal: true,
 *   filterPatterns: ['node_modules'],
 *   maxFrames: 10
 * })
 *
 * console.log(result.stack) // Cleaned stack trace
 * console.log(`Filtered ${result.stats.nodeModulesFrames} node_modules frames`)
 * ```
 *
 * @category Stack Traces
 */
export const cleanStackWithStats = (stack: string, options?: StackOptions): CleanStackResult => {
  const opts = {
    removeInternal: true,
    filterPatterns: ['node_modules', 'node:internal'],
    maxFrames: 10,
    includeSource: false,
    sourceContext: 2,
    ...options,
  }

  const frames = parseStack(stack)
  const stats: StackCleanStats = {
    totalFrames: frames.length,
    filteredFrames: 0,
    nodeModulesFrames: 0,
    internalFrames: 0,
    shownFrames: 0,
    wasTruncated: false,
  }

  let filteredFrames = frames

  // Remove internal frames
  if (opts.removeInternal) {
    const beforeCount = filteredFrames.length
    filteredFrames = filteredFrames.filter((frame) => !frame.isInternal)
    const removedCount = beforeCount - filteredFrames.length
    stats.internalFrames += removedCount
    stats.filteredFrames += removedCount
  }

  // Apply custom filters
  if (opts.filterPatterns.length > 0) {
    const beforeCount = filteredFrames.length
    filteredFrames = filteredFrames.filter((frame) => {
      const shouldFilter = opts.filterPatterns.some((pattern) => frame.file.includes(pattern))
      if (shouldFilter && frame.file.includes('node_modules')) {
        stats.nodeModulesFrames++
      }
      return !shouldFilter
    })
    const removedCount = beforeCount - filteredFrames.length
    stats.filteredFrames += removedCount
  }

  // Limit frames
  // const beforeTruncation = filteredFrames.length

  if (opts.maxFrames > 0 && filteredFrames.length > opts.maxFrames) {
    filteredFrames = filteredFrames.slice(0, opts.maxFrames)
    stats.wasTruncated = true
  }
  stats.shownFrames = filteredFrames.length

  // Reconstruct stack trace
  const cleanedLines = filteredFrames.map((frame) => frame.raw)

  // Get the error message (first line)
  const firstLine = Str.Text.lines(stack)[0] || 'Error'

  return {
    stack: [firstLine, ...cleanedLines].join('\n'),
    stats,
  }
}

/**
 * Clean a stack trace by removing internal frames and applying filters.
 *
 * @deprecated Use {@link cleanStackWithStats} for detailed filtering information
 * @param stack - The raw stack trace string to clean
 * @param options - Optional configuration for filtering
 * @returns The cleaned stack trace string
 *
 * @category Stack Traces
 */
export const cleanStack = (stack: string, options?: StackOptions): string => {
  return cleanStackWithStats(stack, options).stack
}

/**
 * Format a stack frame for better readability.
 *
 * @category Stack Traces
 */
export const formatFrame = (frame: StackFrame): string => {
  const location = `${frame.file}:${frame.line}:${frame.column}`
  const func = frame.function === '<anonymous>' ? '' : `${frame.function} `

  return `at ${func}(${location})`
}

/**
 * Enhanced Error class that automatically cleans stack traces.
 *
 * @category Stack Traces
 */
export class CleanError extends Error {
  /**
   * Original uncleaned stack trace.
   */
  originalStack?: string

  /**
   * Additional context for the error.
   */
  context?: Context

  constructor(
    message: string,
    options?: ErrorOptions & { context?: Context; stackOptions?: StackOptions },
  ) {
    super(message, options)
    this.name = this.constructor.name

    if (options?.context) {
      this.context = options.context
    }

    // Clean the stack trace
    if (this.stack) {
      this.originalStack = this.stack
      this.stack = cleanStackWithStats(this.stack, options?.stackOptions).stack
    }

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Merge stack traces from multiple errors (useful for wrapped errors).
 * This preserves the full error chain while removing duplicates.
 *
 * @category Stack Traces
 */
export const mergeStacks = (wrapper: Error, cause: Error): string => {
  if (!wrapper.stack || !cause.stack) {
    return wrapper.stack || cause.stack || ''
  }

  const wrapperFrames = parseStack(wrapper.stack)
  const causeFrames = parseStack(cause.stack)

  // Find where the wrapper's stack ends (usually at our wrap functions)
  const wrapperEndIndex = wrapperFrames.findIndex((frame) => frame.isInternal)

  // Take wrapper frames up to the internal boundary
  const relevantWrapperFrames =
    wrapperEndIndex >= 0 ? wrapperFrames.slice(0, wrapperEndIndex) : wrapperFrames

  // Combine: wrapper's user frames + all cause frames
  const combined = [...relevantWrapperFrames, ...causeFrames]

  // Remove duplicates (same file:line:col)
  const seen = new Set<string>()
  const unique = combined.filter((frame) => {
    const key = `${frame.file}:${frame.line}:${frame.column}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Get error messages
  const wrapperMessage = Str.Text.lines(wrapper.stack)[0]!
  const causeMessage = Str.Text.lines(cause.stack)[0]!

  // Build merged stack
  const frames = unique.map((frame) => frame.raw)

  return [wrapperMessage, ...frames, '', 'Caused by:', causeMessage].join('\n')
}

/**
 * Capture the current stack trace at a specific point.
 * Useful for adding trace information without throwing.
 */
export const captureStackTrace = (message = 'Captured stack'): string => {
  const obj = { stack: '' }
  Error.captureStackTrace(obj, captureStackTrace)
  return `${message}\n${obj.stack}`
}

/**
 * Get the caller information from the current stack.
 */
export const getCaller = (depth = 1): StackFrame | undefined => {
  const obj = { stack: '' }
  Error.captureStackTrace(obj, getCaller)
  const frames = parseStack(obj.stack)
  return frames[depth]
}
