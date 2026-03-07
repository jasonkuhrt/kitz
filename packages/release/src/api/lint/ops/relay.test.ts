import { describe, expect, test } from 'vitest'
import { Finished, Report } from '../models/report.js'
import { RuleId } from '../models/rule-defaults.js'
import * as Severity from '../models/severity.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment } from '../models/violation-location.js'
import { formatReport } from './relay.js'

const ruleRef = (id: string, description = 'Test rule') => ({
  id: RuleId.make(id),
  description,
})

describe('formatReport', () => {
  test('renders severity, guidance, and docs for violations', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef('env.publish-channel-ready', 'declared publish channel matches the active runtime'),
          duration: 4,
          severity: Severity.Error.make(),
          violation: Violation.make({
            location: Environment.make({ message: 'ACTIONS_ID_TOKEN_REQUEST_URL is missing.' }),
            summary: 'Trusted publishing is configured but OIDC is unavailable.',
            detail: 'The publish job cannot request an identity token from GitHub Actions.',
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
    expect(output).toContain('hint: Grant `id-token: write` to the job.')
    expect(output).toContain('docs: npm trusted publishers https://docs.npmjs.com/trusted-publishers/')
  })

  test('can omit the default title for embedded report sections', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef('env.release-branch-allowed', 'active branch is allowed'),
          duration: 1,
          severity: Severity.Error.make(),
        }),
      ],
    })

    const output = formatReport(report, { includeTitle: false })

    expect(output).not.toContain('Doctor Report')
    expect(output).toContain('1 rules checked')
  })
})
