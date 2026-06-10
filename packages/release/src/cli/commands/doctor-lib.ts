import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Resource } from '@kitz/resource'
import { Effect, FileSystem, Result } from 'effect'
import type { Analysis } from '../../api/analyzer/models/__.js'
import type { Package } from '../../api/analyzer/workspace.js'
import type { Lifecycle } from '../../api/version/models/lifecycle.js'
import * as Doctor from '../../api/doctor.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Planner from '../../api/planner/__.js'

type DoctorPlannerError =
  | Explorer.ExplorerError
  | Planner.Errors.ReleaseError
  | Git.GitError
  | Git.GitParseError
  | Github.GithubError
  | Github.GithubNotFoundError
  | Github.GithubAuthError
  | Github.GithubRateLimitError
  | Resource.ResourceError

export const computeLifecyclePlan = (
  analysis: Analysis,
  packages: readonly Package[],
  lifecycle: Lifecycle,
): Effect.Effect<Planner.Plan, DoctorPlannerError, Env.Env | FileSystem.FileSystem | Git.Git> => {
  switch (lifecycle) {
    case 'official':
      return Planner.official(analysis, { packages }).pipe(Effect.map((plan): Planner.Plan => plan))
    case 'candidate':
      return Planner.candidate(analysis, { packages }).pipe(
        Effect.map((plan): Planner.Plan => plan),
      )
    case 'ephemeral':
      return Planner.ephemeral(analysis, { packages }).pipe(
        Effect.map((plan): Planner.Plan => plan),
      )
  }
}

export const computeLifecyclePlanAttempt = (
  analysis: Analysis,
  packages: readonly Package[],
  lifecycle: Lifecycle,
): Effect.Effect<
  Result.Result<Planner.Plan, DoctorPlannerError>,
  never,
  Env.Env | FileSystem.FileSystem | Git.Git
> => computeLifecyclePlan(analysis, packages, lifecycle).pipe(Effect.result)

export const toUnavailableLifecycleReport = (
  lifecycle: Lifecycle,
  required: boolean,
  failure: unknown,
): Doctor.UnavailableLifecycleReport => ({
  _tag: 'UnavailableLifecycleReport',
  lifecycle,
  required,
  reason: Err.ensure(failure).message,
})
