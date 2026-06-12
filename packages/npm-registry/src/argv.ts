/**
 * Argv builders for package-manager pack/publish commands.
 *
 * This module is the single authority for how kitz constructs `pack` and
 * `publish` argument vectors across the supported package-manager CLIs.
 * Higher layers (the {@link NpmCli} service, release tooling providers)
 * must build their commands through these functions instead of hand-rolling
 * flag arrays.
 *
 * Builders are pure flag serializers:
 * - A flag is emitted if and only if its option is set (or its documented
 *   default applies).
 * - No filesystem types, no process spawning — callers own both.
 */

/**
 * Package manager CLIs supported for pack/publish operations.
 */
export type PackageManagerCli = 'npm' | 'pnpm' | 'bun'

// ============================================================================
// Pack
// ============================================================================

/**
 * Options for `npm pack` argv.
 */
export interface NpmPackArgvOptions {
  /** Destination directory for the generated tarball. */
  readonly packDestination: string
  /** Emit `--dry-run` (default: false). */
  readonly dryRun?: boolean | undefined
}

/**
 * Build argv for `npm pack`.
 *
 * Always emits `--json` so output is machine-readable.
 *
 * @example
 * ```ts
 * Argv.npmPack({ packDestination: '/repo/.release/artifacts/' })
 * // ['pack', '--json', '--pack-destination', '/repo/.release/artifacts/']
 * ```
 */
export const npmPack = (options: NpmPackArgvOptions): string[] => [
  'pack',
  '--json',
  '--pack-destination',
  options.packDestination,
  ...(options.dryRun === true ? ['--dry-run'] : []),
]

/**
 * Options for `pnpm pack` argv.
 */
export interface PnpmPackArgvOptions {
  /** Destination directory for the generated tarball. */
  readonly packDestination: string
  /** Emit `--dry-run` (default: false). */
  readonly dryRun?: boolean | undefined
}

/**
 * Build argv for `pnpm pack`.
 *
 * Always emits `--json` so output is machine-readable.
 */
export const pnpmPack = (options: PnpmPackArgvOptions): string[] => [
  'pack',
  '--json',
  '--pack-destination',
  options.packDestination,
  ...(options.dryRun === true ? ['--dry-run'] : []),
]

/**
 * Options for `bun pm pack` argv.
 */
export interface BunPackArgvOptions {
  /** Destination directory for the generated tarball (omitted when unset). */
  readonly destination?: string | undefined
  /**
   * Emit `--quiet` so stdout is only the tarball path (default: false).
   *
   * The {@link NpmCli} service passes `true` because it parses the tarball
   * path from stdout.
   */
  readonly quiet?: boolean | undefined
}

/**
 * Build argv for `bun pm pack`.
 *
 * bun has no `--json` pack output; pass {@link BunPackArgvOptions.quiet} to
 * make stdout parseable.
 */
export const bunPack = (options: BunPackArgvOptions = {}): string[] => [
  'pm',
  'pack',
  ...(options.quiet === true ? ['--quiet'] : []),
  ...(options.destination !== undefined ? ['--destination', options.destination] : []),
]

// ============================================================================
// Publish
// ============================================================================

/**
 * Options for `npm publish` argv.
 */
export interface NpmPublishArgvOptions {
  /** Tarball path or package directory to publish. */
  readonly target: string
  /** npm access level (default: 'public' — always emitted). */
  readonly access?: 'public' | 'restricted' | undefined
  /** Emit `--ignore-scripts` (default: true — release-safe tarball publish). */
  readonly ignoreScripts?: boolean | undefined
  /** npm dist-tag (omitted when unset). */
  readonly tag?: string | undefined
  /** Registry URL (omitted when unset). */
  readonly registry?: string | undefined
  /** One-time password (omitted when unset). */
  readonly otp?: string | undefined
  /** Emit `--provenance` (default: false). */
  readonly provenance?: boolean | undefined
  /** Precomputed provenance bundle path — emits `--provenance-file` (omitted when unset). */
  readonly provenanceFile?: string | undefined
  /** Emit `--dry-run` (default: false). */
  readonly dryRun?: boolean | undefined
}

/**
 * Build argv for `npm publish`.
 *
 * @example
 * ```ts
 * Argv.npmPublish({ target: '/repo/.release/artifacts/kitz-core-1.0.0.tgz' })
 * // ['publish', '/repo/.release/artifacts/kitz-core-1.0.0.tgz', '--access', 'public', '--ignore-scripts']
 * ```
 */
export const npmPublish = (options: NpmPublishArgvOptions): string[] => [
  'publish',
  options.target,
  '--access',
  options.access ?? 'public',
  ...((options.ignoreScripts ?? true) ? ['--ignore-scripts'] : []),
  ...(options.tag !== undefined ? ['--tag', options.tag] : []),
  ...(options.registry !== undefined ? ['--registry', options.registry] : []),
  ...(options.otp !== undefined ? ['--otp', options.otp] : []),
  ...(options.provenance === true ? ['--provenance'] : []),
  ...(options.provenanceFile !== undefined ? ['--provenance-file', options.provenanceFile] : []),
  ...(options.dryRun === true ? ['--dry-run'] : []),
]

/**
 * Options for `pnpm publish` argv.
 */
export interface PnpmPublishArgvOptions {
  /** Tarball path or package directory to publish (omitted when unset — pnpm publishes cwd). */
  readonly target?: string | undefined
  /** npm access level (omitted when unset — no implicit default). */
  readonly access?: 'public' | 'restricted' | undefined
  /** Emit `--ignore-scripts` (default: false). */
  readonly ignoreScripts?: boolean | undefined
  /**
   * Emit `--no-git-checks` (default: false).
   *
   * The {@link NpmCli} service passes `true` by default because it publishes
   * staged tarballs whose git state is irrelevant.
   */
  readonly noGitChecks?: boolean | undefined
  /** npm dist-tag (omitted when unset). */
  readonly tag?: string | undefined
  /** Registry URL (omitted when unset). */
  readonly registry?: string | undefined
  /** One-time password (omitted when unset). */
  readonly otp?: string | undefined
  /** Emit `--provenance` (default: false). */
  readonly provenance?: boolean | undefined
  /** Emit `--dry-run` (default: false). */
  readonly dryRun?: boolean | undefined
  /** Emit `--json` (default: false). */
  readonly json?: boolean | undefined
  /** Emit `--report-summary` (default: false). */
  readonly reportSummary?: boolean | undefined
}

/**
 * Build argv for `pnpm publish`.
 */
export const pnpmPublish = (options: PnpmPublishArgvOptions = {}): string[] => [
  'publish',
  ...(options.target !== undefined ? [options.target] : []),
  ...(options.access !== undefined ? ['--access', options.access] : []),
  ...(options.ignoreScripts === true ? ['--ignore-scripts'] : []),
  ...(options.noGitChecks === true ? ['--no-git-checks'] : []),
  ...(options.tag !== undefined ? ['--tag', options.tag] : []),
  ...(options.registry !== undefined ? ['--registry', options.registry] : []),
  ...(options.otp !== undefined ? ['--otp', options.otp] : []),
  ...(options.provenance === true ? ['--provenance'] : []),
  ...(options.dryRun === true ? ['--dry-run'] : []),
  ...(options.json === true ? ['--json'] : []),
  ...(options.reportSummary === true ? ['--report-summary'] : []),
]

/**
 * Options for `bun publish` argv.
 */
export interface BunPublishArgvOptions {
  /** Tarball path or package directory to publish (omitted when unset — bun publishes cwd). */
  readonly target?: string | undefined
  /** npm access level (omitted when unset — no implicit default). */
  readonly access?: 'public' | 'restricted' | undefined
  /** Emit `--ignore-scripts` (default: false). */
  readonly ignoreScripts?: boolean | undefined
  /** npm dist-tag (omitted when unset). */
  readonly tag?: string | undefined
  /** Registry URL (omitted when unset). */
  readonly registry?: string | undefined
  /** One-time password (omitted when unset). */
  readonly otp?: string | undefined
  /** Authentication flow — emits `--auth-type` (omitted when unset). */
  readonly authType?: 'web' | 'legacy' | undefined
  /** Emit `--dry-run` (default: false). */
  readonly dryRun?: boolean | undefined
  /** Emit `--tolerate-republish` (default: false). */
  readonly tolerateRepublish?: boolean | undefined
}

/**
 * Build argv for `bun publish`.
 */
export const bunPublish = (options: BunPublishArgvOptions = {}): string[] => [
  'publish',
  ...(options.target !== undefined ? [options.target] : []),
  ...(options.access !== undefined ? ['--access', options.access] : []),
  ...(options.ignoreScripts === true ? ['--ignore-scripts'] : []),
  ...(options.tag !== undefined ? ['--tag', options.tag] : []),
  ...(options.registry !== undefined ? ['--registry', options.registry] : []),
  ...(options.otp !== undefined ? ['--otp', options.otp] : []),
  ...(options.authType !== undefined ? ['--auth-type', options.authType] : []),
  ...(options.dryRun === true ? ['--dry-run'] : []),
  ...(options.tolerateRepublish === true ? ['--tolerate-republish'] : []),
]
