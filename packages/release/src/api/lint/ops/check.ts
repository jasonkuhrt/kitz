import { Obj } from '@kitz/core'
import { Git } from '@kitz/git'
import { Effect, ParseResult, Schema } from 'effect'
import type { ResolvedConfig } from '../models/config.js'
import * as Precondition from '../models/precondition.js'
import { Failed, Finished, Report, RuleCheckResult, Skipped } from '../models/report.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { Violation } from '../models/violation.js'
import * as Rules from '../rules/__.js'
import { type EvaluatedPreconditions, EvaluatedPreconditionsService } from '../services/preconditions.js'
import { RuleOptionsService } from '../services/rule-options.js'

const allRules = Obj.values(Rules) as RuntimeRule.RuntimeRule[]

export interface CheckParams {
  config: ResolvedConfig
}

/** Rule with resolved metadata for execution. */
interface ResolvedRule {
  readonly rule: RuntimeRule.RuntimeRule
  /** Whether this rule was explicitly requested (true/onlyRules) vs auto. */
  readonly explicitlyRequested: boolean
}

interface RulesToRun {
  /** Enabled rules, split by filter status. */
  readonly active: {
    /** Rules that will run. */
    readonly included: ResolvedRule[]
    /** Rules filtered out by onlyRules/skipRules. */
    readonly excluded: RuntimeRule.RuntimeRule[]
  }
  /** Disabled rules (not reported). */
  readonly inactive: RuntimeRule.RuntimeRule[]
}

/**
 * Check if a rule ID matches a filter pattern.
 * Supports exact match or namespace glob (e.g., 'pr.*' matches 'pr.type.match-known').
 */
const matchesFilter = (ruleId: string, pattern: string): boolean => {
  if (pattern.endsWith('.*')) {
    const namespace = pattern.slice(0, -2)
    return ruleId.startsWith(namespace + '.')
  }
  return ruleId === pattern
}

/**
 * Check if a rule ID matches any filter in the list.
 */
const matchesAnyFilter = (ruleId: string, filters: readonly string[]): boolean => {
  return filters.some((pattern) => matchesFilter(ruleId, pattern))
}

/**
 * Resolve which rules to run based on enabled state and filters.
 */
const resolveRulesToRun = (
  rules: readonly RuntimeRule.RuntimeRule[],
  config: ResolvedConfig,
): RulesToRun => {
  const active: { included: ResolvedRule[]; excluded: RuntimeRule.RuntimeRule[] } = { included: [], excluded: [] }
  const inactive: RuntimeRule.RuntimeRule[] = []

  for (const rule of rules) {
    // Resolve enabled: per-rule config > rule defaults > global defaults
    const ruleConfig = config.rules[rule.data.id]
    const enabled = ruleConfig?.overrides.enabled
      ?? rule.data.defaults?.enabled
      ?? config.defaults.enabled

    if (enabled === false) {
      inactive.push(rule)
      continue
    }

    // Check filters (with glob support)
    const hasOnlyFilter = config.onlyRules !== undefined && config.onlyRules.length > 0
    const matchesOnly = !hasOnlyFilter || matchesAnyFilter(rule.data.id, config.onlyRules!)
    const matchesSkip = config.skipRules && config.skipRules.length > 0
      && matchesAnyFilter(rule.data.id, config.skipRules)

    if (matchesOnly && !matchesSkip) {
      // Rule is explicitly requested if:
      // 1. enabled is true (not 'auto'), OR
      // 2. It's in onlyRules (user explicitly asked for this rule)
      const explicitlyRequested = enabled === true || (hasOnlyFilter && matchesOnly)
      active.included.push({ rule, explicitlyRequested })
    } else {
      active.excluded.push(rule)
    }
  }

  return { active, inactive }
}

/**
 * Evaluate whether a single precondition is satisfied.
 */
const evaluatePrecondition = (
  precondition: Precondition.Precondition,
  evaluated: EvaluatedPreconditions,
): boolean => {
  if (Precondition.HasOpenPR.is(precondition)) return evaluated.hasOpenPR
  if (Precondition.HasDiff.is(precondition)) return evaluated.hasDiff
  if (Precondition.IsMonorepo.is(precondition)) return evaluated.isMonorepo
  if (Precondition.HasGitHubAccess.is(precondition)) return evaluated.hasGitHubAccess
  if (Precondition.HasReleasePlan.is(precondition)) return evaluated.hasReleasePlan
  // Exhaustive check - if we add new preconditions, TypeScript will error here
  return precondition satisfies never
}

/**
 * Evaluate all preconditions for a rule.
 * Returns the list of failed preconditions (empty if all pass).
 */
const evaluatePreconditions = (
  preconditions: readonly Precondition.Precondition[],
  evaluated: EvaluatedPreconditions,
): Precondition.Precondition[] => {
  return preconditions.filter((p) => !evaluatePrecondition(p, evaluated))
}

/**
 * Run lint rules and produce a report.
 */
export const check = (
  params: CheckParams,
): Effect.Effect<
  Report,
  ParseResult.ParseError | Git.GitError | Git.GitParseError,
  EvaluatedPreconditionsService | Git.Git
> => {
  const { config } = params
  const { active } = resolveRulesToRun(allRules, config)

  return Effect.gen(function*() {
    const preconditions = yield* EvaluatedPreconditionsService
    const results: RuleCheckResult[] = []

    // Add skipped results for filtered-out rules
    for (const rule of active.excluded) {
      results.push(Skipped.make({
        rule: { id: rule.data.id, description: rule.data.description },
        reason: 'filtered',
      }))
    }

    // Run included rules
    for (const { rule, explicitlyRequested } of active.included) {
      const result = yield* checkRule(rule, config, explicitlyRequested, preconditions)
      results.push(result)
    }

    return Report.make({ results })
  })
}

const checkRule = (
  rule: RuntimeRule.RuntimeRule,
  config: ResolvedConfig,
  explicitlyRequested: boolean,
  preconditions: EvaluatedPreconditions,
): Effect.Effect<RuleCheckResult, ParseResult.ParseError | Git.GitError | Git.GitParseError, Git.Git> => {
  return Effect.gen(function*() {
    const ruleRef = { id: rule.data.id, description: rule.data.description }

    // Evaluate preconditions
    const failedPreconditions = evaluatePreconditions(rule.data.preconditions, preconditions)

    if (failedPreconditions.length > 0) {
      if (explicitlyRequested) {
        // Explicitly requested but preconditions not met → Error
        const failedNames = failedPreconditions.map((p) => p._tag.replace('Precondition', ''))
        return Failed.make({
          rule: ruleRef,
          duration: 0,
          error: new Error(`Preconditions not met: ${failedNames.join(', ')}`),
        })
      } else {
        // Auto-enabled and preconditions not met → Skip silently
        return Skipped.make({
          rule: ruleRef,
          reason: 'preconditions-not-met',
        })
      }
    }

    // Get rule options from config
    const rawOptions = config.rules[rule.data.id]?.options ?? {}

    // Validate options against rule's schema (if defined)
    const options = rule.optionsSchema
      ? yield* Schema.decodeUnknown(rule.optionsSchema)(rawOptions)
      : rawOptions

    // Run the check with options provided
    const start = performance.now()

    const result = yield* rule.check.pipe(
      Effect.provideService(RuleOptionsService, options),
    )

    const duration = performance.now() - start

    // Normalize result: can be undefined, Violation, or { violation?, metadata? }
    const { violation, metadata } = normalizeCheckResult(result)

    return Finished.make({
      rule: ruleRef,
      duration,
      violation,
      metadata,
    })
  })
}

/**
 * Normalize check result to extract violation and metadata.
 *
 * Handles three forms:
 * - `undefined` → no violation, no metadata
 * - `Violation` → has violation, no metadata
 * - `{ violation?, metadata? }` → may have both
 */
const normalizeCheckResult = (
  result: RuntimeRule.CheckResult,
): { violation?: Violation; metadata?: unknown } => {
  if (result === undefined) {
    return {}
  }
  if (Violation.is(result)) {
    return { violation: result }
  }
  // Build result object, only including defined properties
  const normalized: { violation?: Violation; metadata?: unknown } = {}
  if (result.violation !== undefined) normalized.violation = result.violation
  if (result.metadata !== undefined) normalized.metadata = result.metadata
  return normalized
}
