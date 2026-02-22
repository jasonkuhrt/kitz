import { cloneDeep, merge } from 'es-toolkit/compat'
import * as OS from 'os'
import * as Filter from './filter.js'
import { validPathSegmentNameRegex } from './internal.js'
import { LEVELS } from './level.js'
import type { Name, Num } from './level.js'
import type * as RootLogger from './root-logger.js'

type Context = Record<string, unknown>

export type LogRecord = {
  level: Num
  event: string
  path?: string[]
  context?: Context
  time?: number
  pid?: number
  hostname?: string
}

type Log = (event: string, context?: Context) => void

/**
 * A logger instance with methods for all log levels and hierarchical organization.
 *
 * @remarks
 *
 * Logger provides six levels of logging methods plus utilities for context management
 * and creating child loggers for hierarchical namespace organization.
 */
export type Logger = {
  /**
   * Log at fatal level (6) - for critical failures requiring immediate attention.
   *
   * @param event - The log message describing what happened
   * @param context - Optional contextual data to include with the log
   *
   * @example
   * ```typescript
   * log.fatal('Database connection pool exhausted')
   * log.fatal('Out of memory', { availableMemory: 0, requestedMemory: 1024 })
   * ```
   */
  fatal: Log
  /**
   * Log at error level (5) - for errors that require attention but aren't critical.
   *
   * @param event - The log message describing what happened
   * @param context - Optional contextual data to include with the log
   *
   * @example
   * ```typescript
   * log.error('Failed to process request')
   * log.error('Validation failed', { errors: ['Invalid email', 'Missing name'] })
   * ```
   */
  error: Log
  /**
   * Log at warn level (4) - for potentially problematic situations.
   *
   * @param event - The log message describing what happened
   * @param context - Optional contextual data to include with the log
   *
   * @example
   * ```typescript
   * log.warn('API rate limit approaching')
   * log.warn('Deprecated function used', { function: 'oldApi', alternative: 'newApi' })
   * ```
   */
  warn: Log
  /**
   * Log at info level (3) - for general informational messages.
   *
   * @param event - The log message describing what happened
   * @param context - Optional contextual data to include with the log
   *
   * @example
   * ```typescript
   * log.info('Server started')
   * log.info('User logged in', { userId: 'user123', ip: '192.168.1.1' })
   * ```
   */
  info: Log
  /**
   * Log at debug level (2) - for detailed debugging information.
   *
   * @param event - The log message describing what happened
   * @param context - Optional contextual data to include with the log
   *
   * @example
   * ```typescript
   * log.debug('Cache miss')
   * log.debug('Query executed', { sql: 'SELECT * FROM users', duration: 45 })
   * ```
   */
  debug: Log
  /**
   * Log at trace level (1) - for very detailed trace information.
   *
   * @param event - The log message describing what happened
   * @param context - Optional contextual data to include with the log
   *
   * @example
   * ```typescript
   * log.trace('Function entered')
   * log.trace('State transition', { from: 'idle', to: 'processing' })
   * ```
   */
  trace: Log
  /**
   * Add context that will be included in all subsequent logs from this logger and its children.
   *
   * @remarks
   *
   * Context is merged deeply and propagates to child loggers. Useful for adding
   * request IDs, user IDs, or other contextual information that should appear in all logs.
   *
   * @param context - Contextual data to pin to this logger
   * @returns The logger instance for fluent chaining
   *
   * @example
   * ```typescript
   * const requestLog = log.child('request')
   * requestLog.addToContext({ requestId: 'abc123', userId: 'user456' })
   * requestLog.info('Processing')  // Includes requestId and userId
   * requestLog.debug('Cache miss')  // Also includes requestId and userId
   * ```
   */
  addToContext: (context: Context) => Logger // fluent
  /**
   * Create a child logger with a hierarchical namespace.
   *
   * @remarks
   *
   * Child loggers inherit context from their parent and form a hierarchical path.
   * For example, `log.child('app').child('router')` creates logs with path `app:router`.
   *
   * @param name - The name for this namespace segment (must match `/^[A-z_]+[A-z_0-9]*$/`)
   * @returns A new child logger instance
   *
   * @example
   * ```typescript
   * const log = Log.create()
   * const appLog = log.child('app')
   * const routerLog = appLog.child('router')
   *
   * log.info('Root')           // Path: root
   * appLog.info('App')         // Path: app
   * routerLog.info('Router')   // Path: app:router
   * ```
   */
  child: (name: string) => Logger // fluent
}

/**
 * Create a logger.
 */
export const create = (
  rootState: RootLogger.State,
  path: null | string[],
  parentContext?: Context,
): { logger: Logger; link: Link } => {
  if (path) validatePath(path)
  const state: State = {
    // Copy as addToContext will mutate it
    pinnedAndParentContext: parentContext ? cloneDeep(parentContext) : undefined,
    children: [],
  }

  const updateContextAndPropagate = (newContext: Context) => {
    state.pinnedAndParentContext = newContext
    state.children.forEach((child) => {
      child.onNewParentContext(state.pinnedAndParentContext!)
    })
  }

  const send = (levelLabel: Name, event: string, localContext: undefined | Context) => {
    const level = LEVELS[levelLabel].number
    const logRec: LogRecord = {
      event,
      level,
    }

    if (path) logRec.path = path

    if (Filter.test(rootState.settings.filter.patterns, logRec)) {
      // Avoid mutating the passed local context
      if (localContext && state.pinnedAndParentContext) {
        logRec.context = merge({}, state.pinnedAndParentContext, localContext)
      } else if (localContext) {
        logRec.context = localContext
      } else if (state.pinnedAndParentContext) {
        logRec.context = state.pinnedAndParentContext
      }

      if (rootState.settings?.data.hostname) {
        logRec.hostname = OS.hostname()
      }
      if (rootState.settings?.data.pid) {
        logRec.pid = process.pid
      }
      if (rootState.settings?.data.time) {
        logRec.time = Date.now()
      }
      rootState.settings.output.write(logRec, rootState.settings)
    }
  }

  const link: Link = {
    onNewParentContext: (newParentContext: Context) => {
      updateContextAndPropagate(
        merge(
          // Copy so that we don't mutate parent while maintaining local overrides...
          {},
          newParentContext,
          // ...this
          state.pinnedAndParentContext ?? {},
        ),
      )
    },
  }

  const logger: Logger = {
    fatal: (event, context) => {
      send(`fatal`, event, context)
    },
    error: (event, context) => {
      send(`error`, event, context)
    },
    warn: (event, context) => {
      send(`warn`, event, context)
    },
    info: (event, context) => {
      send(`info`, event, context)
    },
    debug: (event, context) => {
      send(`debug`, event, context)
    },
    trace: (event, context) => {
      send(`trace`, event, context)
    },
    addToContext: (context: Context) => {
      // Can safely mutate here, save some electricity...
      updateContextAndPropagate(merge(state.pinnedAndParentContext ?? {}, context))
      return logger
    },
    child: (name: string): Logger => {
      const { logger: child, link } = create(
        rootState,
        path ? path.concat([name]) : [name],
        state.pinnedAndParentContext,
      )
      state.children.push(link)
      return child
    },
  }

  return {
    logger,
    link,
  }
}

type Link = {
  onNewParentContext: (newContext: Context) => void
}

type State = {
  pinnedAndParentContext: Context | undefined
  children: Link[]
}

const validatePath = (path: string[]) => {
  path.forEach((part) => {
    if (!validPathSegmentNameRegex.test(part)) {
      throw new Error(`Invalid logger path segment: ${part}`)
    }
  })
}
