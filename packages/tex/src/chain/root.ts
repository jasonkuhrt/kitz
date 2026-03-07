import type { Block } from '../nodes/block.js'
import type { BlockParameters } from '../nodes/block.js'
import type { BlockBuilder } from './block.js'
import { createBlockBuilder } from './block.js'
import type { Builder, BuilderInternal } from './helpers.js'
import { toInternalBuilder } from './helpers.js'

/**
 * Get terminal width from environment.
 * Priority: COLUMNS env var > process.stdout.columns > fallback
 */
const getTerminalWidth = (fallback: number): number => {
  if (typeof process === `undefined`) return fallback
  const envColumns = parseInt(process.env[`COLUMNS`] ?? ``, 10)
  if (!Number.isNaN(envColumns) && envColumns > 0) return envColumns
  return process.stdout?.columns ?? fallback
}

const withDefaultCrossMax = (
  spanRange: BlockParameters['spanRange'],
  defaultWidth: number,
): NonNullable<BlockParameters['spanRange']> => {
  return {
    ...(spanRange?.main === undefined
      ? {}
      : {
          main: {
            min: spanRange.main.min,
            max: spanRange.main.max,
          },
        }),
    cross:
      spanRange?.cross === undefined
        ? { max: defaultWidth }
        : {
            min: spanRange.cross.min,
            max: spanRange.cross.max ?? defaultWidth,
          },
  }
}

export const defaults = {
  /** @deprecated Use getTerminalWidth() for runtime evaluation */
  terminalWidth: 120,
} as const

export interface RootBuilder extends BlockBuilder<RootBuilder> {
  render(): string
}

export const createRootBuilder = (
  parameters?: BlockParameters & {
    /**
     * Terminal width in characters for rendering.
     * If not provided, detects from COLUMNS env var, then process.stdout.columns, then 120.
     */
    terminalWidth?: number
  },
): RootBuilder & BuilderInternal<Block> => {
  const builder = createBlockBuilder({ getSuperChain: () => builder }) as RootBuilder
  const builderInternal = toInternalBuilder(builder)

  const { terminalWidth, spanRange, ...otherParameters } = parameters ?? {}
  const defaultWidth = terminalWidth ?? getTerminalWidth(defaults.terminalWidth)

  builderInternal._.node.setParameters({
    spanRange: withDefaultCrossMax(spanRange, defaultWidth),
    ...otherParameters,
  })

  builder.render = () => render(builder)

  return builder as RootBuilder & BuilderInternal<Block>
}

export const render = (builder: Builder): string => {
  const internalBuilder = toInternalBuilder(builder)
  const rootNode = internalBuilder._.node

  // Extract spanRange constraint from root block (if it has one)
  const maxWidth =
    `spanRange` in rootNode.parameters ? rootNode.parameters.spanRange?.cross?.max : undefined

  const result = rootNode.render({
    maxWidth,
    index: {
      isFirst: true,
      isLast: true,
      position: 0,
      total: 1,
    },
  })
  return result.value
}
