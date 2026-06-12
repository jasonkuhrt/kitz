import { Effect, Exit, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import { RuleDefaults, RuleId } from './rule-defaults.js'
import { create } from './runtime-rule.js'
import { Environment } from './violation-location.js'
import { Violation } from './violation.js'

describe('RuntimeRule', () => {
  test('create with clean check', () => {
    const rule = create({
      id: RuleId.make('env.git-clean'),
      description: 'Working directory is clean',
      preconditions: [],
      check: () => Effect.succeed(undefined),
    })
    expect(rule.data.id).toBe<string>('env.git-clean')
    expect(rule.data.description).toBe('Working directory is clean')
  })

  test('create with violation check', () => {
    const violation = Violation.make({
      location: Environment.make({ message: 'Dirty working directory' }),
    })
    const rule = create({
      id: RuleId.make('env.git-clean'),
      description: 'Working directory is clean',
      preconditions: [],
      check: () => Effect.succeed(violation),
    })
    expect(rule.data.id).toBe<string>('env.git-clean')
  })

  test('create with metadata result', () => {
    const rule = create({
      id: RuleId.make('env.npm-authenticated'),
      description: 'npm is authenticated',
      preconditions: [],
      check: () => Effect.succeed({ metadata: { username: 'testuser' } }),
    })
    expect(rule.data.id).toBe<string>('env.npm-authenticated')
  })

  test('check returns an Effect', async () => {
    const rule = create({
      id: RuleId.make('env.git-clean'),
      description: 'test',
      preconditions: [],
      check: () => Effect.succeed(undefined),
    })
    const result = await Effect.runPromise(rule.check())
    expect(result).toBeUndefined()
  })

  test('create with defaults', () => {
    const rule = create({
      id: RuleId.make('env.git-clean'),
      description: 'test',
      preconditions: [],
      defaults: RuleDefaults.make({ enabled: true }),
      check: () => Effect.succeed(undefined),
    })
    expect(rule.data.defaults).toBeDefined()
  })

  test('check receives options decoded through optionsSchema when run', async () => {
    const OptionsSchema = Schema.Struct({ registry: Schema.String })
    const rule = create({
      id: RuleId.make('env.npm-authenticated'),
      description: 'npm is authenticated',
      preconditions: [],
      optionsSchema: OptionsSchema,
      check: (options) => Effect.succeed({ metadata: { registry: options.registry } }),
    })

    const result = await Effect.runPromise(rule.run({ registry: 'https://example.test' }))
    expect(result).toEqual({ metadata: { registry: 'https://example.test' } })
  })

  test('run fails with a typed schema error when raw options are invalid', async () => {
    const OptionsSchema = Schema.Struct({ registry: Schema.String })
    const rule = create({
      id: RuleId.make('env.npm-authenticated'),
      description: 'npm is authenticated',
      preconditions: [],
      optionsSchema: OptionsSchema,
      check: () => Effect.succeed(undefined),
    })

    const exit = await Effect.runPromiseExit(rule.run({ registry: 42 }))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  test('run ignores raw options for option-less rules', async () => {
    const rule = create({
      id: RuleId.make('env.git-clean'),
      description: 'test',
      preconditions: [],
      check: () => Effect.succeed(undefined),
    })
    const result = await Effect.runPromise(rule.run({ anything: true }))
    expect(result).toBeUndefined()
  })
})
