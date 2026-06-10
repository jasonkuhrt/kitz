import { readFileSync } from 'node:fs'
import { Yaml } from '@kitz/yaml'
import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

const Permissions = Schema.Record(Schema.String, Schema.String)
const Workflow = Yaml.parseYaml().pipe(
  Schema.decodeTo(
    Schema.Struct({
      permissions: Permissions,
      jobs: Schema.Record(
        Schema.String,
        Schema.Struct({
          permissions: Schema.optional(Permissions),
        }),
      ),
    }),
  ),
)

const workflow = Schema.decodeUnknownSync(Workflow)(
  readFileSync(new URL('../../../../.github/workflows/pr.yml', import.meta.url), 'utf8'),
)

describe('release preview workflow permissions', () => {
  test('can post the generated PR preview comment', () => {
    const releasePreviewPermissions = workflow.jobs['release-preview']?.permissions

    expect(workflow.permissions['issues']).toBe('write')
    expect(
      releasePreviewPermissions === undefined || releasePreviewPermissions['issues'] === 'write',
    ).toBe(true)
  })
})
