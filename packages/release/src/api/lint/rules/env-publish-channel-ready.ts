import { Effect, Schema } from 'effect'
import { resolvePublishChannel } from '../../publishing.js'
import * as Precondition from '../models/precondition.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment } from '../models/violation-location.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { ReleaseContextService } from '../services/release-context.js'
import { RuleOptionsService } from '../services/rule-options.js'

const githubWorkflowRefRe = /\.github\/workflows\/([^@/]+)@/

const OptionsSchema = Schema.Struct({
  surface: Schema.optionalWith(Schema.Literal('execution', 'preview'), {
    default: () => 'execution' as const,
  }),
})
type Options = typeof OptionsSchema.Type

export const PublishChannelReadyMetadataSchema = Schema.Struct({
  status: Schema.Literal('manual', 'ready', 'deferred'),
  mode: Schema.Literal('manual', 'github-token', 'github-trusted'),
  workflow: Schema.optional(Schema.String),
  activeWorkflow: Schema.optional(Schema.String),
  tokenEnv: Schema.optional(Schema.String),
})
export type PublishChannelReadyMetadata = typeof PublishChannelReadyMetadataSchema.Type

const parseWorkflowFilename = (value: string | undefined): string | null => {
  if (!value) return null
  const match = value.match(githubWorkflowRefRe)
  return match?.[1] ?? null
}

/** Verifies that the declared publish channel matches the current runtime when it is checkable. */
export const rule = RuntimeRule.create<
  Options,
  PublishChannelReadyMetadata,
  never,
  ReleaseContextService | RuleOptionsService
>({
  id: RuleId.make('env.publish-channel-ready'),
  description: 'declared publish channel matches the active runtime',
  preconditions: [Precondition.HasReleasePlan.make()],
  optionsSchema: OptionsSchema,
  check: Effect.gen(function* () {
    const context = yield* ReleaseContextService
    const options = (yield* RuleOptionsService) as Options

    if (!context.lifecycle) return undefined

    const channel = resolvePublishChannel(context.publishing, context.lifecycle)
    if (channel.mode === 'manual') {
      return {
        metadata: {
          status: 'manual' as const,
          mode: 'manual' as const,
        },
      }
    }

    if (process.env['GITHUB_ACTIONS'] !== 'true') {
      return {
        metadata: {
          status: 'deferred' as const,
          mode: channel.mode,
          workflow: channel.workflow,
          ...(channel.mode === 'github-token' ? { tokenEnv: channel.tokenEnv } : {}),
        },
      }
    }

    const workflowFile = parseWorkflowFilename(process.env['GITHUB_WORKFLOW_REF'])
    if (workflowFile && workflowFile !== channel.workflow) {
      if (options.surface === 'preview') {
        return {
          metadata: {
            status: 'deferred' as const,
            mode: channel.mode,
            workflow: channel.workflow,
            activeWorkflow: workflowFile,
            ...(channel.mode === 'github-token' ? { tokenEnv: channel.tokenEnv } : {}),
          },
        }
      }

      return Violation.make({
        location: Environment.make({
          message: `GitHub Actions is running workflow "${workflowFile}", but ${context.lifecycle} publishing is declared on "${channel.workflow}".`,
        }),
        summary: `The active workflow does not match the declared ${context.lifecycle} publish channel.`,
        detail:
          'Trusted-publishing and token-based release wiring are attached to a specific workflow file. ' +
          'If the wrong workflow is running, the release checks may pass in the wrong place and fail in the real publish path.',
        hints: [
          Hint.make({
            description: `Run ${context.lifecycle} publishing from .github/workflows/${channel.workflow}.`,
          }),
          Hint.make({
            description:
              'Keep one canonical workflow per lifecycle so CI preview, lint, and npm publisher settings all point at the same file.',
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

    if (channel.mode === 'github-token') {
      const token = process.env[channel.tokenEnv]
      if (!token || token.trim() === '') {
        return Violation.make({
          location: Environment.make({
            message: `${channel.tokenEnv} is not set in this GitHub Actions job.`,
          }),
          summary: `The ${context.lifecycle} publish channel expects an npm token, but ${channel.tokenEnv} is missing.`,
          detail:
            'This workflow is declared to publish through a GitHub Actions secret-backed npm token. ' +
            'Without that environment variable, npm publish will fail when the publish step starts.',
          hints: [
            Hint.make({
              description: `Add ${channel.tokenEnv} as a GitHub Actions secret and export it in ${channel.workflow}.`,
            }),
            Hint.make({
              description:
                'Prefer github-trusted where possible; npm no longer recommends long-lived automation tokens for CI publishing.',
            }),
          ],
          docs: [
            DocLink.make({
              label: 'npm CI/CD auth guidance',
              url: 'https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow/',
            }),
          ],
        })
      }

      return {
        metadata: {
          status: 'ready' as const,
          mode: 'github-token' as const,
          workflow: channel.workflow,
          tokenEnv: channel.tokenEnv,
        },
      }
    }

    const idTokenUrl = process.env['ACTIONS_ID_TOKEN_REQUEST_URL']
    const idTokenRequestToken = process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN']
    if (!idTokenUrl || !idTokenRequestToken) {
      return Violation.make({
        location: Environment.make({
          message: 'GitHub Actions OIDC token request environment is not available in this job.',
        }),
        summary: `The ${context.lifecycle} publish channel is declared as github-trusted, but this job cannot request an OIDC token.`,
        detail:
          'npm trusted publishing on GitHub Actions depends on the job having id-token permission and running on a supported hosted runner. ' +
          'Without those OIDC request variables, trusted publishing cannot authenticate to npm.',
        hints: [
          Hint.make({
            description: `Grant \`id-token: write\` to the ${channel.workflow} workflow job that performs npm publish.`,
          }),
          Hint.make({
            description:
              'Ensure the publish job runs on GitHub-hosted runners and that npm trusted publishing is configured for this repo/workflow pair.',
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

    return {
      metadata: {
        status: 'ready' as const,
        mode: 'github-trusted' as const,
        workflow: channel.workflow,
      },
    }
  }),
})
