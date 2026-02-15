import { Str } from '@kitz/core'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import type { RequestedCascadeAnalysis } from '../planner/cascade.js'
import type { Item } from '../planner/models/item.js'
import type { Plan } from '../planner/models/plan.js'

/**
 * Render a human-readable plan summary for CLI output.
 */
export const renderPlan = (plan: Plan): string => {
  const output = Str.Builder()
  output`Releases:`
  output``

  for (const release of plan.releases) {
    const current = Option.match(release.currentVersion, {
      onNone: () => 'new',
      onSome: (v) => Semver.toString(v),
    })
    const bump = release.bumpType ? ` (${release.bumpType})` : ''
    output`  ${release.package.name.moniker}: ${current} → ${Semver.toString(release.nextVersion)}${bump}`
    output`    ${String(release.commits.length)} commit${release.commits.length === 1 ? '' : 's'}`
  }

  if (plan.cascades.length > 0) {
    output``
    output`Cascades:`
    output``
    for (const cascade of plan.cascades) {
      output`  ${cascade.package.name.moniker}: ${Semver.toString(cascade.nextVersion)} (cascade)`
    }
  }

  output``
  return output.render()
}

/**
 * Render a status summary of releases for the `status` command.
 */
export const renderStatus = (releases: readonly Item[]): string => {
  const output = Str.Builder()
  output`Unreleased changes:`
  output``

  for (const release of releases) {
    const current = Option.match(release.currentVersion, {
      onNone: () => 'new',
      onSome: (v) => Semver.toString(v),
    })
    const bump = release.bumpType ? ` (${release.bumpType})` : ''
    output`  ${release.package.name.moniker}: ${current} → ${Semver.toString(release.nextVersion)}${bump}`
    output`    ${String(release.commits.length)} commit${release.commits.length === 1 ? '' : 's'}`
  }

  output``
  return output.render()
}

/**
 * Render confirmation prompt before applying a plan.
 */
export const renderApplyConfirmation = (plan: Plan): string => {
  const totalReleases = plan.releases.length + plan.cascades.length
  const output = Str.Builder()
  output`Applying ${plan.lifecycle} release plan...`
  output`${String(totalReleases)} package${totalReleases === 1 ? '' : 's'} to release`
  output``
  output`Releases:`
  for (const release of plan.releases) {
    output`  ${release.package.name.moniker}@${release.nextVersion.toString()}`
  }
  for (const cascade of plan.cascades) {
    output`  ${cascade.package.name.moniker}@${cascade.nextVersion.toString()} (cascade)`
  }
  output``
  output`This will:`
  output`  1. Run preflight checks`
  output`  2. Publish all packages to npm`
  output`  3. Create git tags`
  output`  4. Push tags to remote`
  output``
  output`Use --yes to skip this prompt.`
  return output.render()
}

/**
 * Render dry-run summary.
 */
export const renderApplyDryRun = (plan: Plan): string => {
  const totalReleases = plan.releases.length + plan.cascades.length
  const output = Str.Builder()
  output`[DRY RUN] Would execute:`
  for (const release of [...plan.releases, ...plan.cascades]) {
    output`  - Publish ${release.package.name.moniker}@${release.nextVersion.toString()}`
  }
  output`  - Create ${String(totalReleases)} git tag${totalReleases === 1 ? '' : 's'}`
  output`  - Push tags to origin`
  return output.render()
}

/**
 * Render completion summary.
 */
export const renderApplyDone = (releasedCount: number): string => {
  const output = Str.Builder()
  output``
  output`Done. ${String(releasedCount)} package${releasedCount === 1 ? '' : 's'} released.`
  return output.render()
}

/**
 * Render cascade analysis for the `status` command.
 */
export const renderCascadeAnalysis = (analyses: readonly RequestedCascadeAnalysis[]): string => {
  const output = Str.Builder()

  for (const analysis of analyses) {
    if (!analysis.packageName) {
      output`  ${analysis.requestedPackage}: not found`
      continue
    }

    if (analysis.cascades.length === 0) {
      output`  ${analysis.packageName}: no cascading releases`
      continue
    }

    output`  ${analysis.packageName}:`
    for (const cascade of analysis.cascades) {
      output`    → ${cascade.package.name.moniker}@${cascade.nextVersion.toString()}`
    }
  }

  return output.render()
}

/**
 * Render cascade details for a specific package.
 */
export const renderCascadeForPackage = (analysis: RequestedCascadeAnalysis): string => {
  const output = Str.Builder()

  if (!analysis.packageName) {
    output`Package "${analysis.requestedPackage}" not found in workspace`
    return output.render()
  }

  if (analysis.cascades.length === 0) {
    output`No cascading releases for ${analysis.packageName}`
    return output.render()
  }

  output`Cascading releases for ${analysis.packageName}:`
  for (const cascade of analysis.cascades) {
    output`  → ${cascade.package.name.moniker}@${cascade.nextVersion.toString()}`
  }

  return output.render()
}
