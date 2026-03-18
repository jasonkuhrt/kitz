import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Resource } from '@kitz/resource'
import { Effect, FileSystem, Result } from 'effect'
import type { Analysis } from '../../api/analyzer/models/__.js'
import type { Package } from '../../api/analyzer/workspace.js'
import type { Lifecycle } from '../../api/version/models/lifecycle.js'
import * as Api from '../../api/__.js'

type DoctorPlannerError =
  | Api.Explorer.ExplorerError
  | Api.Planner.Errors.ReleaseError
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
): Effect.Effect<
  Api.Planner.Plan,
  DoctorPlannerError,
  Env.Env | FileSystem.FileSystem | Git.Git
> => {
  switch (lifecycle) {
    case 'official':
      return Api.Planner.official(analysis, { packages }).pipe(
        Effect.map((plan): Api.Planner.Plan => plan),
      )
    case 'candidate':
      return Api.Planner.candidate(analysis, { packages }).pipe(
        Effect.map((plan): Api.Planner.Plan => plan),
      )
    case 'ephemeral':
      return Api.Planner.ephemeral(analysis, { packages }).pipe(
        Effect.map((plan): Api.Planner.Plan => plan),
      )
  }
}

export const computeLifecyclePlanAttempt = (
  analysis: Analysis,
  packages: readonly Package[],
  lifecycle: Lifecycle,
): Effect.Effect<
  Result.Result<Api.Planner.Plan, DoctorPlannerError>,
  never,
  Env.Env | FileSystem.FileSystem | Git.Git
> => computeLifecyclePlan(analysis, packages, lifecycle).pipe(Effect.result)

export const toUnavailableLifecycleReport = (
  lifecycle: Lifecycle,
  required: boolean,
  failure: unknown,
): Api.Doctor.UnavailableLifecycleReport => ({
  _tag: 'UnavailableLifecycleReport',
  lifecycle,
  required,
  reason: Err.ensure(failure).message,
})
