import { Str } from '@kitz/core'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import type { RequestedCascadeAnalysis } from '../cascade.js'
import type { Item } from './models/item.js'
import type { Plan } from './models/plan.js'

const renderVersion = (version: Semver.Semver): string => version.toString()

const formatReleaseBlock = (release: Item, prefix: string = ''): string => {
  const current = release.currentVersion.pipe(Option.map(renderVersion), Option.getOrElse(() => '(none)'))
  const next = renderVersion(release.nextVersion)
  const commitCount = release.commits.length

  return [
    `${prefix}${release.package.name}`,
    `${prefix}  ${current} → ${next} (${release.bumpType ?? 'cascade'})`,
    `${prefix}  ${commitCount} commit${commitCount === 1 ? '' : 's'}`,
  ].join(Str.Char.newline)
}

const formatStatusRelease = (release: Item): string => {
  const current = release.currentVersion.pipe(Option.map(renderVersion), Option.getOrElse(() => '(none)'))
  const next = renderVersion(release.nextVersion)
  const commitCount = release.commits.length

  return [
    `${release.package.name} (${current} → ${next}) [${release.bumpType ?? 'cascade'}]`,
    `  ${commitCount} commit${commitCount === 1 ? '' : 's'}`,
  ].join(Str.Char.newline)
}

export const renderStatus = (releases: readonly Item[]): string => {
  const output = Str.Builder()
  output`Unreleased changes:`
  output``
  for (const release of releases) {
    output(formatStatusRelease(release))
    output``
  }
  return output.render()
}

export const renderCascadeForPackage = (
  packageName: string,
  dependents: readonly Item[],
): string => {
  if (dependents.length === 0) {
    return `${packageName}: No cascades needed`
  }

  const lines = [`${packageName}:`]
  for (const dependent of dependents) {
    const version = dependent.currentVersion.pipe(Option.getOrElse(() => Semver.zero))
    lines.push(`  ├── ${dependent.package.name} depends (workspace:* → ^${renderVersion(version)})`)
  }
  return lines.join(Str.Char.newline)
}

export const renderCascadeAnalysis = (results: readonly RequestedCascadeAnalysis[]): string => {
  const output = Str.Builder()
  output``
  output`Cascade analysis:`
  output``

  for (const result of results) {
    if (!result.packageName) {
      output`${result.requestedPackage}: Not found`
      continue
    }
    output(renderCascadeForPackage(result.packageName, result.cascades))
  }

  return output.render()
}

export const renderPlan = (plan: Pick<Plan, 'releases' | 'cascades'>): string => {
  const output = Str.Builder()
  output`Primary releases:`
  for (const release of plan.releases) {
    output(formatReleaseBlock(release, '  '))
    output``
  }

  if (plan.cascades.length > 0) {
    output`Cascade releases (dependencies):`
    for (const cascade of plan.cascades) {
      output(formatReleaseBlock(cascade, '  '))
      output``
    }
  }

  return output.render()
}

export const renderApplyConfirmation = (plan: Plan): string => {
  const totalReleases = plan.releases.length + plan.cascades.length
  const output = Str.Builder()
  output`Applying ${plan.type} release plan...`
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

export const renderApplyDone = (releasedCount: number): string => {
  const output = Str.Builder()
  output``
  output`Done. ${String(releasedCount)} package${releasedCount === 1 ? '' : 's'} released.`
  return output.render()
}
