import { Test } from '@kitz/test'
import { describe, expect } from 'bun:test'
import * as Argv from './argv.js'

describe('Argv', () => {
  Test.describe('npmPack')
    .inputType<Argv.NpmPackArgvOptions>()
    .outputType<readonly string[]>()
    .cases(
      {
        input: { packDestination: '/repo/.release/artifacts/' },
        output: ['pack', '--json', '--pack-destination', '/repo/.release/artifacts/'],
        comment: 'minimal',
      },
      {
        input: { packDestination: '/repo/.release/artifacts/', dryRun: true },
        output: ['pack', '--json', '--pack-destination', '/repo/.release/artifacts/', '--dry-run'],
        comment: 'dry run',
      },
      {
        input: { packDestination: '/repo/.release/artifacts/', dryRun: false },
        output: ['pack', '--json', '--pack-destination', '/repo/.release/artifacts/'],
        comment: 'explicit dryRun false emits nothing',
      },
    )
    .test(({ input, output }) => {
      expect(Argv.npmPack(input)).toEqual([...output])
    })

  Test.describe('pnpmPack')
    .inputType<Argv.PnpmPackArgvOptions>()
    .outputType<readonly string[]>()
    .cases(
      {
        input: { packDestination: '/repo/.release/artifacts/' },
        output: ['pack', '--json', '--pack-destination', '/repo/.release/artifacts/'],
        comment: 'minimal',
      },
      {
        input: { packDestination: '/repo/.release/artifacts/', dryRun: true },
        output: ['pack', '--json', '--pack-destination', '/repo/.release/artifacts/', '--dry-run'],
        comment: 'dry run',
      },
    )
    .test(({ input, output }) => {
      expect(Argv.pnpmPack(input)).toEqual([...output])
    })

  Test.describe('bunPack')
    .inputType<Argv.BunPackArgvOptions>()
    .outputType<readonly string[]>()
    .cases(
      { input: {}, output: ['pm', 'pack'], comment: 'minimal — no destination, no quiet' },
      {
        input: { destination: '/repo/.release/artifacts/', quiet: true },
        output: ['pm', 'pack', '--quiet', '--destination', '/repo/.release/artifacts/'],
        comment: 'service-style parseable pack',
      },
      {
        input: { destination: '/repo/.release/artifacts/' },
        output: ['pm', 'pack', '--destination', '/repo/.release/artifacts/'],
        comment: 'destination without quiet',
      },
    )
    .test(({ input, output }) => {
      expect(Argv.bunPack(input)).toEqual([...output])
    })

  Test.describe('npmPublish')
    .inputType<Argv.NpmPublishArgvOptions>()
    .outputType<readonly string[]>()
    .cases(
      {
        input: { target: '/a/kitz-core-1.0.0.tgz' },
        output: ['publish', '/a/kitz-core-1.0.0.tgz', '--access', 'public', '--ignore-scripts'],
        comment: 'defaults: access public, ignore-scripts on',
      },
      {
        input: { target: '/a/kitz-core-1.0.0.tgz', access: 'restricted', ignoreScripts: false },
        output: ['publish', '/a/kitz-core-1.0.0.tgz', '--access', 'restricted'],
        comment: 'ignoreScripts false suppresses the flag',
      },
      {
        input: {
          target: '/a/kitz-core-1.0.0.tgz',
          tag: 'next',
          registry: 'https://registry.example.test/',
          otp: '123456',
          provenance: true,
          provenanceFile: '/a/provenance.jsonl',
          dryRun: true,
        },
        output: [
          'publish',
          '/a/kitz-core-1.0.0.tgz',
          '--access',
          'public',
          '--ignore-scripts',
          '--tag',
          'next',
          '--registry',
          'https://registry.example.test/',
          '--otp',
          '123456',
          '--provenance',
          '--provenance-file',
          '/a/provenance.jsonl',
          '--dry-run',
        ],
        comment: 'all flags in canonical order',
      },
    )
    .test(({ input, output }) => {
      expect(Argv.npmPublish(input)).toEqual([...output])
    })

  Test.describe('pnpmPublish')
    .inputType<Argv.PnpmPublishArgvOptions>()
    .outputType<readonly string[]>()
    .cases(
      { input: {}, output: ['publish'], comment: 'minimal — publishes cwd, no implicit flags' },
      {
        input: { target: '/a/kitz-core-1.0.0.tgz', noGitChecks: true },
        output: ['publish', '/a/kitz-core-1.0.0.tgz', '--no-git-checks'],
        comment: 'gated --no-git-checks',
      },
      {
        input: {
          target: '/a/kitz-core-1.0.0.tgz',
          access: 'public',
          ignoreScripts: true,
          noGitChecks: true,
          tag: 'next',
          registry: 'https://registry.example.test/',
          otp: '123456',
          provenance: true,
          dryRun: true,
          json: true,
          reportSummary: true,
        },
        output: [
          'publish',
          '/a/kitz-core-1.0.0.tgz',
          '--access',
          'public',
          '--ignore-scripts',
          '--no-git-checks',
          '--tag',
          'next',
          '--registry',
          'https://registry.example.test/',
          '--otp',
          '123456',
          '--provenance',
          '--dry-run',
          '--json',
          '--report-summary',
        ],
        comment: 'all flags in canonical order',
      },
    )
    .test(({ input, output }) => {
      expect(Argv.pnpmPublish(input)).toEqual([...output])
    })

  Test.describe('bunPublish')
    .inputType<Argv.BunPublishArgvOptions>()
    .outputType<readonly string[]>()
    .cases(
      { input: {}, output: ['publish'], comment: 'minimal — publishes cwd, no implicit flags' },
      {
        input: { target: '/a/kitz-core-1.0.0.tgz', authType: 'web', tolerateRepublish: true },
        output: ['publish', '/a/kitz-core-1.0.0.tgz', '--auth-type', 'web', '--tolerate-republish'],
        comment: 'bun-specific flags',
      },
      {
        input: {
          target: '/a/kitz-core-1.0.0.tgz',
          access: 'public',
          ignoreScripts: true,
          tag: 'next',
          registry: 'https://registry.example.test/',
          otp: '123456',
          authType: 'legacy',
          dryRun: true,
          tolerateRepublish: true,
        },
        output: [
          'publish',
          '/a/kitz-core-1.0.0.tgz',
          '--access',
          'public',
          '--ignore-scripts',
          '--tag',
          'next',
          '--registry',
          'https://registry.example.test/',
          '--otp',
          '123456',
          '--auth-type',
          'legacy',
          '--dry-run',
          '--tolerate-republish',
        ],
        comment: 'all flags in canonical order',
      },
    )
    .test(({ input, output }) => {
      expect(Argv.bunPublish(input)).toEqual([...output])
    })
})
