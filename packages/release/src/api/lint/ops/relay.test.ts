import { Fs } from '@kitz/fs'
import { Effect, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { Failed, Finished, Report, Skipped } from '../models/report.js'
import { RuleId } from '../models/rule-defaults.js'
import * as Severity from '../models/severity.js'
import { CommandFix, DocLink, FixStep, GuideFix, Hint, Violation } from '../models/violation.js'
import {
  Environment,
  File,
  GitHistory,
  PrBody,
  PrTitle,
  RepoSettings,
} from '../models/violation-location.js'
import { Destination, formatReport, relay } from './relay.js'

const ruleRef = (id: string, description = 'Test rule') => ({
  id: RuleId.makeUnsafe(id),
  description,
})

describe('formatReport', () => {
  test('renders severity, guidance, and docs for violations', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef(
            'env.publish-channel-ready',
            'declared publish channel matches the active runtime',
          ),
          duration: 4,
          severity: Severity.Error.make({}),
          violation: Violation.make({
            location: Environment.make({ message: 'ACTIONS_ID_TOKEN_REQUEST_URL is missing.' }),
            summary: 'Trusted publishing is configured but OIDC is unavailable.',
            detail: 'The publish job cannot request an identity token from GitHub Actions.',
            fix: GuideFix.make({
              summary: 'Enable OIDC for the publish job.',
              steps: [
                FixStep.make({ description: 'Add `permissions.id-token: write` to the workflow.' }),
              ],
              docs: [
                DocLink.make({
                  label: 'npm trusted publishers',
                  url: 'https://docs.npmjs.com/trusted-publishers/',
                }),
              ],
            }),
            hints: [Hint.make({ description: 'Grant `id-token: write` to the job.' })],
            docs: [
              DocLink.make({
                label: 'npm trusted publishers',
                url: 'https://docs.npmjs.com/trusted-publishers/',
              }),
            ],
          }),
        }),
      ],
    })

    const output = formatReport(report)

    expect(output).toContain('Doctor Report')
    expect(output).toContain('[error] env.publish-channel-ready')
    expect(output).toContain('Trusted publishing is configured but OIDC is unavailable.')
    expect(output).toContain('fix: Enable OIDC for the publish job.')
    expect(output).toContain('step 1: Add `permissions.id-token: write` to the workflow.')
    expect(output).toContain(
      'fix docs: npm trusted publishers https://docs.npmjs.com/trusted-publishers/',
    )
    expect(output).toContain('hint: Grant `id-token: write` to the job.')
    expect(output).toContain(
      'docs: npm trusted publishers https://docs.npmjs.com/trusted-publishers/',
    )
  })

  test('can omit the default title for embedded report sections', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef('env.release-branch-allowed', 'active branch is allowed'),
          duration: 1,
          severity: Severity.Error.make({}),
        }),
      ],
    })

    const output = formatReport(report, { includeTitle: false })

    expect(output).not.toContain('Doctor Report')
    expect(output).toContain('1 rules checked')
  })

  test('renders skipped, failed, command fixes, and all supported locations', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef('pr.title', 'title is valid'),
          duration: 1,
          severity: Severity.Warn.make({}),
          violation: Violation.make({
            location: PrTitle.make({ title: 'feat(release): ship' }),
            summary: 'Title needs a release scope.',
            fix: CommandFix.make({
              summary: 'Apply the suggested title.',
              command: 'bun run release pr-title',
              docs: [],
            }),
          }),
        }),
        Finished.make({
          rule: ruleRef('pr.body', 'body is valid'),
          duration: 1,
          severity: Severity.Warn.make({}),
          violation: Violation.make({
            location: PrBody.make({ line: 12 }),
            summary: 'Body is missing details.',
          }),
        }),
        Finished.make({
          rule: ruleRef('repo.settings', 'repo settings are valid'),
          duration: 1,
          severity: Severity.Warn.make({}),
          violation: Violation.make({
            location: RepoSettings.make({}),
            summary: 'Repository settings need attention.',
          }),
        }),
        Finished.make({
          rule: ruleRef('git.history', 'history is monotonic'),
          duration: 1,
          severity: Severity.Warn.make({}),
          violation: Violation.make({
            location: GitHistory.make({ sha: 'abc1234' }),
            summary: 'History is out of order.',
          }),
        }),
        Finished.make({
          rule: ruleRef('file.rule', 'file metadata is present'),
          duration: 1,
          severity: Severity.Warn.make({}),
          violation: Violation.make({
            location: File.make({ path: 'packages/core/package.json', line: 8 }),
            summary: 'Repository field is missing.',
          }),
        }),
        Skipped.make({
          rule: ruleRef('filtered.rule', 'rule was filtered out'),
          reason: 'filtered',
        }),
        Failed.make({
          rule: ruleRef('failed.rule', 'rule failed'),
          duration: 1,
          error: new Error('process exited 1'),
        }),
      ],
    })

    const output = formatReport(report)

    expect(output).toContain('command: bun run release pr-title')
    expect(output).toContain('at PR title "feat(release): ship"')
    expect(output).toContain('at PR body line 12')
    expect(output).toContain('at repository settings')
    expect(output).toContain('at git history at abc1234')
    expect(output).toContain('at packages/core/package.json:8')
    expect(output).toContain('Skipped (1):')
    expect(output).toContain('Errors (1):')
  })

  test('writes json output to a file destination', async () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef(
            'env.publish-channel-ready',
            'declared publish channel matches the active runtime',
          ),
          duration: 1,
          severity: Severity.Warn.make({}),
        }),
      ],
    })
    const path = '/tmp/doctor-report.json'

    const output = await Effect.runPromise(
      Effect.gen(function* () {
        yield* relay({
          report,
          format: 'json',
          destination: Destination.file(path),
        })
        return yield* Fs.readString(Fs.Path.AbsFile.fromString(path))
      }).pipe(Effect.provide(Fs.Memory.layer({}))),
    )

    expect(Schema.decodeUnknownSync(Schema.fromJsonString(Report))(output)).toMatchObject({
      _tag: 'Report',
    })
  })
})
