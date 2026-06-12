import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'graph'] as const

const CycleErrorContext = S.Struct({
  /**
   * Ids of the nodes that could not be layered.
   *
   * When an explicit cycle exists these are exactly the cycle members. When
   * the graph stalls without a detectable cycle (e.g. a dependency referencing
   * an unknown node), these are all nodes whose dependencies could not be
   * satisfied.
   */
  nodes: S.Array(S.String),
  /**
   * Dependency edges among the reported nodes, as `[dependent, dependency]`
   * pairs.
   */
  edges: S.Array(S.Tuple([S.String, S.String])),
})

/**
 * Raised when a dependency graph cannot be topologically layered.
 *
 * The context carries the node ids participating in the cycle (or the
 * unresolvable set when no explicit cycle is found) and the dependency edges
 * among them.
 */
export const CycleError: Err.TaggedContextualErrorClass<
  'GraphCycleError',
  typeof baseTags,
  typeof CycleErrorContext,
  undefined
> = Err.TaggedContextualError('GraphCycleError', baseTags, {
  context: CycleErrorContext,
  message: (ctx) => {
    const edges = ctx.edges.map(([from, to]) => `${from} -> ${to}`).join('; ')
    return `Cycle detected in graph among ${ctx.nodes.join(', ')}${edges === '' ? '' : `: ${edges}`}`
  },
})

export type CycleError = InstanceType<typeof CycleError>

/** Union of all errors from this package */
export type All = CycleError
