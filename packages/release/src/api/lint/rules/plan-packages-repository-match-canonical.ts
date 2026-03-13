import { Env } from '@kitz/env'
import { Effect } from 'effect'
import { resolveReleaseTarget } from '../../explorer/explore.js'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import * as Severity from '../models/severity.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment, File } from '../models/violation-location.js'
import { loadPlannedManifests, summarizePackages } from './package-manifest-shared.js'

const extractRepositoryTarget = (repository: unknown): string | null => {
  const value =
    typeof repository === 'string'
      ? repository
      : typeof repository === 'object' && repository !== null && 'url' in repository
        ? repository.url
        : undefined

  if (typeof value !== 'string') return null

  const githubShorthand = value.match(/^github:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (githubShorthand) {
    return `${githubShorthand[1]}/${githubShorthand[2]}`
  }

  const githubUrl = value.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (githubUrl) {
    return `${githubUrl[1]}/${githubUrl[2]}`
  }

  return null
}

/** Advises when planned packages point at a repo other than the canonical GitHub release target. */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('plan.packages-repository-match-canonical'),
  description: 'planned package repository metadata points at the canonical GitHub repo',
  defaults: RuleDefaults.make({ severity: Severity.Warn.make({}) }),
  preconditions: [new Precondition.HasReleasePlan()],
  check: Effect.gen(function* () {
    const env = yield* Env.Env
    const manifests = yield* loadPlannedManifests
    const target = yield* resolveReleaseTarget(env.vars).pipe(Effect.result)

    if (target._tag === 'Failure') {
      return Violation.make({
        location: Environment.make({
          message: target.failure.message,
        }),
        summary: 'Canonical GitHub repo could not be resolved for repository provenance checks.',
        detail:
          'This check compares planned package manifests against the GitHub repo that owns the release workflow. ' +
          'Without a resolvable canonical repo, source links and trusted-publishing guidance are guesswork.',
        hints: [
          Hint.make({
            description:
              'Set `GITHUB_REPOSITORY="owner/repo"` in CI or configure a GitHub `origin` remote locally.',
          }),
        ],
        docs: [
          DocLink.make({
            label: 'npm trusted publishers',
            url: 'https://docs.npmjs.com/trusted-publishers/',
          }),
        ],
      })
    }

    const canonicalRepo = `${target.success.owner}/${target.success.repo}`
    const offenders = manifests.filter((entry) => {
      const repositoryTarget = extractRepositoryTarget(entry.manifest.repository)
      return repositoryTarget !== null && repositoryTarget !== canonicalRepo
    })

    if (offenders.length === 0) {
      return {
        metadata: {
          canonicalRepo,
          packageCount: manifests.length,
        },
      }
    }

    const example = offenders[0]!
    const names = offenders.map((entry) => entry.packageName)
    const repositoryTarget = extractRepositoryTarget(example.manifest.repository)

    return Violation.make({
      location:
        offenders.length === 1
          ? File.make({ path: example.packageJsonPath })
          : Environment.make({
              message: `${String(offenders.length)} planned packages point at a different repository.`,
            }),
      summary: `Repository metadata should point at ${canonicalRepo}, but ${summarizePackages(names)} ${names.length === 1 ? 'does' : 'do'} not.`,
      detail:
        'Publish provenance, source links, and trusted-publisher setup all assume package manifests point back to the same canonical GitHub repository that owns the release workflow.',
      hints: [
        Hint.make({
          description: `Set \`repository.url\` to \`git+https://github.com/${canonicalRepo}.git\`.`,
        }),
        ...(repositoryTarget
          ? [
              Hint.make({
                description: `The current repository target resolves to \`${repositoryTarget}\`.`,
              }),
            ]
          : []),
      ],
      docs: [
        DocLink.make({
          label: 'npm package.json repository field',
          url: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json',
        }),
        DocLink.make({
          label: 'npm trusted publishers',
          url: 'https://docs.npmjs.com/trusted-publishers/',
        }),
      ],
    })
  }),
})
