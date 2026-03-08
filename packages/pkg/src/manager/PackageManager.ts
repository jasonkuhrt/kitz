import { Schema } from 'effect'

/**
 * Package-manager command surface recognized by kitz tooling.
 */
export const PackageManager = Schema.Enums({
  bun: 'bun',
  pnpm: 'pnpm',
  npm: 'npm',
  yarn: 'yarn',
  unknown: 'unknown',
} as const)

export type PackageManager = Schema.Schema.Type<typeof PackageManager>

/**
 * How the package manager was inferred.
 */
export const DetectionSource = Schema.Enums({
  userAgent: 'user-agent',
  execPath: 'exec-path',
  manifest: 'manifest',
  lockfile: 'lockfile',
  runtime: 'runtime',
  unknown: 'unknown',
} as const)

export type DetectionSource = Schema.Schema.Type<typeof DetectionSource>

export class DetectedPackageManager extends Schema.Class<DetectedPackageManager>(
  'DetectedPackageManager',
)({
  name: PackageManager,
  source: DetectionSource,
}) {}
