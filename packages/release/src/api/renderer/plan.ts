import { Str } from '@kitz/core'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import type { Item } from '../planner/models/item.js'
import type { Plan } from '../planner/models/plan.js'
import { renderTableText } from './table-core.js'

/**
 * Render a human-readable plan summary for CLI output.
 *
 * Returns a message indicating no releases if the plan is empty.
 */
export const renderPlan = (plan: Plan): string => {
  if (plan.releases.length === 0 && plan.cascades.length === 0) {
    return 'No releases planned.'
  }

  const output = Str.Builder()
  output`${formatLifecycle(plan.lifecycle)} release plan`

  if (plan.releases.length > 0) {
    output``
    output(renderPlanSection('Releases', [...plan.releases].sort(comparePlanReleaseRows)))
  }

  if (plan.cascades.length > 0) {
    output``
    output(renderPlanSection('Cascades', [...plan.cascades].sort(comparePlanCascadeRows)))
  }

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

const renderPlanSection = (title: string, items: readonly Item[]): string => {
  const output = Str.Builder()
  output`${title} (${String(items.length)})`
  output``
  output(
    renderTableText([
      ['Package', 'From', 'To', 'Bump', 'Commits'],
      ...items.map(formatPlanRow),
    ]),
  )
  return output.render()
}

const formatPlanRow = (release: Item): string[] => {
  return [
    release.package.name.moniker,
    Option.match(release.currentVersion, {
      onNone: () => 'new',
      onSome: (version) => Semver.toString(version),
    }),
    Semver.toString(release.nextVersion),
    release.bumpType ?? '-',
    String(release.commits.length),
  ]
}

const comparePlanReleaseRows = (a: Item, b: Item): number => {
  const commitDelta = b.commits.length - a.commits.length
  if (commitDelta !== 0) return commitDelta

  return a.package.name.moniker.localeCompare(b.package.name.moniker)
}

const comparePlanCascadeRows = (a: Item, b: Item): number => {
  return a.package.name.moniker.localeCompare(b.package.name.moniker)
}

const formatLifecycle = (value: Plan['lifecycle']): string => {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}
