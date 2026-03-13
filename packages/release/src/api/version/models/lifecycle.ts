import { Schema as S } from 'effect'

/**
 * Release lifecycle type.
 *
 * Determines how versions are calculated and what side effects occur:
 *
 * - **official** — Standard semver release. Bump determined by conventional commits
 *   (feat -> minor, fix -> patch, breaking -> major). Published to `latest` dist-tag.
 *   Version format: `<major>.<minor>.<patch>`
 *
 * - **candidate** — Pre-release for testing before an official release.
 *   Uses the projected official version with a `-next.<N>` suffix.
 *   Published to `next` dist-tag.
 *   Version format: `<base>-next.<iteration>`
 *
 * - **ephemeral** — PR-scoped release for integration testing.
 *   Uses a zero base version with PR metadata in the prerelease segment.
 *   Published to a per-PR dist-tag.
 *   Version format: `0.0.0-pr.<prNumber>.<iteration>.<sha>`
 */
export const LifecycleSchema = S.Literals(['official', 'candidate', 'ephemeral'])
export type Lifecycle = typeof LifecycleSchema.Type
