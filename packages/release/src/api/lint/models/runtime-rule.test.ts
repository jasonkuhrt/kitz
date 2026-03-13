import { Effect, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { RuleDefaults, RuleId } from './rule-defaults.js'
import { create, type RuntimeRule } from './runtime-rule.js'
import { Environment } from './violation-location.js'
import { Violation } from './violation.js'

describe('RuntimeRule', () => {
  test('create with clean check', () => {
    const rule = create({
      id: RuleId.makeUnsafe('env.git-clean'),
      description: 'Working directory is clean',
      preconditions: [],
      check: Effect.succeed(undefined),
    })
    expect(rule.data.id).toBe('env.git-clean')
    expect(rule.data.description).toBe('Working directory is clean')
  })

  test('create with violation check', () => {
    const violation = new Violation({
      location: new Environment({ message: 'Dirty working directory' }),
    })
    const rule = create({
      id: RuleId.makeUnsafe('env.git-clean'),
      description: 'Working directory is clean',
      preconditions: [],
      check: Effect.succeed(violation),
    })
    expect(rule.data.id).toBe('env.git-clean')
  })

  test('create with metadata result', () => {
    const rule = create({
      id: RuleId.makeUnsafe('env.npm-authenticated'),
      description: 'npm is authenticated',
      preconditions: [],
      check: Effect.succeed({ metadata: { username: 'testuser' } }),
    })
    expect(rule.data.id).toBe('env.npm-authenticated')
  })

  test('create with options schema', () => {
    const OptionsSchema = Schema.Struct({ registry: Schema.String })
    const rule = create({
      id: RuleId.makeUnsafe('env.npm-authenticated'),
      description: 'npm is authenticated',
      preconditions: [],
      optionsSchema: OptionsSchema,
      check: Effect.succeed(undefined),
    })
    expect(rule.optionsSchema).toBeDefined()
  })

  test('check is an Effect', async () => {
    const rule = create({
      id: RuleId.makeUnsafe('env.git-clean'),
      description: 'test',
      preconditions: [],
      check: Effect.succeed(undefined),
    })
    const result = await Effect.runPromise(rule.check)
    expect(result).toBeUndefined()
  })

  test('create with defaults', () => {
    const rule = create({
      id: RuleId.makeUnsafe('env.git-clean'),
      description: 'test',
      preconditions: [],
      defaults: new RuleDefaults({ enabled: true }),
      check: Effect.succeed(undefined),
    })
    expect(rule.data.defaults).toBeDefined()
  })
})
