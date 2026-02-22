import { Date, Lang, Str } from '@kitz/core'
import objectInspect from 'object-inspect'
import * as Os from 'os'
import * as Level from './level.js'
import * as Logger from './logger.js'

/**
 * Create a stop watch. Makes it simple to calculate elapsed time on every
 * invocation of `lap`.
 */
const createStopWatch = () => {
  let prev = globalThis.Date.now()
  return {
    lap: (): number => {
      const curr = globalThis.Date.now()
      const elapsed = curr - prev
      prev = curr
      return elapsed
    },
  }
}

const stopWatch = createStopWatch()

const LEVEL_STYLES: Record<Level.Name, { badge: string; color: (text: string) => string }> = {
  fatal: {
    badge: Str.Char.multiplicationX,
    color: (text) => Lang.colorize('red', text),
  },
  error: {
    badge: Str.Char.blackSquare,
    color: (text) => Lang.colorize('red', text),
  },
  warn: {
    badge: Str.Char.blackUpPointingTriangle,
    color: (text) => Lang.colorize('yellow', text),
  },
  info: {
    badge: Str.Char.blackCircle,
    color: (text) => Lang.colorize('green', text),
  },
  debug: {
    badge: Str.Char.whiteCircle,
    color: (text) => Lang.colorize('blue', text),
  },
  trace: {
    badge: Str.Char.emDash,
    color: (text) => Lang.colorize('magenta', text),
  },
}

export const separators = {
  path: {
    symbol: `:`,
  },
  event: {
    symbol: ` `,
  },
  context: {
    singleLine: {
      symbol: `  --  `,
      color: (text: string) => Lang.colorize('gray', text),
    },
    multiline: {
      symbol: ``,
    },
  },
  contextKeyVal: {
    singleLine: {
      symbol: `: `,
      color: (text: string) => Lang.colorize('gray', text),
    },
    multiline: {
      symbol: `  `,
    },
  },
  contextEntry: {
    singleLine: `  `,
    multiline: (
      gutterSpace: string,
    ): {
      symbol: string
      color: (text: string) => string
    } => ({
      symbol: gutterSpace + `| `,
      color: (text) => Lang.colorize('gray', text),
    }),
  },
}

export type Options = {
  levelLabel: boolean
  timeDiff: boolean
  color: boolean
}

export const render = (opts: Options, logRecord: Logger.LogRecord): string => {
  const terminalWidth = process.stdout.columns ?? 80
  const levelLabel = Level.LEVELS_BY_NUM[logRecord.level].label
  const style = LEVEL_STYLES[levelLabel]

  //
  // render time diff
  //

  let timeDiff = ``
  let timeDiffRendered = ``
  if (opts.timeDiff) {
    const elapsed = Date.format(stopWatch.lap())

    if (elapsed.unit === `ms`) {
      timeDiff = `${Str.Text.fit(String(elapsed.value), 4, 'right')} `
    } else if (elapsed.unit === `max`) {
      timeDiff = ` ∞ `
    } else {
      timeDiff = `${elapsed.unit} ${Str.Text.fit(String(elapsed.value), 2, 'right')} `
    }
    timeDiffRendered = Lang.colorize('gray', timeDiff)
  }

  //
  // render gutter
  //

  const levelLabelSized = opts.levelLabel ? ` ` + Str.Text.fit(levelLabel, 5, 'left') + ` ` : ` `

  const gutterRendered = `${timeDiffRendered}${style.color(`${style.badge}${levelLabelSized}`)}`

  // pre-emptyive measurement for potential multiline context indentation later on
  const gutterWidth = timeDiff.length + style.badge.length + levelLabelSized.length

  /**
   * Render Pre-Context
   *
   * Path is null when log came from root.
   */

  const path = logRecord.path?.join(renderEl(separators.path)) ?? ``
  const preContextWidth = path
    ? path.length + separators.event.symbol.length + logRecord.event.length
    : logRecord.event.length
  const preContextRendered = path
    ? style.color(path) + renderEl(separators.event) + logRecord.event
    : logRecord.event

  //
  // render context
  //

  // Factor in:
  // 1. the headers section
  // 2. the headers/context separator
  const availableSinglelineContextColumns = terminalWidth - gutterWidth - preContextWidth
    - separators.context.singleLine.symbol.length
  let contextColumnsConsumed = 0

  const contextEntries = logRecord.context ? Object.entries(logRecord.context) : []
  let widestKey = 0
  let first = true

  const contextEntriesRendered = contextEntries.map(([key, value]) => {
    // Track context space consumption of entry separators
    if (!first) contextColumnsConsumed += separators.contextEntry.singleLine.length
    else first = false

    // Track widest key optimistically for use in multiline layout later
    if (key.length > widestKey) widestKey = key.length

    contextColumnsConsumed += key.length + separators.contextKeyVal.singleLine.symbol.length

    const valueRendered = objectInspect(value, {
      indent: 2,
      depth: 20,
      maxStringLength: availableSinglelineContextColumns,
    })

    contextColumnsConsumed += Str.Visual.width(valueRendered)

    return [key, valueRendered]
  })

  const contextFitsSingleLine = contextColumnsConsumed <= availableSinglelineContextColumns

  let contextRendered = ``
  if (contextEntries.length > 0) {
    if (contextFitsSingleLine) {
      contextRendered = renderEl(separators.context.singleLine)
        + contextEntriesRendered
          .map(
            ([key, value]) =>
              `${Lang.colorize('gray', key ?? '')}${renderEl(separators.contextKeyVal.singleLine)}${value ?? ''}`,
          )
          .join(separators.contextEntry.singleLine)
    } else {
      const spineRendered = renderEl(separators.contextEntry.multiline(Str.repeat(` `, gutterWidth)))
      contextRendered = renderEl(separators.context.multiline)
        + `\n`
        + spineRendered
        + contextEntriesRendered
          .map(
            ([key, value]) =>
              `${Lang.colorize('gray', Str.Text.fit(key ?? '', widestKey, 'left'))}${
                renderEl(
                  separators.contextKeyVal.multiline,
                )
              }${
                Str.Text.formatBlock(value ?? '', {
                  prefix: spineRendered,
                  excludeFirstLine: true,
                  indent: widestKey + separators.contextKeyVal.multiline.symbol.length,
                })
              }`,
          )
          .join(`\n` + spineRendered)
    }
  }

  //
  // put it together
  //

  return `${gutterRendered}${preContextRendered}${contextRendered}${Os.EOL}`
}

type El = {
  symbol: string
  color?: (text: string) => string
}

const renderEl = (el: El) => {
  return el.color ? el.color(el.symbol) : el.symbol
}

export const Renderer = {
  render,
}
