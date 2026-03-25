// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { tmpdir } from 'node:os'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import {
  discoverRepoDirectories,
  inferOpportunities,
  inferPackageManager,
  scanFleet,
  type PackageJsonManifest,
} from './fleet-lib.js'

const tempPaths: string[] = []

const makeTempDir = (): string => {
  const path = mkdtempSync(join(tmpdir(), 'kitz-fleet-'))
  tempPaths.push(path)
  return path
}

const writeManifest = (repoPath: string, manifest: PackageJsonManifest): void => {
  mkdirSync(repoPath, { recursive: true })
  writeFileSync(join(repoPath, 'package.json'), JSON.stringify(manifest, null, 2))
}

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true })
  }
})

describe('fleet-lib', () => {
  test('discovers sibling repos with package.json and excludes self by default', () => {
    const baseDir = makeTempDir()
    writeManifest(join(baseDir, 'alpha'), { name: 'alpha' })
    writeManifest(join(baseDir, 'beta'), { name: 'beta' })
    mkdirSync(join(baseDir, 'notes'), { recursive: true })

    const discovered = discoverRepoDirectories(baseDir, {
      selfRepoName: 'beta',
    })

    expect(discovered.map((path) => path.split('/').at(-1))).toEqual(['alpha'])
  })

  test('treats an empty repo filter as all repos', () => {
    const baseDir = makeTempDir()
    writeManifest(join(baseDir, 'alpha'), { name: 'alpha' })
    writeManifest(join(baseDir, 'beta'), { name: 'beta' })

    const discovered = discoverRepoDirectories(baseDir, {
      onlyRepoNames: [],
    })

    expect(discovered.map((path) => path.split('/').at(-1))).toEqual(['alpha', 'beta'])
  })

  test('infers package manager from manifest before lockfiles', () => {
    const repoPath = makeTempDir()
    writeManifest(repoPath, {
      name: 'demo',
      packageManager: 'pnpm@10.0.0',
    })
    writeFileSync(join(repoPath, 'bun.lock'), '')

    expect(
      inferPackageManager(repoPath, {
        name: 'demo',
        packageManager: 'pnpm@10.0.0',
      }),
    ).toBe('pnpm')
  })

  test('infers opportunities for adopt, expand, and missing surfaces', () => {
    const opportunities = inferOpportunities(['yaml', '@plist/binary.parse', 'fast-glob', 'ajv'])

    expect(opportunities).toEqual([
      {
        id: 'yaml',
        status: 'adopt',
        target: '@kitz/yaml',
        sourceDependencies: ['yaml'],
        note: 'Replace raw YAML parsing/stringifying with a schema-first kitz surface.',
      },
      {
        id: 'plist',
        status: 'missing',
        target: '@kitz/plist',
        sourceDependencies: ['@plist/binary.parse'],
        note: 'Missing property-list codec/resource package.',
      },
      {
        id: 'glob',
        status: 'expand-existing',
        target: '@kitz/fs',
        sourceDependencies: ['fast-glob'],
        note: 'Expand existing filesystem/query surface rather than adding another glob dependency.',
      },
      {
        id: 'schema',
        status: 'expand-existing',
        target: '@kitz/sch',
        sourceDependencies: ['ajv'],
        note: 'Strengthen schema/runtime validation migration path into kitz schema tooling.',
      },
    ])
  })

  test('scans fleet entries with kitz and effect signals', () => {
    const baseDir = makeTempDir()

    writeManifest(join(baseDir, 'consumer'), {
      name: '@demo/consumer',
      dependencies: {
        effect: '^3.0.0',
        kitz: 'workspace:*',
        yaml: '^2.0.0',
      },
    })

    writeManifest(join(baseDir, 'legacy'), {
      name: '@demo/legacy',
      dependencies: {
        '@wollybeard/kit': '^1.0.0',
        '@plist/binary.serialize': '^1.0.0',
      },
      workspaces: ['packages/*'],
    })

    const inventory = scanFleet(baseDir)

    expect(inventory.entries).toHaveLength(2)
    expect(inventory.entries[0]).toMatchObject({
      repoDirName: 'consumer',
      usesEffect: true,
      currentKitzPackages: ['kitz'],
    })
    expect(inventory.entries[1]).toMatchObject({
      repoDirName: 'legacy',
      usesLegacyKit: true,
      workspaceKind: 'workspace',
    })
  })
})
