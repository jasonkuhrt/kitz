import { Str } from '@kitz/core'
import { type CascadeExplanation, type PackageExplanation } from '../planner/explain.js'

const formatCurrentVersion = (currentVersion: string | null): string => currentVersion ?? 'new'

const renderDependencyPath = (explanation: CascadeExplanation): string[] =>
  explanation.dependencyPaths.map((path) => path.packages.map((pkg) => pkg.name).join(' -> '))

export const renderExplanation = (explanation: PackageExplanation): string => {
  const output = Str.Builder()

  if (explanation.decision === 'missing') {
    output`Package "${explanation.requestedPackage}" was not found in the workspace.`
    output``
    output`Available package identifiers:`
    for (const identifier of explanation.availablePackages) {
      output`- ${identifier}`
    }
    return output.render()
  }

  output`release explain ${explanation.package.name}`
  output``
  output`Outcome: ${explanation.decision}`
  output`Current version: ${formatCurrentVersion(explanation.currentVersion)}`

  if (explanation.decision !== 'unchanged') {
    output`Next official version: ${explanation.nextOfficialVersion}`
    output`Bump: ${explanation.bump}`
  }

  output``
  output`Why:`

  if (explanation.decision === 'primary') {
    output`- ${String(explanation.commits.length)} unreleased scoped commit${explanation.commits.length === 1 ? '' : 's'} matched "${explanation.package.scope}".`
    output``
    output`Commits:`
    for (const commit of explanation.commits) {
      const scopedCommit = commit.forScope(explanation.package.scope)
      const shortHash = String(commit.hash).slice(0, 7)
      output`- ${shortHash} ${scopedCommit.type}${scopedCommit.breaking ? '!' : ''}: ${scopedCommit.description}`
    }
    return output.render()
  }

  if (explanation.decision === 'cascade') {
    output`- no unreleased scoped commits matched "${explanation.package.scope}".`
    output`- a runtime dependency release path reaches this package, so it needs a cascade patch release.`

    if (explanation.triggeredBy.length > 0) {
      output``
      output`Triggered by:`
      for (const pkg of explanation.triggeredBy) {
        output`- ${pkg.name}`
      }
    }

    if (explanation.dependencyPaths.length > 0) {
      output``
      output`Dependency paths:`
      for (const path of renderDependencyPath(explanation)) {
        output`- ${path}`
      }
    }

    return output.render()
  }

  output`- no unreleased scoped commits matched "${explanation.package.scope}".`
  output`- no runtime dependency release path reaches this package.`
  return output.render()
}
