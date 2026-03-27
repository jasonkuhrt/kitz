import { Schema } from 'effect'

/**
 * Package-manager command surface recognized by kitz tooling.
 */
export const PackageManager = Schema.Enum({
  bun: 'bun',
  pnpm: 'pnpm',
  npm: 'npm',
  yarn: 'yarn',
  unknown: 'unknown',
} as const)

export type PackageManager = typeof PackageManager.Type

/**
 * How the package manager was inferred.
 */
export const DetectionSource = Schema.Enum({
  userAgent: 'user-agent',
  execPath: 'exec-path',
  manifest: 'manifest',
  lockfile: 'lockfile',
  runtime: 'runtime',
  unknown: 'unknown',
} as const)

export type DetectionSource = typeof DetectionSource.Type

export class DetectedPackageManager extends Schema.Class<DetectedPackageManager>(
  'DetectedPackageManager',
)({
  name: PackageManager,
  source: DetectionSource,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(DetectedPackageManager)
  static decode = Schema.decodeUnknownEffect(DetectedPackageManager)
  static decodeSync = Schema.decodeUnknownSync(DetectedPackageManager)
  static encode = Schema.encodeUnknownEffect(DetectedPackageManager)
  static encodeSync = Schema.encodeUnknownSync(DetectedPackageManager)
  static equivalence = Schema.toEquivalence(DetectedPackageManager)
  static ordered = false as const
}
