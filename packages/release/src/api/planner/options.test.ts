import { Test } from '@kitz/test'
import { describe, expect } from 'vitest'
import { type Options, passesFilter } from './options.js'

describe('passesFilter', () => {
  Test.describe('filter evaluation')
    .inputType<{ moniker: string; options?: Options }>()
    .outputType<boolean>()
    .cases(
      {
        input: { moniker: '@kitz/core' },
        output: true,
        comment: 'no options means accept all',
      },
      {
        input: { moniker: '@kitz/core', options: {} },
        output: true,
        comment: 'empty options means accept all',
      },
      {
        input: { moniker: '@kitz/core', options: { packages: ['@kitz/core'] } },
        output: true,
        comment: 'included in packages list',
      },
      {
        input: { moniker: '@kitz/cli', options: { packages: ['@kitz/core'] } },
        output: false,
        comment: 'not in packages list',
      },
      {
        input: { moniker: '@kitz/core', options: { exclude: ['@kitz/core'] } },
        output: false,
        comment: 'excluded by name',
      },
      {
        input: { moniker: '@kitz/cli', options: { exclude: ['@kitz/core'] } },
        output: true,
        comment: 'not in exclude list',
      },
      {
        input: {
          moniker: '@kitz/core',
          options: { packages: ['@kitz/core'], exclude: ['@kitz/core'] },
        },
        output: false,
        comment: 'exclude takes precedence over include',
      },
      {
        input: {
          moniker: '@kitz/core',
          options: { packages: ['@kitz/core', '@kitz/cli'], exclude: ['@kitz/cli'] },
        },
        output: true,
        comment: 'included and not excluded',
      },
    )
    .test(({ input, output }) => {
      expect(passesFilter(input.moniker, input.options)).toBe(output)
    })
})
