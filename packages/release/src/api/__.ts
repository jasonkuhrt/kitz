/**
 * @module api
 *
 * Public API surface of `@kitz/release`.
 *
 * The release pipeline flows through these modules in order:
 *
 * ```
 * Explorer  ─▶  Analyzer  ─▶  Planner   ─▶  Executor
 *   │              │              │              │
 *   │ env recon    │ impacts      │ plan         │ publish, tag, GH release
 *   │              │              │              │
 *   ▼              ▼              ▼              ▼
 * Forecaster ─▶ Commentator   Renderer       (side effects)
 *   │              │              │
 *   │ forecast     │ PR comment   │ CLI output
 * ```
 *
 * - **Explorer**: Gathers environmental reconnaissance (CI context, GitHub identity, credentials).
 * - **Analyzer**: Fetches commits, extracts per-package impacts, detects cascades.
 * - **Planner**: Applies version arithmetic (official/candidate/ephemeral) to produce a Plan.
 * - **Executor**: Publishes packages, creates tags, pushes tags, creates GitHub releases.
 * - **Forecaster**: Projects official versions for PR comment previews (lifecycle-agnostic).
 * - **Commentator**: Renders full PR comment markdown from a Forecast.
 * - **Renderer**: CLI-facing renderers (plan summary, tree visualization).
 * - **Lint**: Rule-based validation of environment, PR, and plan state.
 * - **Log**: Changelog generation from commit history.
 * - **Config**: Configuration loading and resolution.
 * - **Version**: Version calculation and lifecycle models.
 */

// Top-level convenience
export { defineConfig } from './config.js'

// Pipeline modules (in execution order)
export * as Analyzer from './analyzer/__.js'
export * as Executor from './executor/__.js'
export * as Explorer from './explorer/__.js'
export * as Planner from './planner/__.js'

// Projection modules (parallel to pipeline)
export * as Commentator from './commentator/__.js'
export * as Forecaster from './forecaster/__.js'
export * as Renderer from './renderer/__.js'

// Supporting modules
export * as Config from './config.js'
export * as Lint from './lint/__.js'
export * as Log from './log/__.js'
export * as Version from './version/__.js'
