import { Lang } from '#lang'

/**
 * Rounding mode for allocation results.
 */
export type RoundingMode = 'floor' | 'ceil' | 'round' | 'none'

/**
 * Options for allocation functions.
 */
export interface Options {
  /**
   * Rounding mode for allocation results.
   * @default 'none'
   */
  round?: RoundingMode
}

const applyRounding = (value: number, mode: RoundingMode): number => {
  switch (mode) {
    case 'floor':
      return Math.floor(value)
    case 'ceil':
      return Math.ceil(value)
    case 'round':
      return Math.round(value)
    case 'none':
      return value
    default:
      return Lang.neverCase(mode)
  }
}

const applyRoundingToArray = (values: number[], mode: RoundingMode): number[] => {
  if (mode === 'none') return values
  return values.map((v) => applyRounding(v, mode))
}

/**
 * Capped fair allocation - distribute budget fairly, respecting individual caps.
 *
 * If sum(demands) ≤ budget, return demands as-is.
 * Otherwise, iteratively give smaller demands their full amount and redistribute surplus.
 *
 * @example
 * ```ts
 * // Sum fits in budget → use demands
 * capped([1, 2, 3], 10) // [1, 2, 3]
 *
 * // Sum exceeds budget, all exceed even share → split evenly
 * capped([4, 4], 6) // [3, 3]
 *
 * // Sum exceeds budget, some fit → redistribute surplus
 * capped([1, 4, 4], 6) // [1, 2.5, 2.5]
 * capped([1, 4, 4], 6, { round: 'floor' }) // [1, 2, 2]
 * ```
 */
export const capped = (demands: number[], budget: number, options?: Options): number[] => {
  const round = options?.round ?? 'none'
  const totalDemand = demands.reduce((a, b) => a + b, 0)

  if (totalDemand <= budget) {
    return demands
  }

  const allocations = Array.from({ length: demands.length }, () => -1)
  const remaining = new Set(demands.map((_, i) => i))
  let available = budget

  while (remaining.size > 0) {
    const evenShare = available / remaining.size
    let anyRemoved = false

    for (const index of remaining) {
      const demand = demands[index]!
      if (demand <= evenShare) {
        allocations[index] = demand
        available -= demand
        remaining.delete(index)
        anyRemoved = true
      }
    }

    if (!anyRemoved) {
      const finalShare = available / remaining.size
      for (const index of remaining) {
        allocations[index] = finalShare
      }
      break
    }
  }

  return applyRoundingToArray(allocations, round)
}

/**
 * Proportional allocation - scale demands proportionally to fit budget.
 *
 * Each allocation = demand × (budget / sum(demands))
 *
 * @example
 * ```ts
 * proportional([1, 2, 3], 12) // [2, 4, 6]
 * proportional([10, 20, 30], 30) // [5, 10, 15]
 * ```
 */
export const proportional = (demands: number[], budget: number, options?: Options): number[] => {
  const round = options?.round ?? 'none'
  const totalDemand = demands.reduce((a, b) => a + b, 0)

  if (totalDemand === 0) {
    return demands.map(() => 0)
  }

  const ratio = budget / totalDemand
  const allocations = demands.map((d) => d * ratio)

  return applyRoundingToArray(allocations, round)
}

/**
 * Equal allocation - divide budget equally.
 *
 * @example
 * ```ts
 * equal(3, 12) // [4, 4, 4]
 * equal(4, 10) // [2.5, 2.5, 2.5, 2.5]
 * equal(4, 10, { round: 'floor' }) // [2, 2, 2, 2]
 * ```
 */
export const equal = (count: number, budget: number, options?: Options): number[] => {
  const round = options?.round ?? 'none'

  if (count <= 0) {
    return []
  }

  const share = budget / count
  const allocations = Array.from({ length: count }, () => share)

  return applyRoundingToArray(allocations, round)
}

/**
 * Priority allocation - allocate to items in order until budget exhausted.
 *
 * Earlier items get their full demand first. Later items get remaining budget.
 *
 * @example
 * ```ts
 * priority([3, 3, 3], 5) // [3, 2, 0]
 * priority([2, 2, 2], 10) // [2, 2, 2]
 * ```
 */
export const priority = (demands: number[], budget: number, options?: Options): number[] => {
  const round = options?.round ?? 'none'
  const allocations: number[] = []
  let remaining = budget

  for (const demand of demands) {
    if (remaining >= demand) {
      allocations.push(demand)
      remaining -= demand
    } else {
      allocations.push(Math.max(0, remaining))
      remaining = 0
    }
  }

  return applyRoundingToArray(allocations, round)
}
