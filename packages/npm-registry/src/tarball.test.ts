import { Fs } from '@kitz/fs'
import { Test } from '@kitz/test'
import { describe, expect } from 'bun:test'
import * as Tarball from './tarball.js'

describe('Tarball', () => {
  Test.describe('slugifyPackageName')
    .inputType<string>()
    .outputType<string>()
    .cases(
      { input: 'react', output: 'react', comment: 'unscoped name unchanged' },
      { input: '@kitz/core', output: 'kitz-core', comment: 'scoped name' },
      { input: '@scope/some-pkg', output: 'scope-some-pkg', comment: 'scoped name with hyphens' },
    )
    .test(({ input, output }) => {
      expect(Tarball.slugifyPackageName(input)).toBe(output)
    })

  Test.describe('filename')
    .inputType<{ packageName: string; version: string }>()
    .outputType<string>()
    .cases(
      {
        input: { packageName: 'react', version: '19.2.0' },
        output: 'react-19.2.0.tgz',
        comment: 'unscoped',
      },
      {
        input: { packageName: '@kitz/core', version: '1.2.0' },
        output: 'kitz-core-1.2.0.tgz',
        comment: 'scoped',
      },
      {
        input: { packageName: '@kitz/core', version: '2.0.0-beta.1' },
        output: 'kitz-core-2.0.0-beta.1.tgz',
        comment: 'prerelease version',
      },
    )
    .test(({ input, output }) => {
      expect(Tarball.filename(input.packageName, input.version)).toBe(output)
    })

  Test.describe('path')
    .inputType<{ destination: string; packageName: string; version: string }>()
    .outputType<string>()
    .cases(
      {
        input: {
          destination: '/repo/.release/artifacts/',
          packageName: '@kitz/core',
          version: '1.2.0',
        },
        output: '/repo/.release/artifacts/kitz-core-1.2.0.tgz',
        comment: 'scoped package inside destination',
      },
      {
        input: { destination: '/tmp/', packageName: 'react', version: '19.2.0' },
        output: '/tmp/react-19.2.0.tgz',
        comment: 'unscoped package',
      },
    )
    .test(({ input, output }) => {
      const result = Tarball.path(
        Fs.Path.AbsDir.fromString(input.destination),
        input.packageName,
        input.version,
      )
      expect(Fs.Path.toString(result)).toBe(output)
    })
})
