import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const importSources = (code: string): readonly string[] =>
  [...code.matchAll(/^\s*import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gmu)].map(
    (match) => match[1]!,
  )

describe('ReleaseWorkflow structure', () => {
  test('workflow graph delegates payload, identity, and registry verification details', () => {
    const workflow = source('./workflow.ts')
    const imports = importSources(workflow)

    expect(imports.filter((entry) => !entry.startsWith('./workflow/'))).toEqual([
      '@kitz/flo',
      '../publishing.js',
      './errors.js',
    ])
    expect(workflow).not.toContain('export const ReleasePayload = Schema.Struct')
    expect(workflow).not.toContain('const releaseWorkflowIdempotencyKey =')
    expect(workflow).not.toContain('ArtifactManifest.make')
    expect(workflow).not.toContain('PublishReceipt.make')
    expect(workflow).not.toContain('RegistryObservation.make')
    expect(workflow).not.toContain('fs.readFile')
    expect(workflow).not.toContain('new Date().toISOString()')
  })

  test('workflow module keeps release identity helpers internal unless intentionally exported', () => {
    const workflow = source('./workflow.ts')

    expect(workflow).not.toMatch(
      /export\s*\{[^}]*tagForRelease[^}]*\}\s*from\s*['"]\.\/workflow\/release-info\.js['"]/u,
    )
  })

  test('registry verification activity delegates proof construction to a producer module', () => {
    const activity = source('./workflow/activities/verify.ts')

    expect(activity).toContain('../../registry-verification.js')
    expect(activity).not.toContain('FileSystem')
    expect(activity).not.toContain('NpmRegistry.NpmCli')
    expect(activity).not.toContain('ArtifactManifest.make')
    expect(activity).not.toContain('PublishReceipt.make')
    expect(activity).not.toContain('RegistryObservation.make')
    expect(activity).not.toContain('sha256Bytes')
    expect(activity).not.toContain('new Date')
  })

  test('rehearsed artifact activity uses typed kitz filesystem operations', () => {
    const activity = source('./workflow/activities/prepare.ts')

    expect(activity).toContain('Fs.exists(artifact)')
    expect(activity).toContain('Fs.read(artifact)')
    expect(activity).not.toContain('FileSystem')
    expect(activity).not.toContain('fs.exists')
    expect(activity).not.toContain('fs.readFile')
  })
})
