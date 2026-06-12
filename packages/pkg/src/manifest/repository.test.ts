import { describe, expect, test } from 'bun:test'
import { Test } from '@kitz/test'
import { extractRepositoryGitHubSlug } from './repository.js'

describe('Pkg.Manifest repository', () => {
  Test.describe('extracts GitHub owner/repo slugs')
    .inputType<Parameters<typeof extractRepositoryGitHubSlug>[0]>()
    .outputType<string | null>()
    .cases(
      {
        input: 'github:jasonkuhrt/kitz',
        output: 'jasonkuhrt/kitz',
        comment: 'github shorthand',
      },
      {
        input: 'github:jasonkuhrt/kitz.git',
        output: 'jasonkuhrt/kitz',
        comment: 'github shorthand with .git suffix',
      },
      {
        input: 'https://github.com/jasonkuhrt/kitz',
        output: 'jasonkuhrt/kitz',
        comment: 'https url',
      },
      {
        input: 'git+https://github.com/jasonkuhrt/kitz.git',
        output: 'jasonkuhrt/kitz',
        comment: 'git+https url with .git suffix',
      },
      {
        input: 'git@github.com:jasonkuhrt/kitz.git',
        output: 'jasonkuhrt/kitz',
        comment: 'ssh url',
      },
      {
        input: { url: 'git+https://github.com/jasonkuhrt/kitz.git' },
        output: 'jasonkuhrt/kitz',
        comment: 'object form with url',
      },
      {
        input: 'https://gitlab.com/jasonkuhrt/kitz',
        output: null,
        comment: 'non-GitHub host',
      },
      {
        input: { url: undefined },
        output: null,
        comment: 'object form without url',
      },
      {
        input: {},
        output: null,
        comment: 'object form missing url key',
      },
      {
        input: undefined,
        output: null,
        comment: 'absent repository field',
      },
      {
        input: 'not a url',
        output: null,
        comment: 'unparseable string',
      },
    )
    .test(({ input, output }) => {
      expect(extractRepositoryGitHubSlug(input)).toBe(output)
    })

  test('does not match when github.com appears mid-url without slug at end', () => {
    expect(extractRepositoryGitHubSlug('https://github.com/jasonkuhrt/kitz/tree/main/')).toBe(null)
  })
})
