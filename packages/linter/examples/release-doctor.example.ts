import { Effect, Schema } from 'effect'
import { Finding, Linter } from '@kitz/linter'

const Lifecycle = Schema.Literal('official', 'candidate', 'ephemeral')
const Surface = Schema.Literal('preview', 'execution')
const DoctorInput = Schema.Struct({
  lifecycle: Schema.optional(Lifecycle),
  all: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

const PublishChannel = Schema.Struct({
  mode: Schema.Literal('manual', 'github-token', 'github-trusted'),
  workflow: Schema.optional(Schema.String),
  tokenEnv: Schema.optional(Schema.String),
})

const ReleaseConfig = Schema.Struct({
  trunk: Schema.String,
  publishing: Schema.Struct({
    official: PublishChannel,
    candidate: PublishChannel,
    ephemeral: PublishChannel,
  }),
})

const GitStatus = Schema.Struct({
  currentBranch: Schema.String,
  isClean: Schema.Boolean,
  existingTags: Schema.Array(Schema.String),
})

const ReleasePlan = Schema.Struct({
  lifecycle: Lifecycle,
  plannedPackages: Schema.Array(Schema.String),
  tags: Schema.Array(Schema.String),
})

const PullRequest = Schema.Struct({
  title: Schema.String,
  projectedHeader: Schema.NullOr(Schema.String),
})

type Lifecycle = typeof Lifecycle.Type
type DoctorInput = typeof DoctorInput.Type
type ReleaseConfig = typeof ReleaseConfig.Type
type GitStatus = typeof GitStatus.Type
type ReleasePlan = typeof ReleasePlan.Type
type PullRequest = typeof PullRequest.Type

const loadReleaseConfig = (_cwd: string): Effect.Effect<ReleaseConfig> =>
  Effect.succeed({
    trunk: 'main',
    publishing: {
      official: { mode: 'github-trusted', workflow: 'release.yml' },
      candidate: { mode: 'github-trusted', workflow: 'release.yml' },
      ephemeral: { mode: 'manual' },
    },
  })

const loadGitStatus = (_cwd: string): Effect.Effect<GitStatus> =>
  Effect.succeed({
    currentBranch: 'feat/release-linter',
    isClean: true,
    existingTags: ['@kitz/core@1.2.3'],
  })

const loadReleasePlan = (_cwd: string, lifecycle: Lifecycle): Effect.Effect<ReleasePlan> =>
  Effect.succeed({
    lifecycle,
    plannedPackages: ['@kitz/core', '@kitz/release'],
    tags:
      lifecycle === 'official'
        ? ['@kitz/core@1.2.4', '@kitz/release@0.4.0']
        : lifecycle === 'candidate'
          ? ['@kitz/core@1.2.4-next.1', '@kitz/release@0.4.0-next.1']
          : ['@kitz/core@0.0.0-pr.182.1.abcd1234'],
  })

const loadPullRequest = (_cwd: string): Effect.Effect<PullRequest | null> =>
  Effect.succeed({
    title: 'feat(core): stabilize release doctor',
    projectedHeader: 'feat(core): release 2 packages',
  })

const selectLifecycles = (input: DoctorInput): readonly Lifecycle[] => {
  if (input.lifecycle) return [input.lifecycle]
  if (input.all) return ['official', 'candidate', 'ephemeral']
  return ['official', 'candidate', 'ephemeral']
}

const ReleaseDoctor = Linter.create('release')
  .service('cwd', Schema.String)
  .fact('config', ReleaseConfig)
  .fact('gitStatus', GitStatus)
  .fact('releasePlan', Schema.NullOr(ReleasePlan))
  .fact('pullRequest', Schema.NullOr(PullRequest))
  .rule(
    Linter.rule('env.git-clean')
      .group('environment')
      .describe('git working directory has no uncommitted changes')
      .run(({ facts }) =>
        facts.gitStatus.isClean
          ? Effect.succeed(undefined)
          : Effect.succeed(
              Finding.fail({
                code: 'env.git-clean',
                message: 'Release apply should start from a clean working tree.',
                fix: {
                  kind: 'command',
                  summary: 'Stash local changes before retrying.',
                  command: 'git stash -u',
                },
              }),
            ),
      ),
  )
  .rule(
    Linter.rule('env.release-branch-allowed')
      .group('environment')
      .describe('official and candidate lifecycles must run from trunk')
      .needs('releasePlan')
      .run(({ facts }) => {
        if (facts.releasePlan.lifecycle === 'ephemeral') return Effect.succeed(undefined)

        return facts.gitStatus.currentBranch === facts.config.trunk
          ? Effect.succeed(undefined)
          : Effect.succeed(
              Finding.fail({
                code: 'env.release-branch-allowed',
                message: `${facts.releasePlan.lifecycle} releases must run from ${facts.config.trunk}.`,
                docs: [
                  {
                    label: 'release.config.ts',
                    url: 'https://github.com/jasonkuhrt/kitz/blob/main/release.config.ts',
                  },
                ],
              }),
            )
      }),
  )
  .rule(
    Linter.rule('env.publish-channel-ready')
      .group('environment')
      .describe('declared publish channel matches the active runtime')
      .input(
        Schema.Struct({
          surface: Surface,
        }),
      )
      .needs('releasePlan')
      .run(({ facts, input }) => {
        const channel = facts.config.publishing[facts.releasePlan.lifecycle]

        if (channel.mode === 'manual') {
          return Effect.succeed(
            Finding.pass({
              code: 'env.publish-channel-ready',
              message: `publish mode is manual for ${facts.releasePlan.lifecycle} (${input.surface})`,
            }),
          )
        }

        return Effect.succeed(
          Finding.pass({
            code: 'env.publish-channel-ready',
            message: `workflow ${channel.workflow ?? 'unknown'} is configured for ${facts.releasePlan.lifecycle}`,
          }),
        )
      }),
  )
  .rule(
    Linter.rule('plan.tags-unique')
      .group('plan')
      .describe('planned release tags do not already exist')
      .needs('releasePlan')
      .run(({ facts }) => {
        const collisions = facts.releasePlan.tags.filter((tag) =>
          facts.gitStatus.existingTags.includes(tag),
        )
        return collisions.length === 0
          ? Effect.succeed(undefined)
          : Effect.succeed(
              Finding.fail({
                code: 'plan.tags-unique',
                message: `planned tags already exist: ${collisions.join(', ')}`,
                fix: {
                  kind: 'guide',
                  summary: 'Regenerate the plan after fetching tags.',
                  steps: [
                    'git fetch --tags',
                    'release plan --lifecycle ' + facts.releasePlan.lifecycle,
                  ],
                },
              }),
            )
      }),
  )
  .rule(
    Linter.rule('pr.projected-squash-commit-sync')
      .group('pr')
      .describe('PR title matches the projected squash commit header')
      .needs('releasePlan', 'pullRequest')
      .input(
        Schema.Struct({
          projectedHeader: Schema.String,
        }),
      )
      .run(({ facts, input }) =>
        facts.pullRequest.title.startsWith(input.projectedHeader)
          ? Effect.succeed(undefined)
          : Effect.succeed(
              Finding.warn({
                code: 'pr.projected-squash-commit-sync',
                message: `PR title "${facts.pullRequest.title}" does not match "${input.projectedHeader}".`,
                fix: {
                  kind: 'command',
                  summary: 'Update the PR title to the projected release header.',
                  command: `release pr title apply --header "${input.projectedHeader}"`,
                },
              }),
            ),
      ),
  )
  .program(
    Linter.auditProgram('doctor.lifecycle')
      .input(
        Schema.Struct({
          lifecycle: Lifecycle,
          surface: Surface,
        }),
      )
      .collect(({ input, services }) =>
        Effect.gen(function* () {
          const [config, gitStatus, releasePlan, pullRequest] = yield* Effect.all([
            loadReleaseConfig(services.cwd),
            loadGitStatus(services.cwd),
            loadReleasePlan(services.cwd, input.lifecycle),
            loadPullRequest(services.cwd),
          ])

          return {
            config,
            gitStatus,
            releasePlan,
            pullRequest,
          }
        }),
      )
      .use('env.git-clean')
      .use('env.release-branch-allowed')
      .use('env.publish-channel-ready', {
        input: ({ input }) => ({ surface: input.surface }),
      })
      .use('plan.tags-unique')
      .use('pr.projected-squash-commit-sync', {
        inputWhen: ({ facts }) =>
          facts.pullRequest === null || facts.pullRequest.projectedHeader === null
            ? null
            : { projectedHeader: facts.pullRequest.projectedHeader },
      }),
  )
  .program(
    Linter.suiteProgram('doctor')
      .input(DoctorInput)
      .child('official', 'doctor.lifecycle', {
        inputWhen: ({ input }) =>
          selectLifecycles(input).includes('official')
            ? { lifecycle: 'official', surface: 'execution' }
            : null,
      })
      .child('candidate', 'doctor.lifecycle', {
        inputWhen: ({ input }) =>
          selectLifecycles(input).includes('candidate')
            ? { lifecycle: 'candidate', surface: 'execution' }
            : null,
      })
      .child('ephemeral', 'doctor.lifecycle', {
        inputWhen: ({ input }) =>
          selectLifecycles(input).includes('ephemeral')
            ? { lifecycle: 'ephemeral', surface: 'preview' }
            : null,
      }),
  )
  .build()

export const runReleaseDoctor = (cwd: string, input: DoctorInput) =>
  ReleaseDoctor.run({
    program: 'doctor',
    mode: 'check',
    input,
    services: { cwd },
    config: {
      defaults: { severity: 'error' },
    },
  })
