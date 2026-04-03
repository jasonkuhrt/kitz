import { Str } from '@kitz/core'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import type { Item } from '../planner/models/item.js'
import type { Plan } from '../planner/models/plan.js'
import { formatGithubReleaseTitle, type PublishSemantics } from '../publishing.js'
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
export const renderApplyConfirmation = (plan: Plan, semantics: PublishSemantics): string => {
  const totalReleases = plan.releases.length + plan.cascades.length
  const output = Str.Builder()
  output`Applying ${plan.lifecycle} release plan...`
  output`${String(totalReleases)} package${totalReleases === 1 ? '' : 's'} to release`
  output`npm dist-tag: ${semantics.distTag}`
  output``
  output`Releases:`
  for (const release of plan.releases) {
    output`  ${formatApplyReleaseLine(release, semantics)}`
  }
  for (const cascade of plan.cascades) {
    output`  ${formatApplyReleaseLine(cascade, semantics, true)}`
  }
  output``
  output`This will:`
  output`  1. Run preflight checks`
  output`  2. Prepare publishable tarballs for every package`
  output`  3. Publish all packages to npm`
  output`  4. Create and push git tags`
  output`  5. Create GitHub releases`
  output``
  output`Use --dry-run to preview without side effects, or --yes to skip this prompt.`
  return output.render()
}

/**
 * Render dry-run summary.
 */
export const renderApplyDryRun = (plan: Plan, semantics: PublishSemantics): string => {
  const output = Str.Builder()
  output`[DRY RUN] Would execute ${plan.lifecycle} release plan`
  output`npm dist-tag: ${semantics.distTag}`
  output``
  for (const release of [...plan.releases, ...plan.cascades]) {
    output`  - ${formatApplyReleaseLine(release, semantics, plan.cascades.includes(release))}`
  }
  output``
  output`Would also run preflight checks, prepare tarballs, publish to npm, push git tags, and create GitHub releases.`
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
    renderTableText([['Package', 'From', 'To', 'Bump', 'Commits'], ...items.map(formatPlanRow)]),
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

const formatApplyReleaseLine = (
  release: Item,
  semantics: PublishSemantics,
  cascade = false,
): string => {
  const version = release.nextVersion.toString()
  const tag = Pkg.Pin.toString(
    Pkg.Pin.Exact.make({ name: release.package.name, version: release.nextVersion }),
  )
  const githubRelease = formatGithubReleaseTitle(semantics, {
    packageName: release.package.name.moniker,
    version,
  })

  return `${release.package.name.moniker}@${version}${
    cascade ? ' (cascade)' : ''
  } -> npm \`${semantics.distTag}\`, git \`${tag}\`, GitHub \`${githubRelease}\``
}
